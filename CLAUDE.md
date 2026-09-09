# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Node.js/Express webhook server for the V Square Clinic LINE Official Account. It receives LINE Messaging API webhook events, matches the user's text against a lookup table, and replies with LINE Flex Messages (branch maps, doctor schedules, services, promotions). It can also forward every incoming webhook payload to an external CRM URL.

## Commands

```bash
npm install          # install dependencies
npm run server       # dev: run with nodemon (auto-reload) on PORT (default 8080)
npm start            # prod: node index.js
curl http://localhost:8080/   # health check -> responds "ok"
```

There is **no test suite** — `npm test` is the default placeholder that exits with an error. There is no linter or build step.

### Testing the webhook locally
`POST /webhook` is wrapped in `line.middleware(lineConfig)`, which verifies the `X-Line-Signature` header against the raw body. A plain `curl` will fail signature verification. To test end-to-end, expose the server with a public HTTPS tunnel (e.g. ngrok), set it as the Webhook URL in the LINE Developers console, and use that console's "Verify" / send a real message from the OA.

## Environment

Copy `.env.example` to `.env`. Required vars:
- `PORT` — server port (default 8080)
- `LINE_CHANNEL_TOKEN` / `LINE_CHANNEL_SECRET` — from the LINE Developers Channel
- `FORWARD_WEBHOOK_URL_PROCESS` — the string `"true"` enables forwarding; any other value disables it
- `FORWARD_WEBHOOK_URL` — destination CRM/beacon URL when forwarding is enabled

## Architecture

The request path is small; the bulk of the repo is Flex Message content.

- **`index.js`** — Express bootstrap. Note `rawBodySaver` on `express.json({ verify })`: it preserves the raw request body, which LINE's signature middleware needs. Mounts `chatRoute` at `/webhook`; `GET /` returns `"ok"`. Uses `middlewares/errorHandler.js` for 404 / error JSON.

- **`routes/chatRoute.js`** — the entire request logic and routing table (~700 lines, mostly the table). The `POST /` handler runs two things concurrently via `Promise.all`:
  1. **Forwarding** — if `FORWARD_WEBHOOK_URL_PROCESS === "true"` and a URL is set, `axios.post`s the raw `req.body` to the external CRM. Failures are caught and logged, never block the reply.
  2. **Event handling** — `req.body.events.map(handleEvents)`.

- **The `flexMessage` lookup table** (in `chatRoute.js`) is the core routing mechanism. It maps an **exact Thai text string** (the message a user sends, usually via a Rich Menu / quick-reply button) to a function returning an array of Flex Message objects. `handleEvents` only processes `message` events of type `text`, does an exact-string lookup of `event.message.text` in this table, and replies via `new line.Client(lineConfig).replyMessage(...)`. No match → no reply (returns `null`). There is no fuzzy matching, no NLP, and no fallback message.

- **`flexmessage/`** — splits into two kinds of files:
  - *Builders* (functions that produce Flex JSON): `flexMessageBranchMap.js`, `flexMessageIconTable.js`, `flexMessageDoctorSchedules.js`, `services.js`, `promotion.js`, `tabledoctors.js`, `tabledoctorsThonglor.js`.
  - *Data* (`doctor<Branch>SchedulesData.js`): each exports an array of `{ day, name, license, imageUrl }` doctor records for one branch. `FlexMessageDoctorSchedules(data)` renders one bubble per record (a carousel).

- **`flexmessage-bk/`** and **`template_flexmessage/`** are a backup copy and per-branch templates, respectively — not imported by the running app.

## Adding or changing a menu/branch

1. Build the Flex bubble — either reuse a builder (`FlexMessageBranchMap`, `FlexMessageDoctorSchedules`, etc.) or add a new builder file in `flexmessage/`.
2. For doctor schedules, add/edit the matching `doctor<Branch>SchedulesData.js` data file.
3. `require` it at the top of `chatRoute.js` and add an entry to the `flexMessage` table keyed by the **exact** Thai trigger text. The key must byte-match what the user's Rich Menu button sends.
4. Always pass a meaningful `altText` to `createFlexMessage(altText, bubble)` — it's what shows in notifications and unsupported clients.

## Notes

- `README.md` is in Thai and partly outdated: it refers to `singleFlexMap` / `branchMenuMap`, which no longer exist — the single routing table is now `flexMessage` in `chatRoute.js`.
- Several dependencies in `package.json` (`mongoose`, `openai`, `cheerio`, `html-to-docx`, `turndown`) are not used by the current request path; treat them as leftovers unless you find active imports.
