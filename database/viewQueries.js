/**
 * Community Hub - Profile view (visitor) prepared statements.
 */

const db = require("./database");

const addView = db.prepare(`
INSERT INTO profile_views (viewer_id, profile_id, created_at)
VALUES (?, ?, ?)
`);

const getRecentViewers = db.prepare(`
SELECT viewer_id, MAX(created_at) AS last_viewed, COUNT(*) AS views
FROM profile_views
WHERE profile_id = ?
GROUP BY viewer_id
ORDER BY last_viewed DESC
LIMIT ?
`);

const countViews = db.prepare(`
SELECT COUNT(*) AS count FROM profile_views WHERE profile_id = ?
`);

const countUniqueViewers = db.prepare(`
SELECT COUNT(DISTINCT viewer_id) AS count FROM profile_views WHERE profile_id = ?
`);

module.exports = {
    addView,
    getRecentViewers,
    countViews,
    countUniqueViewers
};
