const { findChannel, slackEscape, postMessage } = require("./utils/slack");

/** @type {import("@netlify/functions").Handler} */
exports.handler = async (request) => {
  const channelName = request.queryStringParameters?.channel;
  if (!channelName) {
    console.error("no channel given in the query string");
    return {
      statusCode: 404,
    };
  }
  const channel = await findChannel(channelName);
  if (!channel?.id) {
    console.error("unable to find slack channel:", channelName);
    return {
      statusCode: 404,
    };
  }

  // TODO verify signature
  const payload = JSON.parse(request.body ?? "{}");

  const sender = {
    type: "context",
    elements: [
      {
        type: "plain_text",
        text: `${payload.ticket.customer.firstname} ${payload.ticket.customer.lastname} (${payload.ticket.customer.email})`,
      },
    ],
  };
  const header = {
    type: "section",
    text: {
      type: "mrkdwn",
      text: `<https://kalkspace.zammad.com/#ticket/zoom/${
        payload.ticket.id
      }|*${slackEscape(payload.ticket.title)}*>`,
      verbatim: true,
    },
  };
  const body = {
    type: "section",
    text: {
      type: "plain_text",
      text: payload.article.body,
    },
  };
  const blocks = [sender, header, body];

  await postMessage(channel.id, {
    attachments: [
      {
        blocks,
        color: "#87ecc3",
      },
    ],
  });
  return {
    statusCode: 200,
  };
};
