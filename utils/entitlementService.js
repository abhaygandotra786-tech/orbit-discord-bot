/**
 * Orbit — Entitlement service
 * ------------------------------------------------------------------
 * The single source of truth for time-based tier entitlements.
 *
 *   grantTier(userId, tier, durationMs, { source })  // additive stacking
 *   checkTier(userId)                                 // highest active tier key
 *   entitlements(userId) / expiresAt(userId, tier)
 *   revokeTier(userId, tier)
 *   sweepExpired(onExpire)                            // call on a timer
 *
 * Rules honoured:
 *  - Earned time STACKS additively per tier (24h + 3d = 3d 24h).
 *  - A user can hold several tiers at once; the highest RANK wins.
 *  - Every grant/expiry is written to reward_audit for auditing.
 *  - Grants are safe to call repeatedly; callers make webhooks idempotent.
 */

const db = require("../database/database");
const config = require("../config/config");
const logger = require("./logger");

const TIERS = config.PREMIUM.TIERS;
const FREE = TIERS.free;

// tier key -> numeric rank (free 0 < premium 1 < pro 2)
const RANK = { free: 0 };
for (const [key, t] of Object.entries(TIERS)) RANK[key] = t.rank ?? 0;

// --- prepared statements ------------------------------------------
const upsertEnt = db.namedRun(
    `INSERT INTO entitlements (user_id, tier, expires_at, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, tier) DO UPDATE SET
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at`,
    ["user_id", "tier", "expires_at", "updated_at"]
);
const selEnt = db.prepare(`SELECT * FROM entitlements WHERE user_id = ? AND tier = ?`);
const selEntsForUser = db.prepare(`SELECT * FROM entitlements WHERE user_id = ?`);
const selExpired = db.prepare(`SELECT * FROM entitlements WHERE expires_at <= ?`);
const delEnt = db.namedRun(
    `DELETE FROM entitlements WHERE user_id = ? AND tier = ?`,
    ["user_id", "tier"]
);
const insAudit = db.namedRun(
    `INSERT INTO reward_audit (user_id, kind, detail, amount, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    ["user_id", "kind", "detail", "amount", "created_at"]
);

/** Write an audit row. Exposed so other reward modules log consistently. */
function audit(userId, kind, detail = null, amount = null) {
    insAudit.run({
        user_id: userId,
        kind,
        detail,
        amount,
        created_at: Date.now()
    });
}

/**
 * Grant `durationMs` of `tier`, stacking on top of any remaining time.
 * @returns {number} the new expiry (epoch ms)
 */
function grantTier(userId, tier, durationMs, { source = "system" } = {}) {
    if (!TIERS[tier] || tier === "free") {
        throw new Error(`Cannot grant tier "${tier}"`);
    }
    if (!(durationMs > 0)) throw new Error("durationMs must be > 0");

    const now = Date.now();
    const current = selEnt.get(userId, tier);
    // Stack from remaining time if still active, else from now.
    const base = current && current.expires_at > now ? current.expires_at : now;
    const expires = base + durationMs;

    upsertEnt.run({
        user_id: userId,
        tier,
        expires_at: expires,
        updated_at: now
    });

    audit(userId, "grant", `${tier}:+${Math.round(durationMs / 3600000)}h:${source}`, Math.round(durationMs / 1000));
    logger.info(`Entitlement: ${userId} +${Math.round(durationMs / 3600000)}h ${tier} (${source})`);
    return expires;
}

/** All currently-active entitlement rows for a user. */
function entitlements(userId) {
    const now = Date.now();
    return selEntsForUser.all(userId).filter((e) => e.expires_at > now);
}

/** Highest active tier key for a user ("free" if none). */
function checkTier(userId) {
    let best = "free";
    for (const e of entitlements(userId)) {
        if ((RANK[e.tier] ?? 0) > (RANK[best] ?? 0)) best = e.tier;
    }
    return best;
}

/** Full tier config object for a user's highest active tier. */
function meta(userId) {
    return TIERS[checkTier(userId)] || FREE;
}

/** Expiry (epoch ms) of a specific tier for a user, or 0 if none/expired. */
function expiresAt(userId, tier) {
    const row = selEnt.get(userId, tier);
    if (!row) return 0;
    return row.expires_at > Date.now() ? row.expires_at : 0;
}

/** Does the user's highest active tier include a capability? */
function has(userId, capability) {
    return (meta(userId).capabilities || []).includes(capability);
}

/** Is the user any paid tier right now? */
function isPaid(userId) {
    return checkTier(userId) !== "free";
}

/** Remove a specific tier entitlement (e.g. payment refund/chargeback). */
function revokeTier(userId, tier) {
    delEnt.run({ user_id: userId, tier });
    audit(userId, "revoke", tier);
}

/**
 * Remove expired entitlements. For each one, calls `onExpire(userId, tier)`
 * ONCE so the caller can send a single polite "earn it back" DM.
 * Returns the number of entitlements that expired.
 */
function sweepExpired(onExpire) {
    const now = Date.now();
    const expired = selExpired.all(now);
    for (const e of expired) {
        delEnt.run({ user_id: e.user_id, tier: e.tier });
        audit(e.user_id, "expiry", e.tier);
        // Only notify if they don't still hold an equal/higher tier.
        const stillHas = (RANK[checkTier(e.user_id)] ?? 0) >= (RANK[e.tier] ?? 0);
        if (!stillHas && typeof onExpire === "function") {
            try {
                onExpire(e.user_id, e.tier);
            } catch (err) {
                logger.error("onExpire handler failed", err);
            }
        }
    }
    return expired.length;
}

module.exports = {
    RANK,
    audit,
    grantTier,
    entitlements,
    checkTier,
    meta,
    expiresAt,
    has,
    isPaid,
    revokeTier,
    sweepExpired
};
