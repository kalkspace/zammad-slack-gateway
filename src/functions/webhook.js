const { htmlToText } = require("html-to-text");
const { getHeader } = require("../utils/http");
const {
  findChannel,
  slackEscape,
  postMessage,
  fetchSingleMessage,
} = require("../utils/slack");
const { updateTicket, getTicket, imageURL } = require("../utils/zammad");
const { createHmac } = require("crypto");

const COLOR_GREEN = "#87ecc3";
const COLOR_GRAY = "#bfbfbf";

/** @type {HtmlToTextOptionsExtended} */
const plaintextOptions = {
  selectors: [
    { selector: "a", options: { ignoreHref: true } },
    { selector: "img", format: "skip" },
  ],
};

/** @type {HtmlToTextOptionsExtended} */
const slackMarkdownOptions = {
  formatters: {
    slackBold: (elem, walk, builder, formatOptions) => {
      builder.addInline("*");
      walk(elem.children, builder);
      builder.addInline("*");
    },
    slackItalic: (elem, walk, builder, formatOptions) => {
      builder.addInline("_");
      walk(elem.children, builder);
      builder.addInline("_");
    },
    slackLink: (elem, walk, builder, formatOptions) => {
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
    { selector: "b", format: "slackBold" },
    { selector: "strong", format: "slackBold" },
    { selector: "i", format: "slackItalic" },
    { selector: "em", format: "slackItalic" },
    { selector: "a", format: "slackLink" },
    { selector: "img", format: "skip" },
  ],
  encodeCharacters: {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
  },
};

/**
 * @param {Zammad.User} sender
 * @param {string=} type
 * @returns {string}
 */
const formatUser = (sender, type) => {
  return `${sender.firstname} ${sender.lastname} (${type || sender.email})`;
};

/**
 * @param {Zammad.User} user
 * @returns {import("@slack/types").ImageElement[]}
 */
const buildAvatarElement = (user) => {
  if (!user.image) {
    return [];
  }
  return [
    {
      type: "image",
      alt_text: `Avatar for ${user.email}`,
      image_url: imageURL(user.image),
    },
  ];
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
      ...buildAvatarElement(ticket.customer),
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

const iconForAttachment = (mimeType) => {
  if (!mimeType) {
    return "paperclip";
  }
  if (mimeType.startsWith("image/")) {
    return "frame_with_picture";
  }
  if (mimeType.startsWith("text/")) {
    return "memo";
  }
  if (mimeType.startsWith("application/")) {
    return "closed_book";
  }
  return "paperclip";
};

/**
 * @param {Zammad.Webhook} payload
 * @returns {import("@slack/web-api").KnownBlock[]}
 */
const buildArticleBlocks = ({ ticket, article }) => {
  const actor = article.created_by || ticket.customer;
  if (!actor) {
    return [];
  }

  const userText =
    article.sender === "Agent" ? formatUser(actor, "Agent") : formatUser(actor);

  /** @type {import("@slack/web-api").ContextBlock} */
  const sender = {
    type: "context",
    elements: [
      ...buildAvatarElement(actor),
      /** @type {import("@slack/web-api").MrkdwnElement} */ {
        type: "mrkdwn",
        text: `<https://kalkspace.zammad.com/#ticket/zoom/${
          ticket.id
        }|${slackEscape(userText)}>`,
        verbatim: true,
      },
    ],
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
          text: formattedBody.substring(0, 3000),
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
          text: article.body?.substring(0, 3000),
        },
      };
    }
  }

  /** @type {import("@slack/web-api").KnownBlock[]} */
  const attachments = [];

  if (article.attachments && article.attachments.length > 0) {
    attachments.push(
      { type: "divider" },
      {
        type: "context",
        elements: [{ type: "plain_text", text: "Attachments" }],
      }
    );
    for (const attachment of article.attachments) {
      const icon = iconForAttachment(attachment.preferences["Mime-Type"]);
      attachments.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:${icon}: <${attachment.url}|${slackEscape(
            attachment.filename
          )}>`,
        },
      });
    }
  }

  return [sender, body, ...attachments];
};

/**
 * @param {string} channel_id
 * @param {Zammad.Webhook} payload
 * @returns {Promise<import("@slack/web-api").ChatPostMessageResponse>}
 */
const startSlackThread = async (channel_id, payload) => {
  const blocks = buildTicketBlocks(payload);
  return postMessage(channel_id, {
    attachments: [
      {
        blocks,
        color: COLOR_GREEN,
      },
    ],
  });
};

/** @type {import("@netlify/functions").Handler} */
exports.handler = async (request) => {
  const signature = getHeader(request.headers, "x-hub-signature");
  if (!signature) {
    return { statusCode: 401 };
  }
  if (!request.body) {
    return { statusCode: 400 };
  }
  if (!process.env.WEBHOOK_SIGNATURE_SECRET) {
    throw new Error("Missing WEBHOOK_SIGNATURE_SECRET env var.");
  }
  const hmac = createHmac("sha1", process.env.WEBHOOK_SIGNATURE_SECRET);
  hmac.update(request.body);
  const expectedSignature = `sha1=${hmac.digest("hex")}`;
  console.log({ signature, expectedSignature });
  if (signature !== expectedSignature) {
    return { statusCode: 401 };
  }

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

  /** @type {Zammad.Webhook} */
  const payload = JSON.parse(request.body);
  const { article, ticket } = payload;

  // re-fetch ticket since preferences are filtered on the webhook payload
  /** @type {{ preferences: SpecialPreferences }} */
  const { preferences } = await getTicket(ticket.id);
  if (!preferences) {
    throw new Error("Ticket not found");
  }

  let message;
  if (preferences.slack_gateway?.ts) {
    message = await fetchSingleMessage(
      channel.id,
      preferences.slack_gateway.ts
    );
  }
  if (!message) {
    // also starts a new thread if we couldn't find the message for some reason
    message = await startSlackThread(channel.id, payload);
  }

  if (preferences.slack_gateway?.last_article_seen === article.id) {
    // we've already posted this
    // todo: find out what changed since we last saw the article
    console.info("no new article found");
  } else {
    await postMessage(channel.id, {
      thread_ts: message.ts,
      blocks: buildArticleBlocks(payload),
    });
  }

  // persist reference to slack message in zammad after completing posting
  await updateTicket(ticket.id, {
    preferences: /** @type {SpecialPreferences} */ ({
      slack_gateway: {
        ts: message.ts,
        last_article_seen: article.id,
      },
    }),
  });

  return {
    statusCode: 200,
  };
};
