/**
 * Orbit - Premium service
 * ------------------------------------------------------------------
 * Public API is unchanged, but the source of truth is now the
 * entitlementService (time-based, stackable, multi-tier). Votes,
 * referrals, admin grants and payments all flow through the same place.
 */

const config = require("../config/config");
const logger = require("./logger");
const ent = require("./entitlementService");

const TIERS = config.PREMIUM.TIERS;
const FREE = TIERS.free;
const DAY = 24 * 60 * 60 * 1000;

/** Active (highest) tier as a subscription-like row, or null for free. */
function getActive(userId) {
    const tier = ent.checkTier(userId);
    if (tier === "free") return null;
    return { user_id: userId, tier, expires_at: ent.expiresAt(userId, tier) };
}

/** Resolve the tier key for a user: "free" | "pro" | "premium". */
function tierKey(userId) {
    return ent.checkTier(userId);
}

/** Full tier config object for a user (free by default). */
function meta(userId) {
    return TIERS[tierKey(userId)] || FREE;
}

function isPremium(userId) {
    return tierKey(userId) !== "free";
}

function has(userId, capability) {
    return (meta(userId).capabilities || []).includes(capability);
}

function rank(userId) {
    return meta(userId).rank || 0;
}

/** Daily limit for an action; Infinity if unlimited. */
function limit(userId, action) {
    const value = meta(userId).limits?.[action];
    return value === null || value === undefined ? Infinity : value;
}

function badge(userId) {
    const m = meta(userId);
    return m.emoji ? ` ${m.emoji}` : "";
}

function badgeLabel(userId) {
    return meta(userId).badge || "";
}

function visibilityWeight(profile) {
    const tier = TIERS[tierKey(profile.user_id)] || FREE;
    let weight = (tier.rank || 0) * 100;
    if (profile.featured && profile.featured_until > Date.now()) weight += 1000;
    return weight;
}

/**
 * Grant a tier for `days` (defaults to the tier's duration). Stacks time.
 * Used by admin commands, the Dodo webhook, and reward services.
 */
function grant(userId, tierKeyName, days, grantedBy = null) {
    const tier = TIERS[tierKeyName];
    if (!tier || tierKeyName === "free") {
        throw new Error(`Cannot grant tier: ${tierKeyName}`);
    }
    const durationDays = days ?? tier.durationDays;
    ent.grantTier(userId, tierKeyName, durationDays * DAY, { source: grantedBy || "grant" });
    logger.admin(`Premium granted: ${userId} -> ${tierKeyName} for ${durationDays}d by ${grantedBy || "system"}`);
    return getActive(userId);
}

/** Revoke all tier entitlements for a user (e.g. cancellation/refund). */
function revoke(userId) {
    for (const e of ent.entitlements(userId)) ent.revokeTier(userId, e.tier);
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
