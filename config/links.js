/**
 * @deprecated Use config/config.js instead.
 * Kept for backward compatibility — re-exports from the master config.
 */
const config = require("./config");

module.exports = {
    WEBSITE: config.WEBSITE,
    DISCORD: config.SUPPORT_SERVER,
    GITHUB: "",
    LINKEDIN: "",
    TWITTER: ""
};
