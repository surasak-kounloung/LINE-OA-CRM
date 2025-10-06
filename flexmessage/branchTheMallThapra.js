// บริการทั้งหมด
function FlexMessageBranchTheMallThapraBubble() {
    return {
        "type": "carousel",
        "contents": [
            {
                "type": "bubble",
                "hero": {
                    "type": "image",
                    "url": "https://vsquareclinic.co/wp-content/uploads/2025/10/เดอะมอลล์-ท่าพระ.jpg",
                    "size": "full",
                    "aspectRatio": "20:13",
                    "aspectMode": "cover",
                    "action": {
                        "type": "uri",
                        "uri": "https://goo.gl/maps/DpytzbYqm66ACxrCA"
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
                                    "text": "เดอะมอลล์ ท่าพระ",
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
                                            "text": "080 453 4000",
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
                                            "text": "@VsqMTA",
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
                                "uri": "https://goo.gl/maps/DpytzbYqm66ACxrCA"
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
    FlexMessageBranchTheMallThapraBubble,
};