/**
 * Community Hub - Daily usage prepared statements.
 * Tracks per-user, per-action counts bucketed by day (UTC YYYY-MM-DD).
 */

const db = require("./database");

const incrementUsage = db.namedRun(
    `INSERT INTO daily_usage (user_id, action, day, count)
     VALUES (?, ?, ?, 1)
     ON CONFLICT(user_id, action, day) DO UPDATE SET count = count + 1`,
    ["user_id", "action", "day"]
);

const getUsage = db.prepare(`
SELECT count FROM daily_usage WHERE user_id = ? AND action = ? AND day = ?
`);

module.exports = {
    incrementUsage,
    getUsage
};
