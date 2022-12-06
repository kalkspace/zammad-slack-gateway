const { htmlToText } = require("html-to-text");
const { findChannel, slackEscape, postMessage } = require("./utils/slack");
const { updateTicket } = require("./utils/zammad");

/** @type {import("html-to-text").HtmlToTextOptions} */
const plaintextOptions = {
  selectors: [
    { selector: "a", options: { ignoreHref: true } },
    { selector: "img", format: "skip" },
  ],
};

/**
 * @param {Zammad.Webhook} payload
 * @returns {import("@slack/web-api").KnownBlock[]}
 */
const buildTicketBlocks = ({ ticket, article }) => {
  /** @type {import("@slack/web-api").ContextBlock} */
  const sender = {
    type: "context",
    elements: [
      {
        type: "plain_text",
        text: `${ticket.customer.firstname} ${ticket.customer.lastname} (${ticket.customer.email})`,
      },
    ],
  };
  /** @type {import("@slack/web-api").SectionBlock} */
  const header = {
    type: "section",
    text: {
      type: "mrkdwn",
      text: `<https://kalkspace.zammad.com/#ticket/zoom/${
        ticket.id
      }|*${slackEscape(ticket.title)}*>`,
      verbatim: true,
    },
  };

  const plainTextBody =
    article.content_type == "text/html"
      ? htmlToText(article.body, plaintextOptions)
      : article.body;
  /** @type {import("@slack/web-api").SectionBlock} */
  const body = {
    type: "section",
    text: {
      type: "plain_text",
      text: plainTextBody,
    },
  };
  return [sender, header, body];
};

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

  if (!request.body) {
    return { statusCode: 400 };
  }

  // TODO verify signature
  /** @type {Zammad.Webhook} */
  const payload = JSON.parse(request.body);

  const blocks = buildTicketBlocks(payload);
  const message = await postMessage(channel.id, {
    attachments: [
      {
        blocks,
        color: "#87ecc3",
      },
    ],
  });
  if (!message.ok) {
    console.error("failed to post message:", message.error);
    return { statusCode: 500 };
  }

  // persist reference to slack message in zammad
  await updateTicket(payload.ticket.id, {
    preferences: {
      slack_ts: message.ts,
    },
  });

  return {
    statusCode: 200,
  };
};
