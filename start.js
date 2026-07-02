/**
 * Orbit - combined entry point.
 * Runs the Discord bot AND the website in a single process, which is
 * what a single Koyeb service needs. The website also gives Koyeb an
 * HTTP port for health checks / uptime pings (keeps the bot awake).
 *
 *   node start.js
 */

require("./index.js"); // Discord bot (logs in)
require("./web/server.js"); // Express website (listens on PORT)
