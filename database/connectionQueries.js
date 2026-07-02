/**
 * Community Hub - Connection request prepared statements.
 */

const db = require("./database");

const createConnection = db.prepare(`
INSERT INTO connections (requester_id, target_id, status, created_at)
VALUES (@requester_id, @target_id, 'pending', @created_at)
ON CONFLICT(requester_id, target_id) DO UPDATE SET
    status     = 'pending',
    created_at = excluded.created_at
`);

const getConnection = db.prepare(`
SELECT * FROM connections WHERE requester_id = ? AND target_id = ?
`);

const setStatus = db.prepare(`
UPDATE connections SET status = ? WHERE requester_id = ? AND target_id = ?
`);

const getPendingForUser = db.prepare(`
SELECT * FROM connections
WHERE target_id = ? AND status = 'pending'
ORDER BY created_at DESC
`);

const getAcceptedForUser = db.prepare(`
SELECT * FROM connections
WHERE (requester_id = ? OR target_id = ?) AND status = 'accepted'
ORDER BY created_at DESC
`);

module.exports = {
    createConnection,
    getConnection,
    setStatus,
    getPendingForUser,
    getAcceptedForUser
};
