/**
 * Community Hub - Likes prepared statements
 */

const db = require("./database");

const addLike = db.prepare(`
INSERT INTO likes (sender_id, receiver_id) VALUES (?, ?)
`);

const removeLike = db.prepare(`
DELETE FROM likes WHERE sender_id = ? AND receiver_id = ?
`);

const hasLiked = db.prepare(`
SELECT * FROM likes WHERE sender_id = ? AND receiver_id = ?
`);

const getSentLikes = db.prepare(`SELECT * FROM likes WHERE sender_id = ?`);

const getReceivedLikes = db.prepare(`SELECT * FROM likes WHERE receiver_id = ?`);

const countLikes = db.prepare(`SELECT COUNT(*) AS count FROM likes`);

const countLikesToday = db.prepare(`
SELECT COUNT(*) AS count FROM likes
WHERE sender_id = ? AND DATE(created_at) = DATE('now')
`);

module.exports = {
    addLike,
    removeLike,
    hasLiked,
    getSentLikes,
    getReceivedLikes,
    countLikes,
    countLikesToday
};
