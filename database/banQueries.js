/**
 * Community Hub - Ban prepared statements
 */

const db = require("./database");

const banUser = db.prepare(`
INSERT INTO banned_users (user_id, reason, banned_by)
VALUES (@user_id, @reason, @banned_by)
ON CONFLICT(user_id) DO UPDATE SET
    reason    = excluded.reason,
    banned_by = excluded.banned_by,
    timestamp = CURRENT_TIMESTAMP
`);

const unbanUser = db.prepare(`DELETE FROM banned_users WHERE user_id = ?`);

const getBan = db.prepare(`SELECT * FROM banned_users WHERE user_id = ?`);

const getAllBans = db.prepare(`
SELECT * FROM banned_users ORDER BY timestamp DESC
`);

/** Convenience boolean check. */
function isBanned(userId) {
    return Boolean(getBan.get(userId));
}

module.exports = {
    banUser,
    unbanUser,
    getBan,
    getAllBans,
    isBanned
};
