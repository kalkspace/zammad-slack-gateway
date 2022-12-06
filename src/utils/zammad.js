const { default: fetch } = require("node-fetch");

const ZAMMAD_DOMAIN = "kalkspace.zammad.com";

/**
 * @param {string | number} id
 * @param {Partial<Zammad.Ticket>} update
 * @returns {Promise<void>}
 */
exports.updateTicket = async (id, update) => {
  const resp = await fetch(`https://${ZAMMAD_DOMAIN}/api/v1/tickets/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token token=${process.env.ZAMMAD_TOKEN}`,
    },
    body: JSON.stringify(update),
  });
  if (!resp.ok) {
    throw new Error(`Failed to fetch (${resp.status}): ${await resp.text()}`);
  }
};
