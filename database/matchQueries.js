/**
 * Community Hub - Match prepared statements
 * Matches are stored with the lexicographically-smaller id as user1
 * so the UNIQUE(user1, user2) constraint prevents duplicates.
 */

const db = require("./database");

const insertMatch = db.prepare(`
INSERT OR IGNORE INTO matches (user1, user2) VALUES (?, ?)
`);

const matchExistsStmt = db.prepare(`
SELECT * FROM matches WHERE user1 = ? AND user2 = ?
`);

const getMatchesStmt = db.prepare(`
SELECT * FROM matches WHERE user1 = ? OR user2 = ? ORDER BY created_at DESC
`);

const deleteMatchStmt = db.prepare(`
DELETE FROM matches WHERE user1 = ? AND user2 = ?
`);

const countMatches = db.prepare(`SELECT COUNT(*) AS count FROM matches`);

/** Normalize a pair so the smaller id is always first. */
function normalize(a, b) {
    return a < b ? [a, b] : [b, a];
}

function createMatch(a, b) {
    const [u1, u2] = normalize(a, b);
    return insertMatch.run(u1, u2);
}

function matchExists(a, b) {
    const [u1, u2] = normalize(a, b);
    return matchExistsStmt.get(u1, u2);
}

function getMatches(userId) {
    return getMatchesStmt.all(userId, userId);
}

function deleteMatch(a, b) {
    const [u1, u2] = normalize(a, b);
    return deleteMatchStmt.run(u1, u2);
}

/** Given a match row, return the id of the other participant. */
function otherUser(match, userId) {
    return match.user1 === userId ? match.user2 : match.user1;
}

module.exports = {
    createMatch,
    matchExists,
    getMatches,
    deleteMatch,
    otherUser,
    countMatches
};
