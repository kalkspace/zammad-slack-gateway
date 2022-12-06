const { WebClient: SlackClient } = require("@slack/web-api");

const slackClient = new SlackClient(process.env.SLACK_TOKEN);

/**
 * @param {string} text
 * @returns {string}
 */
exports.slackEscape = (text) => {
  text = text.replaceAll("&", "&amp;");
  text = text.replaceAll("<", "&lt;");
  text = text.replaceAll(">", "&gt;");
  return text;
};

/** @typedef {import("@slack/web-api").ConversationsInfoResponse["channel"]} Channel */

/**
 * @param {string} name
 * @return {Promise<Channel>}
 */
exports.findChannel = async (name) => {
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

/**
 * @param {string} channel
 * @param {Omit<import("@slack/web-api").ChatPostMessageArguments, "channel">} options
 * @returns {Promise<import("@slack/web-api").ChatPostMessageResponse>}
 */
exports.postMessage = async (channel, options) => {
  return slackClient.chat.postMessage({
    channel,
    ...options,
  });
};
