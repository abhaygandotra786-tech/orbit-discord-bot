/**
 * Community Hub - Subscription prepared statements
 * Subscriptions are stored with epoch-ms timestamps for easy expiry checks.
 */

const db = require("./database");

const upsertSubscription = db.prepare(`
INSERT INTO subscriptions (user_id, tier, started_at, expires_at, granted_by)
VALUES (@user_id, @tier, @started_at, @expires_at, @granted_by)
ON CONFLICT(user_id) DO UPDATE SET
    tier       = excluded.tier,
    started_at = excluded.started_at,
    expires_at = excluded.expires_at,
    granted_by = excluded.granted_by
`);

const getSubscription = db.prepare(`SELECT * FROM subscriptions WHERE user_id = ?`);

const deleteSubscription = db.prepare(`DELETE FROM subscriptions WHERE user_id = ?`);

const countActiveSubscriptions = db.prepare(`
SELECT COUNT(*) AS count FROM subscriptions WHERE expires_at > ?
`);

module.exports = {
    upsertSubscription,
    getSubscription,
    deleteSubscription,
    countActiveSubscriptions
};
