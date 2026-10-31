// ตัวเชื่อมบาง ๆ ระหว่าง services/richMenuSync.js กับ @line/bot-sdk ของหนึ่ง OA
const line = require("@line/bot-sdk");

// ข้อความสำหรับ log และหน้าจอ — ไม่ส่ง object error ของ SDK ออกไปทั้งก้อน
function describeLineError(error) {
  if (!error || typeof error !== "object") return String(error);
  const status = error.status || error.statusCode;
  const body = typeof error.body === "string" && error.body ? ` ${error.body.slice(0, 300)}` : "";
  return `${error.message}${status ? ` (HTTP ${status})` : ""}${body}`;
}

function createLineRichMenuApi(channel, clients = {}) {
  const config = { channelAccessToken: channel.channelAccessToken };
  const client = clients.client || new line.messagingApi.MessagingApiClient(config);
  const blobClient = clients.blobClient || new line.messagingApi.MessagingApiBlobClient(config);

  // LINE ตอบ 404 เมื่อยังไม่ได้ตั้งเมนูเริ่มต้นผ่าน API
  async function getDefaultRichMenuId() {
    try {
      return (await client.getDefaultRichMenuId()).richMenuId || null;
    } catch (error) {
      if (error && error.status === 404) return null;
      throw error;
    }
  }

  return {
    async readState() {
      const [list, aliasList, defaultRichMenuId] = await Promise.all([
        client.getRichMenuList(),
        client.getRichMenuAliasList(),
        getDefaultRichMenuId(),
      ]);
      return {
        menus: (list.richmenus || []).map((menu) => ({ richMenuId: menu.richMenuId, name: menu.name })),
        aliases: (aliasList.aliases || []).map((alias) => ({
          richMenuAliasId: alias.richMenuAliasId,
          richMenuId: alias.richMenuId,
        })),
        defaultRichMenuId,
      };
    },
    async createMenu(richMenu) {
      return (await client.createRichMenu(richMenu)).richMenuId;
    },
    async uploadImage(richMenuId, buffer, contentType) {
      await blobClient.setRichMenuImage(richMenuId, new Blob([buffer], { type: contentType }));
    },
    async createAlias(richMenuAliasId, richMenuId) {
      await client.createRichMenuAlias({ richMenuAliasId, richMenuId });
    },
    async updateAlias(richMenuAliasId, richMenuId) {
      await client.updateRichMenuAlias(richMenuAliasId, { richMenuId });
    },
    async deleteAlias(richMenuAliasId) {
      await client.deleteRichMenuAlias(richMenuAliasId);
    },
    // คืน request ID ที่ใช้ถามความคืบหน้าของการย้ายลูกค้า
    async startBatch(operations) {
      const response = await client.richMenuBatchWithHttpInfo({ operations });
      return response.httpResponse.headers.get("x-line-request-id");
    },
    async batchPhase(requestId) {
      return (await client.getRichMenuBatchProgress(requestId)).phase;
    },
    async setDefault(richMenuId) {
      await client.setDefaultRichMenu(richMenuId);
    },
    async deleteMenu(richMenuId) {
      await client.deleteRichMenu(richMenuId);
    },
  };
}

module.exports = { createLineRichMenuApi, describeLineError };
