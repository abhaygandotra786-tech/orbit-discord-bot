/**
 * Orbit — Growth rewards config (votes + referrals)
 * ------------------------------------------------------------------
 * ⚙️  This is the ONLY file you edit to tune reward numbers. All logic
 *     reads from here — never hard-code amounts in the modules.
 *
 * ⚠️  TIER MAPPING — READ THIS.
 *     In your bot, "pro" is your TOP paid tier ($14.99, rank 2) and
 *     "premium" is the cheaper tier ($4.99, rank 1). The reward ladder
 *     uses roles, not names, so a single vote can't hand out your most
 *     expensive tier. Flip these two lines if you want the opposite.
 */

const TIER = {
    // Common reward, given often (votes + small referral milestones).
    common: "pro", // -> Pro, your $4.99 tier
    // Top reward, given rarely (only the biggest referral milestone).
    top: "premium" // -> Premium, your $14.99 top tier
};

// --- duration helpers (everything internally is milliseconds) ---
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const hours = (h) => h * HOUR;
const days = (d) => d * DAY;

module.exports = {
    TIER,
    HOUR,
    DAY,
    hours,
    days,

    // ================= top.gg =================
    TOPGG: {
        BOT_ID: process.env.TOPGG_BOT_ID || process.env.CLIENT_ID || "",
        // Header secret you set in the top.gg webhook dashboard.
        WEBHOOK_AUTH: process.env.TOPGG_WEBHOOK_AUTH || "",
        // API token (fallback vote-check + leaderboard verification).
        API_TOKEN: process.env.TOPGG_API_TOKEN || "",
        get VOTE_URL() {
            return this.BOT_ID ? `https://top.gg/bot/${this.BOT_ID}/vote` : "https://top.gg";
        }
    },

    // ================= VOTES =================
    VOTE: {
        COOLDOWN: hours(12), // top.gg lets a user vote every 12h
        WEEKEND_MULTIPLIER: 2, // votes count double on weekends (top.gg flag)

        // Per-vote base rewards (weekend doubles credits + tier hours).
        CREDITS_PER_VOTE: 1,
        TIER_HOURS_PER_VOTE: 24, // 24h of TIER.common per vote

        // Streak is measured in consecutive calendar days with a vote.
        // Missing a day resets current_streak to 1 on the next vote.
        STREAKS: {
            3: {
                role: "risingSupporter", // see ROLES below
                highlightDays: 7, // colored border/emoji in match cards
                label: "Rising Supporter"
            },
            7: {
                bonusTierDays: 7, // +7 days of TIER.common
                badge: "Streak Keeper",
                earlyMatchDrop: true // Sun 8pm instead of Mon 8pm
            }
        },

        // Lifetime cumulative votes -> permanent cosmetic badge.
        CUMULATIVE: {
            30: { badge: "OG Supporter" }
        },

        // Highlight styling used in match cards for active streaks.
        HIGHLIGHT: { emoji: "🔥", color: 0xff5f2e }
    },

    // ================= REFERRALS =================
    REFERRAL: {
        REDEEM_WINDOW: days(7), // must redeem within 7 days of joining
        CODE_LENGTH: 6,

        // Both sides win when a code is redeemed (makes sharing a gift).
        WELCOME_BONUS: { credits: 1, tierHours: 24 },

        // Milestones by ACTIVATED referral count (activation = profile
        // complete AND first match). Keyed by count.
        LADDER: {
            1: { credits: 3, tierDays: 3, tier: "common" },
            3: { tierDays: 30, tier: "common", status: "Vouched" },
            5: { priorityQueue: true },
            10: {
                tierDays: 30,
                tier: "top", // the ONLY milestone that grants the top tier
                role: "communityBuilder",
                customAccent: true
            },
            25: { lifetimeTier: "top", hallOfFame: true }
        }
    },

    // ================= ANTI-ABUSE =================
    ABUSE: {
        MIN_ACCOUNT_AGE: days(14), // invited account must be >= 14 days old
        WEEKLY_ACTIVATION_CAP: 3, // max activated referrals counted / inviter / week
        // If two accounts share signals (same IP hint, self-referral, etc.)
        // we FLAG for review — never auto-ban.
        FLAG_ONLY: true
    },

    // ================= LEADERBOARD =================
    LEADERBOARD: {
        TOP_N: 3, // exclusive reward for the top 3 monthly voters
        TOP_REWARD: { tierDays: 3, tier: "common", badge: "Top Voter" }
    },

    // ================= MATCH DROP =================
    MATCH_DROP: {
        DEFAULT_DAY: 1, // Monday (0=Sun..6=Sat)
        DEFAULT_HOUR: 20, // 8pm
        EARLY_DAY: 0, // Sunday for 7-day streakers / early-access
        EARLY_HOUR: 20
    },

    // ================= DISCORD ROLE IDS =================
    // Set these to real role IDs (env or paste here). Empty = skip role grant.
    ROLES: {
        risingSupporter: process.env.ROLE_RISING_SUPPORTER || "",
        streakKeeper: process.env.ROLE_STREAK_KEEPER || "",
        communityBuilder: process.env.ROLE_COMMUNITY_BUILDER || ""
    },

    // ================= BADGES (cosmetic labels) =================
    BADGES: {
        streakKeeper: "Streak Keeper",
        ogSupporter: "OG Supporter",
        vouched: "Vouched",
        communityBuilder: "Community Builder",
        topVoter: "Top Voter"
    },

    // Reminders: never nag. One opt-in cooldown-reset ping, one expiry notice.
    REMINDERS: { VOTE_RESET_OPTIN_DEFAULT: false }
};
