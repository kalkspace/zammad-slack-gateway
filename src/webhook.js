const { WebClient: SlackClient } = require("@slack/web-api");

const groupToSlackChannel = {
  Users: "notify-zammad",
};

const slackEscape = (text) => {
  text = text.replaceAll("&", "&amp;");
  text = text.replaceAll("<", "&lt;");
  text = text.replaceAll(">", "&gt;");
  return text;
};

const slackClient = new SlackClient(process.env.SLACK_TOKEN);

/** @typedef {import("@slack/web-api").ConversationsInfoResponse["channel"]} Channel */

/**
 * @param {string} name
 * @return {Promise<Channel>}
 */
const findChannel = async (name) => {
  const { channels } = await slackClient.conversations.list({
    types: "public_channel,private_channel",
  });
  if (!channels) {
    return;
  }
  for (const channel of channels) {
    if (channel.name == name) {
      return channel;
    }
  }
};

/** @type {import("@netlify/functions").Handler} */
exports.handler = async (request) => {
  // TODO verify signature
  const payload = JSON.parse(request.body);
  const groupName = payload.ticket.group.name;
  const channelName = groupToSlackChannel[groupName];
  if (!channelName) {
    console.error("found no channel for Zammad group:", groupName);
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

  await slackClient.chat.postMessage({
    channel: channel.id,
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
