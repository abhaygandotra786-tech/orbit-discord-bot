/**
 * @deprecated Use config/config.js instead.
 * Kept for backward compatibility — re-exports from the master config.
 */
const config = require("./config");

module.exports = {
    LOGO_URL: config.LOGO_URL,
    BANNER_URL: ""
};
