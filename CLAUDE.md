# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Node.js/Express webhook server for the V Square Clinic LINE Official Accounts. One instance serves several OAs on the same `/webhook` URL, and every OA answers from the same content. It receives LINE Messaging API webhook events, matches the user's text against a lookup table, and replies with LINE Flex Messages (branch maps, doctor schedules, services, promotions). It can also forward incoming webhook payloads to an external CRM URL, configured per OA.

## Commands

```bash
npm install          # install dependencies
npm run server       # dev: run with nodemon (auto-reload) on PORT (default 8080)
npm start            # prod: node index.js
npm test             # run the test suite (node --test)
npm run admin:build  # install admin/ deps and build the React admin UI into admin/dist
curl http://localhost:8080/   # health check -> responds "ok"
```

There is no linter or root build step.

### Testing the webhook locally
`POST /webhook` checks the `X-Line-Signature` header against the raw body with each configured OA's channel secret; the secret that matches identifies which OA sent the event. A plain `curl` has no valid signature and gets 401. To test end-to-end, expose the server with a public HTTPS tunnel (e.g. ngrok), set it as the Webhook URL in the LINE Developers console, and use that console's "Verify" / send a real message from the OA.

## Environment

Copy `.env.example` to `.env`. Required vars:
- `PORT` — server port (default 8080)
- `LINE_CHANNEL_TOKEN` / `LINE_CHANNEL_SECRET` — the first OA, from its LINE Developers Channel (required). `LINE_CHANNEL_NAME` — optional name used in logs (default `OA 1`)
- `LINE_CHANNEL_TOKEN_<n>` / `LINE_CHANNEL_SECRET_<n>` / `LINE_CHANNEL_NAME_<n>` — additional OAs, `<n>` = 2 and up (gaps allowed, no leading zeros). Token and secret must come as a pair; blank values count as unset
- `FORWARD_WEBHOOK_URL_PROCESS` — the string `"true"` enables forwarding **for the first OA**; any other value disables it
- `FORWARD_WEBHOOK_URL` — destination CRM/beacon URL for the first OA when forwarding is enabled
- `FORWARD_WEBHOOK_URL_<n>` — if set, OA `<n>`'s events are forwarded there; unset means that OA forwards nothing (there is no `_PROCESS` flag for additional OAs)
- `ADMIN_PASSWORD` — required to enable the admin UI/API; if unset, every `/api/admin` endpoint returns 503
- `ADMIN_TOKEN_SECRET` — optional; secret used to sign admin auth tokens (derived from `ADMIN_PASSWORD` if not set)

The app refuses to start (exit 1; the message names the variable and never prints a secret) when the first OA is missing, a token/secret pair is incomplete, a suffix is `_0`, `_1` or zero-padded, a name or forward URL is set for an OA without credentials, or two OAs share a secret or a token.

## Architecture

- **`index.js`** — Express bootstrap. Loads `.env`, builds the OA list (`loadChannels`; exits on a config error), the data store and the message table, and passes them to the routers. `rawBodySaver` on `express.json({ limit: "2mb", verify })` keeps the raw body for LINE's signature check. Mounts `/webhook` (LINE), `/api/admin` (admin API), `/backoffice` (static build of the React admin UI, only if `admin/dist` exists). `GET /` returns `"ok"`. After `listen` it logs the loaded OAs and checks each token against LINE (`checkChannelTokens`; a bad token is only a warning).
- **`services/channels.js`** — the OA list. `loadChannels(env)` → `[{ id, name, channelSecret, channelAccessToken, forwardUrl }]`; `findChannelBySignature(channels, rawBody, signature)` returns the OA whose secret signed the body, or `null`; `checkChannelTokens(channels)` asks LINE whether each token works.
- **`data/*.json`** — the single source of truth for all bot content: `promotions.json`, `services.json` (service cards + their price images, keyed by `actionText`), `branches.json` (map/contact + `doctors[]` per branch, `enabled`, `menu`, `region`), `regions.json` (bubbles of the "ตารางแพทย์" menu). Edited via the admin UI; `data/backup/` holds the last 20 versions per file (git-ignored).
- **`services/dataStore.js`** — reads/writes those files (atomic write, backup, cache, `onChange`).
- **`services/messageTable.js`** — `build(data)` produces `Map<trigger, Message[]>` using the Flex builders; `createMessageTable(store)` rebuilds on every save. Fixed triggers: `บริการทั้งหมด`, `โปรโมชั่นล่าสุด`, `ตารางแพทย์`, `ตารางแพทย์สาขาทองหล่อ` — each of these is **omitted entirely when its content would be empty** (no services / no promotions / no region with an enabled `main`\|`both` branch / no `thonglor`\|`both` branch), since LINE rejects a Flex message whose `box.contents`/`carousel.contents` is `[]`; per service: `actionText`; per enabled branch: `trigger` and `"สอบถามตารางแพทย์ สาขา" + trigger`, where the schedule trigger exists **only** for enabled branches that have at least 1 doctor (doctor carousels are split every 12).
- **`services/validate.js`** — validation rules applied on every admin PUT (returns `{path, message}[]`).
- **`routes/chatRoute.js`** — `createChatRouter({ channels, messageTable })`, webhook only: find the OA by signature (no match → 401), optional forwarding to that OA's `forwardUrl`, then `messageTable.getTable().get(text)` → `replyMessage` with that OA's client. No trigger match → no reply. The message table is shared by every OA.
- **`routes/adminRoute.js` / `middlewares/adminAuth.js`** — `POST /api/admin/login` (`ADMIN_PASSWORD` → 12h HMAC token), `GET/PUT /api/admin/{promotions|services|branches|regions}`, `GET /api/admin/triggers`, `GET /api/admin/preview/:trigger`. Without `ADMIN_PASSWORD` every admin endpoint returns 503.
- **`flexmessage/`** — pure Flex builders; they take data as parameters and contain no content.
- **`admin/`** — Vite + React admin UI (HashRouter, served at `/backoffice/`). The UI path is set in two places that must match: `base` in `admin/vite.config.js` and `ADMIN_UI_PATH` in `index.js` (rebuild after changing it). `cd admin && npm run dev` serves http://localhost:5173/backoffice/ (proxies `/api` to :8080) or `npm run admin:build` from the root to produce `admin/dist`.

## Adding or changing content

Use the admin UI at `/backoffice/` (or edit `data/*.json` by hand and restart). Trigger strings must byte-match what the Rich Menu sends. A new branch needs `trigger`, contact fields, `region` (must exist in `regions.json`), `menu` and `enabled: true`. No code changes are required for new promotions, services, branches or doctors. Note: a branch with `enabled: false` answers neither its map trigger nor its doctor-schedule trigger; a service with an empty `priceImages` array replies with the follow-up text only.

## Adding a LINE OA

Add `LINE_CHANNEL_TOKEN_<n>` / `LINE_CHANNEL_SECRET_<n>` (optionally `LINE_CHANNEL_NAME_<n>`, `FORWARD_WEBHOOK_URL_<n>`) to the server's `.env`, restart, and check that the boot log lists the OA with a working token. In that OA's LINE Developers console set the **same** Webhook URL as the other OAs, enable "Use webhook" and press Verify. No code or data changes are needed. Each OA's Rich Menu is still created separately in LINE Official Account Manager, and its trigger strings must byte-match the other OAs'.

## Tests

`npm test` runs `node --test` over `test/*.test.js` (data store, validators, builders, message table, admin auth/routes, OA list, webhook route) — 84 tests, no test framework dependencies. `test/builders.test.js` compares Flex output against the frozen fixture `test/fixtures/menu-messages.json`; regenerate that fixture only when the Flex design changes intentionally.

## Deploying

`data/*.json` is committed to git **and** edited live on the server by the admin UI, so a naive deploy can clobber admin edits:
- Before deploying a new version, copy the server's `data/*.json` back into the repo (or commit from the server) so admin edits aren't overwritten. `git pull` will refuse to overwrite modified `data/` files on the server — resolve by committing the server's data first, then pulling. Alternatively, mark them `git update-index --skip-worktree data/*.json` on the server so git stops tracking their local changes.
- `admin/dist` is git-ignored, so every deploy must run `npm run admin:build` to produce it.
- Behind nginx (same host): `index.js` sets `app.set("trust proxy", "loopback")`, so the proxy **must** send the real client IP, e.g. `proxy_set_header X-Forwarded-For $http_cf_connecting_ip;` (Cloudflare) or `$remote_addr`. Without that header every request has `req.ip = 127.0.0.1` and the admin login lockout (5 failures / 15 min) becomes one shared bucket for all admins. Use `location ^~ /backoffice/` and `location ^~ /api/admin/` so nginx regex locations (e.g. image caching rules) never intercept admin assets.
- The server must be **restarted** after building, because `index.js` checks whether `admin/dist` exists only once at boot — without a restart `/backoffice` keeps 404ing even after a successful build.

## Notes

- `template_flexmessage/` is not imported by the running app.
- Several dependencies in `package.json` (`mongoose`, `openai`, `cheerio`, `html-to-docx`, `turndown`) are unused leftovers.
