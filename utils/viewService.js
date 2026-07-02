/**
 * Community Hub - Profile view service.
 * Combines daily view-limit enforcement with visitor tracking.
 */

const { addView } = require("../database/viewQueries");
const usage = require("./usageService");

/**
 * Record that `viewerId` looked at `profileId`.
 * Enforces the viewer's daily view quota (free tier) and logs the
 * visit for analytics / the visitors list.
 *
 * @returns {{ allowed: boolean, used: number, limit: number, remaining: number }}
 */
function recordView(viewerId, profileId) {
    // Never count viewing your own profile.
    if (viewerId === profileId) {
        return { allowed: true, used: 0, limit: Infinity, remaining: Infinity };
    }

    const quota = usage.consume(viewerId, "views");
    if (quota.allowed) {
        addView.run(viewerId, profileId, Date.now());
    }
    return quota;
}

module.exports = { recordView };
