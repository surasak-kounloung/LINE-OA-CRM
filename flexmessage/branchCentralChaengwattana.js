// บริการทั้งหมด
function FlexMessageBranchCentralChaengwattanaBubble() {
    return {
        "type": "carousel",
        "contents": [
            {
                "type": "bubble",
                "hero": {
                    "type": "image",
                    "url": "https://vsquareclinic.co/wp-content/uploads/2025/10/เซ็นทรัล-แจ้งวัฒนะ.jpg",
                    "size": "full",
                    "aspectRatio": "20:13",
                    "aspectMode": "cover",
                    "action": {
                        "type": "uri",
                        "uri": "https://g.page/VSQCWT"
                    }
                },
                "body": {
                    "type": "box",
                    "layout": "vertical",
                    "contents": [
                        {
                            "type": "box",
                            "layout": "vertical",
                            "contents": [
                                {
                                    "type": "text",
                                    "text": "เซ็นทรัล แจ้งวัฒนะ",
                                    "weight": "bold",
                                    "size": "xxl",
                                    "margin": "md",
                                    "offsetTop": "-6px"
                                },
                                {
                                    "type": "box",
                                    "layout": "horizontal",
                                    "contents": [
                                        {
                                            "type": "text",
                                            "text": "เบอร์โทร",
                                            "size": "sm",
                                            "color": "#aaaaaa",
                                            "flex": 0
                                        },
                                        {
                                            "type": "text",
                                            "text": "093 007 9000",
                                            "size": "sm",
                                            "color": "#8a8a8a",
                                            "align": "start",
                                            "margin": "xl"
                                        }
                                    ]
                                },
                                {
                                    "type": "box",
                                    "layout": "horizontal",
                                    "contents": [
                                        {
                                            "type": "text",
                                            "text": "ไลน์",
                                            "size": "sm",
                                            "color": "#aaaaaa",
                                            "flex": 0
                                        },
                                        {
                                            "type": "text",
                                            "text": "@VsqCWT",
                                            "size": "sm",
                                            "color": "#8a8a8a",
                                            "align": "start",
                                            "margin": "44px"
                                        }
                                    ],
                                    "margin": "sm"
                                },
                                {
                                    "type": "separator",
                                    "margin": "lg"
                                }
                            ],
                            "offsetTop": "-10px"
                        }
                    ],
                    "height": "125px"
                },
                "footer": {
                    "type": "box",
                    "layout": "vertical",
                    "spacing": "sm",
                    "contents": [
                        {
                            "type": "button",
                            "action": {
                                "type": "uri",
                                "label": "ดูแผนที่",
                                "uri": "https://g.page/VSQCWT"
                            },
                            "offsetTop": "-10px"
                        }
                    ],
                    "height": "60px",
                    "justifyContent": "center"
                }
            }
        ]
    };
}

module.exports = {
    FlexMessageBranchCentralChaengwattanaBubble,
};