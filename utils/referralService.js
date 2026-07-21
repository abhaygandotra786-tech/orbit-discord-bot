/**
 * Orbit - referral service.
 * Codes, redemption (with a welcome bonus for the new user), activation
 * (profile complete + first match), anti-abuse, and the reward ladder.
 */
const { EmbedBuilder } = require("discord.js");
const db = require("../database/database");
const R = require("../config/rewards");
const config = require("../config/config");
const ent = require("./entitlementService");
const { credits, badges, flags } = require("./rewardsStore");
const { getProfile } = require("./../database/profileQueries");
const { getMatches } = require("./../database/matchQueries");
const logger = require("./logger");

const LIFETIME = 100 * 365 * 24 * 60 * 60 * 1000; // "lifetime" = 100 years

/* ---- statements ---- */
const getCode = db.prepare(`SELECT code FROM referral_codes WHERE user_id = ?`);
const getByCode = db.prepare(`SELECT user_id FROM referral_codes WHERE code = ?`);
const insCode = db.namedRun(
    `INSERT OR IGNORE INTO referral_codes (user_id, code, created_at) VALUES (?, ?, ?)`,
    ["user_id", "code", "created_at"]
);
const getReferralByInvited = db.prepare(`SELECT * FROM referrals WHERE invited_id = ?`);
const insReferral = db.namedRun(
    `INSERT OR IGNORE INTO referrals (inviter_id, invited_id, code, redeemed_at, activated) VALUES (?, ?, ?, ?, 0)`,
    ["inviter_id", "invited_id", "code", "redeemed_at"]
);
const markActivated = db.namedRun(
    `UPDATE referrals SET activated = 1, activated_at = ?, week_key = ?, flagged = ? WHERE invited_id = ?`,
    ["activated_at", "week_key", "flagged", "invited_id"]
);
const cntPending = db.prepare(`SELECT COUNT(*) AS c FROM referrals WHERE inviter_id = ? AND activated = 0`);
const cntActivated = db.prepare(
    `SELECT COUNT(*) AS c FROM referrals WHERE inviter_id = ? AND activated = 1 AND week_key NOT IN ('young','capped')`
);
const cntThisWeek = db.prepare(
    `SELECT COUNT(*) AS c FROM referrals WHERE inviter_id = ? AND week_key = ?`
);

/* ---- helpers ---- */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no easily-confused chars
function makeCode() {
    let s = "";
    for (let i = 0; i < R.REFERRAL.CODE_LENGTH; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    return s;
}
function snowflakeMs(id) {
    try { return Number((BigInt(id) >> 22n) + 1420070400000n); } catch { return Date.now(); }
}
function isoWeek(ms) {
    const d = new Date(ms);
    const day = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - day + 3);
    const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    const week = 1 + Math.round(((d - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
    return `${d.getUTCFullYear()}-W${week}`;
}

/** Get (or create) the user's permanent referral code. */
function getOrCreateCode(userId) {
    const existing = getCode.get(userId);
    if (existing) return existing.code;
    let code;
    for (let i = 0; i < 6; i++) { code = makeCode(); if (!getByCode.get(code)) break; }
    insCode.run({ user_id: userId, code, created_at: Date.now() });
    return code;
}

/**
 * Redeem a code. Grants the new user a welcome bonus immediately.
 * @returns {{ok:boolean, error?:string, inviterId?:string}}
 */
function redeem(invitedId, rawCode, { joinedAt } = {}) {
    const code = String(rawCode || "").trim().toUpperCase();
    if (!code) return { ok: false, error: "Please provide a code." };
    if (getReferralByInvited.get(invitedId)) return { ok: false, error: "You have already redeemed a referral code." };

    const inviter = getByCode.get(code);
    if (!inviter) return { ok: false, error: "That code does not exist." };
    if (inviter.user_id === invitedId) return { ok: false, error: "You cannot redeem your own code." };

    // must redeem within the join window if we know when they joined
    if (joinedAt && Date.now() - joinedAt > R.REFERRAL.REDEEM_WINDOW) {
        return { ok: false, error: "Referral codes must be redeemed within 7 days of joining." };
    }

    insReferral.run({ inviter_id: inviter.user_id, invited_id: invitedId, code, redeemed_at: Date.now() });

    // welcome bonus for the NEW user (both sides win)
    const wb = R.REFERRAL.WELCOME_BONUS;
    if (wb.credits) credits.add(invitedId, wb.credits);
    if (wb.tierHours) ent.grantTier(invitedId, R.TIER.common, R.hours(wb.tierHours), { source: "referral-welcome" });
    ent.audit(invitedId, "referral", `redeemed ${code} (welcome)`, wb.credits || 0);

    return { ok: true, inviterId: inviter.user_id };
}

/** Grant the inviter their milestone reward for reaching `count` activations. */
function grantLadder(inviterId, count) {
    const step = R.REFERRAL.LADDER[count];
    if (!step) return null;
    const earned = { count, items: [] };
    if (step.credits) { credits.add(inviterId, step.credits); earned.items.push(`+${step.credits} match credits`); }
    if (step.tierDays) {
        const key = R.TIER[step.tier] || R.TIER.common;
        ent.grantTier(inviterId, key, R.days(step.tierDays), { source: "referral" });
        earned.items.push(`${step.tierDays} days of ${config.PREMIUM.TIERS[key].name}`);
    }
    if (step.lifetimeTier) {
        const key = R.TIER[step.lifetimeTier] || R.TIER.top;
        ent.grantTier(inviterId, key, LIFETIME, { source: "referral-lifetime" });
        earned.items.push(`Lifetime ${config.PREMIUM.TIERS[key].name}`);
    }
    if (step.status) { badges.grant(inviterId, step.status); earned.items.push(`${step.status} status`); }
    if (step.priorityQueue) { badges.grant(inviterId, "Priority Queue"); earned.items.push("Priority match queue"); }
    if (step.customAccent) { badges.grant(inviterId, "Custom Accent"); earned.items.push("Custom profile accent"); }
    if (step.role) earned.role = step.role;
    if (step.hallOfFame) { badges.grant(inviterId, "Hall of Fame"); earned.items.push("Hall of Fame"); }
    ent.audit(inviterId, "referral", `milestone ${count}`, step.credits || 0);
    return earned;
}

/**
 * Try to activate the invited user's referral. Called after they complete a
 * profile and after a match forms. Safe to call often (no-op if not ready).
 * @returns {null | {counted:boolean, inviterId:string, total?:number, earned?:object, reason?:string}}
 */
function tryActivate(invitedId) {
    const ref = getReferralByInvited.get(invitedId);
    if (!ref || ref.activated) return null;

    const profile = getProfile.get(invitedId);
    const complete = profile && profile.category; // finished profile setup
    const hasMatch = getMatches(invitedId).length > 0;
    if (!complete || !hasMatch) return null; // conditions not met yet

    const now = Date.now();

    // anti-abuse: account must be at least 14 days old
    if (now - snowflakeMs(invitedId) < R.ABUSE.MIN_ACCOUNT_AGE) {
        markActivated.run({ activated_at: now, week_key: "young", flagged: 1, invited_id: invitedId });
        flags.add(ref.inviter_id, "referral: account under 14 days", `invited ${invitedId}`);
        return { counted: false, inviterId: ref.inviter_id, reason: "account too new" };
    }

    // anti-abuse: weekly cap
    const week = isoWeek(now);
    if (cntThisWeek.get(ref.inviter_id, week).c >= R.ABUSE.WEEKLY_ACTIVATION_CAP) {
        markActivated.run({ activated_at: now, week_key: "capped", flagged: 0, invited_id: invitedId });
        flags.add(ref.inviter_id, "referral: weekly cap reached", `invited ${invitedId}`);
        return { counted: false, inviterId: ref.inviter_id, reason: "weekly cap" };
    }

    markActivated.run({ activated_at: now, week_key: week, flagged: 0, invited_id: invitedId });
    const total = cntActivated.get(ref.inviter_id).c;
    const earned = grantLadder(ref.inviter_id, total);
    logger.info(`Referral activated: inviter ${ref.inviter_id} total ${total}`);
    return { counted: true, inviterId: ref.inviter_id, total, earned };
}

/** Dashboard/command stats for a user. */
function stats(userId) {
    const code = getOrCreateCode(userId);
    const pending = cntPending.get(userId).c;
    const activated = cntActivated.get(userId).c;
    const tiers = Object.keys(R.REFERRAL.LADDER).map(Number).sort((a, b) => a - b);
    const next = tiers.find((t) => t > activated) || null;
    return { code, pending, activated, next, ladder: tiers };
}

/**
 * Activate a referral and, if it counted, DM the inviter what they earned.
 * Safe to call after a match forms or a profile completes. Needs the client.
 */
async function handleActivation(invitedId, client) {
    const res = tryActivate(invitedId);
    if (!res || !res.counted) return res;
    try {
        const inviter = await client.users.fetch(res.inviterId);
        const lines = res.earned && res.earned.items.length
            ? res.earned.items.map((i) => `• ${i}`).join("\n")
            : "Your friend is matched. Thanks for growing Orbit!";
        const embed = new EmbedBuilder()
            .setColor(config.COLORS.SUCCESS)
            .setTitle("🎉 A referral just activated!")
            .setDescription(`You now have **${res.total}** activated referral${res.total > 1 ? "s" : ""}.`)
            .addFields({ name: res.earned ? "You unlocked" : "Nice", value: lines })
            .setFooter({ text: "Run /referrals to see your progress." })
            .setTimestamp();
        await inviter.send({ embeds: [embed] });
    } catch {
        /* inviter has DMs closed, ignore */
    }
    return res;
}

module.exports = { getOrCreateCode, redeem, tryActivate, handleActivation, grantLadder, stats };
