/**
 * Orbit - vote service (top.gg).
 * Records votes idempotently, tracks daily streaks, and grants the reward
 * ladder defined in config/rewards.js. Returns a summary of what was earned
 * so the caller can DM a celebratory embed.
 */
const db = require("../database/database");
const R = require("../config/rewards");
const ent = require("./entitlementService");
const { credits, badges } = require("./rewardsStore");
const logger = require("./logger");

const DAY = 24 * 60 * 60 * 1000;

const insVote = db.prepare(
    `INSERT OR IGNORE INTO votes (user_id, voted_at, weekend, source, dedupe_key)
     VALUES (?, ?, ?, ?, ?)`
);
const getState = db.prepare(`SELECT * FROM vote_state WHERE user_id = ?`);
const upsertState = db.namedRun(
    `INSERT INTO vote_state (user_id, current_streak, best_streak, total_votes, last_vote_at, last_vote_day, reminder_optin)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       current_streak=excluded.current_streak, best_streak=excluded.best_streak,
       total_votes=excluded.total_votes, last_vote_at=excluded.last_vote_at,
       last_vote_day=excluded.last_vote_day`,
    ["user_id", "current_streak", "best_streak", "total_votes", "last_vote_at", "last_vote_day", "reminder_optin"]
);
const setReminder = db.namedRun(
    `INSERT INTO vote_state (user_id, reminder_optin) VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET reminder_optin = excluded.reminder_optin`,
    ["user_id", "reminder_optin"]
);

const dueReminders = db.prepare(
    `SELECT user_id FROM vote_state WHERE reminder_optin = 1 AND last_vote_at <= ? AND last_vote_at > ?`
);

const dayStr = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Read-only vote state for the /vote command. */
function state(userId) {
    const s = getState.get(userId);
    return {
        streak: s ? s.current_streak : 0,
        best: s ? s.best_streak : 0,
        total: s ? s.total_votes : 0,
        lastVoteAt: s ? s.last_vote_at : 0,
        reminderOptIn: s ? Boolean(s.reminder_optin) : false
    };
}

/** ms until the next vote is allowed (0 if available now). */
function cooldownLeft(userId) {
    const s = getState.get(userId);
    if (!s || !s.last_vote_at) return 0;
    return Math.max(0, s.last_vote_at + R.VOTE.COOLDOWN - Date.now());
}

function toggleReminder(userId, on) {
    setReminder.run({ user_id: userId, reminder_optin: on ? 1 : 0 });
}

/**
 * Record a vote and grant rewards. Idempotent within each 12h window.
 * @returns {object|null} earned summary, or null if this was a replay.
 */
function recordVote(userId, { weekend = false, source = "webhook" } = {}) {
    const now = Date.now();
    const bucket = Math.floor(now / R.VOTE.COOLDOWN); // 12h idempotency bucket
    const dedupe = `${userId}:${bucket}`;
    const res = insVote.run(userId, now, weekend ? 1 : 0, source, dedupe);
    if (!res || res.changes === 0) return null; // replay: do not double-grant

    // streak math (consecutive UTC days)
    const prev = getState.get(userId) || {};
    const today = dayStr(now);
    const yesterday = dayStr(now - DAY);
    let streak;
    if (prev.last_vote_day === today) streak = prev.current_streak || 1;
    else if (prev.last_vote_day === yesterday) streak = (prev.current_streak || 0) + 1;
    else streak = 1;
    const total = (prev.total_votes || 0) + 1;
    const best = Math.max(prev.best_streak || 0, streak);
    upsertState.run({
        user_id: userId, current_streak: streak, best_streak: best,
        total_votes: total, last_vote_at: now, last_vote_day: today,
        reminder_optin: prev.reminder_optin || 0
    });

    // base rewards (weekend doubles)
    const mult = weekend ? R.VOTE.WEEKEND_MULTIPLIER : 1;
    const gainedCredits = R.VOTE.CREDITS_PER_VOTE * mult;
    const tierHours = R.VOTE.TIER_HOURS_PER_VOTE * mult;
    credits.add(userId, gainedCredits);
    ent.grantTier(userId, R.TIER.common, R.hours(tierHours), { source: "vote" });

    const earned = {
        credits: gainedCredits, tierHours, streak, total, weekend,
        tierName: (require("../config/config").PREMIUM.TIERS[R.TIER.common] || {}).name || "Pro",
        milestones: [], badges: [], role: null, earlyDrop: false
    };

    // streak milestone
    const sm = R.VOTE.STREAKS[streak];
    if (sm) {
        if (sm.bonusTierDays) {
            ent.grantTier(userId, R.TIER.common, R.days(sm.bonusTierDays), { source: "streak" });
            earned.milestones.push(`+${sm.bonusTierDays} bonus ${earned.tierName} days`);
        }
        if (sm.badge) { badges.grant(userId, sm.badge); earned.badges.push(sm.badge); }
        if (sm.role) earned.role = sm.role;
        if (sm.earlyMatchDrop) earned.earlyDrop = true;
        if (sm.label) earned.milestones.push(sm.label);
    }
    // cumulative milestone
    const cm = R.VOTE.CUMULATIVE[total];
    if (cm && cm.badge) { badges.grant(userId, cm.badge); earned.badges.push(cm.badge); }

    ent.audit(userId, "vote", `streak:${streak} total:${total}${weekend ? " weekend" : ""}`, gainedCredits);
    logger.info(`Vote recorded: ${userId} streak ${streak} (+${gainedCredits} credits, +${tierHours}h)`);
    return earned;
}

/** Users whose 12h cooldown reset within the last `windowMs` and want a ping. */
function dueForReminder(windowMs) {
    const now = Date.now();
    const hi = now - R.VOTE.COOLDOWN;
    const lo = hi - windowMs;
    return dueReminders.all(hi, lo).map((r) => r.user_id);
}

/** DM a voter a celebratory summary of what they just earned. */
async function dmReward(client, userId, earned) {
    if (!client || !earned) return;
    try {
        const { EmbedBuilder } = require("discord.js");
        const config = require("../config/config");
        const lines = [
            `• +${earned.credits} bonus match credit${earned.credits > 1 ? "s" : ""}`,
            `• ${earned.tierHours}h of ${earned.tierName}`
        ];
        earned.milestones.forEach((m) => lines.push(`• ${m}`));
        earned.badges.forEach((b) => lines.push(`• 🏅 ${b} badge`));
        if (earned.earlyDrop) lines.push("• 🌅 Early access to the weekly match drop");
        const embed = new EmbedBuilder()
            .setColor(config.COLORS.PRIMARY)
            .setTitle("🗳️ Thanks for voting!")
            .setDescription(`${earned.weekend ? "Weekend bonus applied. " : ""}Your streak is now **${earned.streak}** day${earned.streak > 1 ? "s" : ""}.`)
            .addFields({ name: "You earned", value: lines.join("\n") })
            .setFooter({ text: "Vote again in 12 hours to keep your streak alive." })
            .setTimestamp();
        const user = await client.users.fetch(userId);
        await user.send({ embeds: [embed] });
    } catch {
        /* DMs closed */
    }
}

module.exports = { recordVote, state, cooldownLeft, toggleReminder, dueForReminder, dmReward };
