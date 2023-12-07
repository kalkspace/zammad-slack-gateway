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
  let cursor;
  while (true) {
    const { channels, response_metadata } =
      await slackClient.conversations.list({
        types: "public_channel,private_channel",
        cursor,
      });
    if (!channels || channels.length == 0) {
      return;
    }
    for (const channel of channels) {
      if (channel.name == name) {
        return channel;
      }
    }

    cursor = response_metadata?.next_cursor;
    if (!cursor) {
      return;
    }
  }
};

/**
 * @param {string} channel
 * @param {Omit<import("@slack/web-api").ChatPostMessageArguments, "channel">} options
 * @returns {Promise<import("@slack/web-api").ChatPostMessageResponse>}
 */
exports.postMessage = async (channel, options) => {
  const resp = await slackClient.chat.postMessage({
    channel,
    unfurl_links: false,
    unfurl_media: false,
    ...options,
  });
  if (!resp.ok) {
    console.error("failed to post message:", resp.error);
    throw new Error("failed to post message");
  }
  return resp;
};

/**
 * @param {string} channel
 * @param {string} ts
 * @returns {Promise<ArrayElement<import("@slack/web-api").ConversationsHistoryResponse["messages"]> | undefined>}
 */
exports.fetchSingleMessage = async (channel, ts) => {
  const resp = await slackClient.conversations.history({
    channel,
    oldest: ts,
    inclusive: true,
    limit: 1,
  });
  if (!resp.ok) {
    console.error("failed to fetch message:", resp.error);
    throw new Error("failed to fetch message");
  }
  return resp.messages?.[0];
};
