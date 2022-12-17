/**
 * Returns a header value based on a name case-insensitive.
 *
 * @template T
 * @param {Record<string, T>} headers
 * @param {string} name
 * @returns {T | undefined}
 */
exports.getHeader = (headers, name) => {
  const nameLower = name.toLowerCase();
  const [_, v] =
    Object.entries(headers).find(([k, _]) => k.toLowerCase() == nameLower) ??
    [];
  return v;
};
