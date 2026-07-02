/**
 * Community Hub - Browse session store
 * ------------------------------------------------------------------
 * In-memory, per-user pagination state for profile browsing.
 * Sessions expire automatically after a configurable TTL.
 */

const config = require("../config/config");

const sessions = new Map();

/**
 * Save a browse session for a user.
 * @param {string} userId
 * @param {object[]} profiles  ordered list of profile rows
 * @param {string} context     label e.g. "browse", "dating", "networking"
 */
function setSession(userId, profiles, context) {
    sessions.set(userId, {
        profiles,
        index: 0,
        context,
        expiresAt: Date.now() + config.LIMITS.SESSION_TTL_MS
    });
}

function getSession(userId) {
    const session = sessions.get(userId);
    if (!session) return null;

    if (Date.now() > session.expiresAt) {
        sessions.delete(userId);
        return null;
    }
    return session;
}

/**
 * Move the cursor and return the new current profile.
 * @param {string} userId
 * @param {number} delta  -1 (prev) or +1 (next)
 */
function move(userId, delta) {
    const session = getSession(userId);
    if (!session) return null;

    const len = session.profiles.length;
    session.index = (session.index + delta + len) % len;
    session.expiresAt = Date.now() + config.LIMITS.SESSION_TTL_MS;

    return current(userId);
}

function current(userId) {
    const session = getSession(userId);
    if (!session) return null;

    return {
        profile: session.profiles[session.index],
        index: session.index,
        total: session.profiles.length,
        context: session.context
    };
}

function clearSession(userId) {
    sessions.delete(userId);
}

// Periodic cleanup of expired sessions.
setInterval(() => {
    const now = Date.now();
    for (const [userId, session] of sessions) {
        if (now > session.expiresAt) sessions.delete(userId);
    }
}, 60 * 1000).unref();

module.exports = {
    setSession,
    getSession,
    move,
    current,
    clearSession
};
