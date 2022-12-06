const { htmlToText } = require("html-to-text");
const { findChannel, slackEscape, postMessage } = require("./utils/slack");
const { updateTicket } = require("./utils/zammad");

const COLOR_GREEN = "#87ecc3";
const COLOR_GRAY = "#bfbfbf";

/** @type {import("html-to-text").HtmlToTextOptions} */
const plaintextOptions = {
  selectors: [
    { selector: "a", options: { ignoreHref: true } },
    { selector: "img", format: "skip" },
  ],
};

/** @type {import("html-to-text").HtmlToTextOptions} */
const slackMarkdownOptions = {
  formatters: {
    // Create a formatter.
    slackLink: function (elem, walk, builder, formatOptions) {
      const href = elem.attribs?.href;
      if (!href) {
        walk(elem.children, builder);
      } else {
        const textBlobs = [];
        builder.pushWordTransform((str) => {
          if (str) {
            textBlobs.push(str);
          }
          return "";
        });
        walk(elem.children, builder);
        builder.popWordTransform();

        const text = textBlobs.join(" ");
        builder.addInline(
          !text || text == href
            ? `<${slackEscape(href)}>`
            : `<${slackEscape(href)}|${slackEscape(text)}>`,
          { noWordTransform: true }
        );
      }
    },
  },
  selectors: [
    { selector: "a", format: "slackLink" },
    { selector: "img", format: "skip" },
  ],
};

/**
 * @param {Zammad.User} sender
 * @returns {string}
 */
const formatUser = (sender) => {
  return `${sender.firstname} ${sender.lastname} (${sender.email})`;
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
        text: formatUser(ticket.customer),
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
  const truncatedBody = plainTextBody.replaceAll("\n", " ").substring(0, 300);
  /** @type {import("@slack/web-api").SectionBlock} */
  const body = {
    type: "section",
    text: {
      type: "plain_text",
      text: truncatedBody,
    },
  };
  return [sender, header, body];
};

/**
 * @param {Zammad.Webhook} payload
 * @returns {import("@slack/web-api").KnownBlock[]}
 */
const buildArticleBlocks = ({ ticket, article }) => {
  /** @type {import("@slack/web-api").SectionBlock} */
  const sender = {
    type: "section",
    text: {
      type: "mrkdwn",
      text: `<https://kalkspace.zammad.com/#ticket/zoom/${
        ticket.id
      }|*${slackEscape(formatUser(article.created_by))}*>`,
      verbatim: true,
    },
  };

  /** @type {import("@slack/web-api").SectionBlock} */
  let body;
  switch (article.content_type) {
    case "text/html": {
      const formattedBody = htmlToText(article.body, slackMarkdownOptions);
      body = {
        type: "section",
        text: {
          type: "mrkdwn",
          text: formattedBody,
          verbatim: true,
        },
      };
      break;
    }
    default: {
      body = {
        type: "section",
        text: {
          type: "plain_text",
          text: article.body,
        },
      };
    }
  }

  return [sender, body];
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
        color: COLOR_GREEN,
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

  await postMessage(channel.id, {
    thread_ts: message.ts,
    blocks: buildArticleBlocks(payload),
  });

  return {
    statusCode: 200,
  };
};
