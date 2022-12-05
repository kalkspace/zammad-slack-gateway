const groupToSlackChannel = {
    "Users": "INSERT WEBHOOK URL HERE",
};

const { IncomingWebhook } = require('@slack/webhook');

const slackEscape = (text) => {
    text = text.replaceAll('&', '&amp;')
    text = text.replaceAll('<', '&lt;');
    text = text.replaceAll('>', '&gt;');
    return text;
}

exports.handler = async(request) => {
    // TODO verify signature
    const payload = JSON.parse(request.body);
    const groupName = payload.ticket.group.name;
    const slackWebhookUrl = groupToSlackChannel[groupName];
    if (!slackWebhookUrl) {
        return {
            statusCode: 404,
        }
    }

    const sender = {
        type: "context",
        elements: [
            {
                type: "plain_text",
                text: `${payload.ticket.customer.firstname} ${payload.ticket.customer.lastname} (${payload.ticket.customer.email})`
            }
        ],
    };
    const header = {
        "type": "section",
        "text": {
            "type": "mrkdwn",
            "text": `<https://kalkspace.zammad.com/#ticket/zoom/${payload.ticket.id}|*${slackEscape(payload.ticket.title)}*>`,
            "verbatim": true
        }
    };

    const body = {
        "type": "section",
        "text": {
            "type": "plain_text",
            "text": payload.article.body,
        }
    };

    const blocks = [
        sender,
        header,
        body
    ];
    // Initialize
    const webhook = new IncomingWebhook(slackWebhookUrl);
    await webhook.send({
        attachments: [
            {
                blocks,
                "color": "#87ecc3",
            }
        ]
    });
    return {
        statusCode: 200,
    }
}