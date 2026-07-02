/**
 * Community Hub - Daily usage / rate-limit service.
 * Enforces free-tier daily caps; premium/pro are unlimited.
 */

const { incrementUsage, getUsage } = require("../database/usageQueries");
const premium = require("./premiumService");

/** UTC day bucket, e.g. "2026-06-18". */
function today() {
    return new Date().toISOString().slice(0, 10);
}

function used(userId, action) {
    const row = getUsage.get(userId, action, today());
    return row ? row.count : 0;
}

/**
 * Check (without consuming) whether the user may perform an action.
 * @returns {{ allowed: boolean, used: number, limit: number, remaining: number }}
 */
function check(userId, action) {
    const limit = premium.limit(userId, action);
    if (limit === Infinity) {
        return { allowed: true, used: 0, limit: Infinity, remaining: Infinity };
    }
    const u = used(userId, action);
    return {
        allowed: u < limit,
        used: u,
        limit,
        remaining: Math.max(0, limit - u)
    };
}

/**
 * Attempt to consume one unit of quota. Increments on success.
 * @returns same shape as check(), reflecting the post-increment count.
 */
function consume(userId, action) {
    const result = check(userId, action);
    if (result.limit === Infinity) return result;
    if (!result.allowed) return result;

    incrementUsage.run({ user_id: userId, action, day: today() });
    const u = result.used + 1;
    return {
        allowed: true,
        used: u,
        limit: result.limit,
        remaining: Math.max(0, result.limit - u)
    };
}

module.exports = { check, consume, used, today };
