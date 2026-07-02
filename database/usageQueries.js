/**
 * Community Hub - Daily usage prepared statements.
 * Tracks per-user, per-action counts bucketed by day (UTC YYYY-MM-DD).
 */

const db = require("./database");

const incrementUsage = db.prepare(`
INSERT INTO daily_usage (user_id, action, day, count)
VALUES (@user_id, @action, @day, 1)
ON CONFLICT(user_id, action, day) DO UPDATE SET count = count + 1
`);

const getUsage = db.prepare(`
SELECT count FROM daily_usage WHERE user_id = ? AND action = ? AND day = ?
`);

module.exports = {
    incrementUsage,
    getUsage
};
