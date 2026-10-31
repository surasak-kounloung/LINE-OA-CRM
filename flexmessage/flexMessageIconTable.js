function createIconTableCard(message = {}) {
    const {
        messageText = ""
    } = message;

    return {
        "type": "bubble",
        "body": {
            "type": "box",
            "layout": "vertical",
            "contents": [
                {
                    "type": "image",
                    "url": "https://www.vsquareclinic.com/wp-content/uploads/2026/06/icon-schedule.png",
                    "size": "3xl",
                    "margin": "none",
                    "aspectMode": "cover",
                    "action": {
                        "type": "message",
                        "label": "action",
                        "text": messageText
                    }
                },
                {
                    "type": "text",
                    "text": "ตารางแพทย์",
                    "weight": "bold",
                    "align": "center",
                    "gravity": "center",
                    "size": "xl",
                    "color": "#2549a2",
                    "margin": "none",
                    "action": {
                        "type": "message",
                        "label": "action",
                        "text": messageText
                    }
                },
                {
                    "type": "text",
                    "text": "Doctor Schedule",
                    "align": "center",
                    "action": {
                        "type": "message",
                        "label": "action",
                        "text": messageText
                    }
                }
            ]
        }
    };
}

function normalizeMessageList(message) {
    if (Array.isArray(message)) {
        return message.filter((message) => message && typeof message === "object");
    }

    if (message && typeof message === "object") {
        return [message];
    }

    return [];
}

function FlexMessageIconTable(messageData) {
    const messageList = normalizeMessageList(messageData);
    if (!messageList.length) {
        throw new Error("FlexMessageIconTable ต้องระบุข้อมูลข้อความอย่างน้อย 1 รายการ");
    }
    const contents = messageList.map(createIconTableCard);

    return {
        "type": "carousel",
        "contents": contents
    };
}

module.exports = {
    FlexMessageIconTable,
    createIconTableCard
};