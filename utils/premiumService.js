/**
 * Community Hub - Premium service
 * ------------------------------------------------------------------
 * The single source of truth for subscription state, tier metadata,
 * capability checks, daily limits and visibility ranking.
 */

const {
    upsertSubscription,
    getSubscription,
    deleteSubscription
} = require("../database/subscriptionQueries");
const config = require("../config/config");
const logger = require("./logger");

const TIERS = config.PREMIUM.TIERS;
const FREE = TIERS.free;

/**
 * Active (non-expired) subscription row, or null. Expired rows are
 * cleaned up lazily.
 */
function getActive(userId) {
    const sub = getSubscription.get(userId);
    if (!sub) return null;
    if (sub.expires_at <= Date.now()) {
        deleteSubscription.run(userId);
        return null;
    }
    return sub;
}

/** Resolve the tier key for a user: "free" | "premium" | "pro". */
function tierKey(userId) {
    const sub = getActive(userId);
    if (!sub) return "free";
    return TIERS[sub.tier] ? sub.tier : "free";
}

/** Resolve the full tier config object for a user (free by default). */
function meta(userId) {
    return TIERS[tierKey(userId)] || FREE;
}

/** Is the user any paid tier? */
function isPremium(userId) {
    return tierKey(userId) !== "free";
}

/** Does the user's tier include a capability? */
function has(userId, capability) {
    return meta(userId).capabilities.includes(capability);
}

/** Numeric visibility rank (free 0 < premium 1 < pro 2). */
function rank(userId) {
    return meta(userId).rank || 0;
}

/** Daily limit for an action ("views" | "likes" | "searches"); Infinity if unlimited. */
function limit(userId, action) {
    const value = meta(userId).limits?.[action];
    return value === null || value === undefined ? Infinity : value;
}

/** Badge emoji for inline use (e.g. next to a name). "" for free. */
function badge(userId) {
    const m = meta(userId);
    return m.emoji ? ` ${m.emoji}` : "";
}

/** Full badge label e.g. "👑 Premium Member". "" for free. */
function badgeLabel(userId) {
    return meta(userId).badge || "";
}

/**
 * Visibility weight for ordering a profile in browse/search results.
 * Pro > Premium > Free, with a bonus for an active "featured" boost.
 */
function visibilityWeight(profile) {
    const tier = TIERS[tierKey(profile.user_id)] || FREE;
    let weight = (tier.rank || 0) * 100;
    if (profile.featured && profile.featured_until > Date.now()) {
        weight += 1000; // featured profiles surface to the very top
    }
    return weight;
}

/**
 * Grant a subscription. Stacks remaining time when renewing the same tier.
 */
function grant(userId, tierKeyName, days, grantedBy = null) {
    const tier = TIERS[tierKeyName];
    if (!tier || tierKeyName === "free") {
        throw new Error(`Cannot grant tier: ${tierKeyName}`);
    }

    const now = Date.now();
    const existing = getActive(userId);
    const base =
        existing && existing.tier === tierKeyName ? existing.expires_at : now;

    const durationDays = days ?? tier.durationDays;
    const expires = base + durationDays * 24 * 60 * 60 * 1000;

    upsertSubscription.run({
        user_id: userId,
        tier: tierKeyName,
        started_at: existing ? existing.started_at : now,
        expires_at: expires,
        granted_by: grantedBy
    });

    logger.admin(
        `Premium granted: ${userId} -> ${tierKeyName} for ${durationDays}d by ${grantedBy || "system"}`
    );
    return getSubscription.get(userId);
}

function revoke(userId) {
    deleteSubscription.run(userId);
    logger.admin(`Premium revoked: ${userId}`);
}

module.exports = {
    getActive,
    tierKey,
    meta,
    isPremium,
    has,
    rank,
    limit,
    badge,
    badgeLabel,
    visibilityWeight,
    grant,
    revoke
};
