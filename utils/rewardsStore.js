/**
 * Orbit - small DB helpers for match credits, badges, and review flags.
 * Kept separate so voteService and referralService share one place.
 */
const db = require("../database/database");

/* ---- match credits ---- */
const _addCredits = db.namedRun(
    `INSERT INTO match_credits (user_id, balance, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET balance = balance + excluded.balance, updated_at = excluded.updated_at`,
    ["user_id", "balance", "updated_at"]
);
const _getCredits = db.prepare(`SELECT balance FROM match_credits WHERE user_id = ?`);

const credits = {
    add(userId, n) {
        if (!n) return;
        _addCredits.run({ user_id: userId, balance: n, updated_at: Date.now() });
    },
    balance(userId) {
        const r = _getCredits.get(userId);
        return r ? r.balance : 0;
    }
};

/* ---- badges ---- */
const _grantBadge = db.namedRun(
    `INSERT OR IGNORE INTO reward_badges (user_id, badge, granted_at) VALUES (?, ?, ?)`,
    ["user_id", "badge", "granted_at"]
);
const _listBadges = db.prepare(`SELECT badge FROM reward_badges WHERE user_id = ?`);
const _hasBadge = db.prepare(`SELECT 1 AS x FROM reward_badges WHERE user_id = ? AND badge = ?`);

const badges = {
    grant(userId, badge) {
        _grantBadge.run({ user_id: userId, badge, granted_at: Date.now() });
    },
    list(userId) {
        return _listBadges.all(userId).map((r) => r.badge);
    },
    has(userId, badge) {
        return Boolean(_hasBadge.get(userId, badge));
    }
};

/* ---- review flags (never auto-ban) ---- */
const _addFlag = db.namedRun(
    `INSERT INTO reward_flags (user_id, reason, detail, resolved, created_at) VALUES (?, ?, ?, 0, ?)`,
    ["user_id", "reason", "detail", "created_at"]
);
const _openFlags = db.prepare(`SELECT * FROM reward_flags WHERE resolved = 0 ORDER BY created_at DESC LIMIT 50`);

const flags = {
    add(userId, reason, detail = null) {
        _addFlag.run({ user_id: userId, reason, detail, created_at: Date.now() });
    },
    open() {
        return _openFlags.all();
    }
};

module.exports = { credits, badges, flags };
