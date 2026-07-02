/**
 * @deprecated Use config/config.js instead.
 * Kept for backward compatibility — re-exports from the master config.
 */
const config = require("./config");

module.exports = {
    BOT_NAME: config.BOT_NAME,
    EMBED_COLOR: config.EMBED_COLOR,
    FOOTER: config.FOOTER
};
