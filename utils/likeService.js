/**
 * Community Hub - Like service
 * ------------------------------------------------------------------
 * Centralizes the "like" logic so both the /like command and the
 * browse "Like" button behave identically, including match creation.
 */

const { addLike, hasLiked, countLikesToday } = require("../database/likesQueries");
const { matchExists, createMatch } = require("../database/matchQueries");
const premium = require("./premiumService");
const logger = require("./logger");

/**
 * Whether a user may send another like right now.
 * Premium/Pro are unlimited; free users get a daily cap.
 * @returns {{ allowed: boolean, used: number, limit: number, remaining: number }}
 */
function canLike(userId) {
    const limit = premium.limit(userId, "likes");
    if (limit === Infinity) {
        return { allowed: true, used: 0, limit: Infinity, remaining: Infinity };
    }
    const used = countLikesToday.get(userId).count;
    return {
        allowed: used < limit,
        used,
        limit,
        remaining: Math.max(0, limit - used)
    };
}

/**
 * Record a like from sender -> receiver.
 * @returns {{ ok: boolean, reason?: string, limited?: boolean, matched?: boolean }}
 */
function like(senderId, receiverId) {
    if (senderId === receiverId) {
        return { ok: false, reason: "You cannot like yourself." };
    }

    if (hasLiked.get(senderId, receiverId)) {
        return { ok: false, reason: "You have already liked this user." };
    }

    // Free-tier daily like limit (premium members are unlimited).
    const quota = canLike(senderId);
    if (!quota.allowed) {
        return {
            ok: false,
            limited: true,
            reason:
                `You've reached your daily limit of **${quota.limit}** likes.\n` +
                `Upgrade to **Premium** for unlimited likes — use \`/premium plans\`.`
        };
    }

    addLike.run(senderId, receiverId);
    logger.like(`${senderId} liked ${receiverId}`);

    // Mutual like? -> create a match.
    let matched = false;
    if (hasLiked.get(receiverId, senderId) && !matchExists(senderId, receiverId)) {
        createMatch(senderId, receiverId);
        matched = true;
        logger.match(`Match created between ${senderId} and ${receiverId}`);
    }

    return { ok: true, matched };
}

module.exports = { like, canLike };
