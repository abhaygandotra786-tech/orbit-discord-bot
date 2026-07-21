/**
 * Community Hub - Database schema
 * ------------------------------------------------------------------
 * Creates every table the bot needs (idempotent). Required once at
 * startup before any prepared statements are built.
 */

const db = require("./database");
const logger = require("../utils/logger");

db.safePragma("journal_mode = WAL");
db.safePragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS profiles (
    user_id       TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    age           INTEGER,
    gender        TEXT,
    interested_in TEXT,
    location      TEXT,
    bio           TEXT,
    skills        TEXT,
    profession    TEXT,
    linkedin      TEXT,
    github        TEXT,
    portfolio     TEXT,
    interests     TEXT,
    category      TEXT,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS likes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id   TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sender_id, receiver_id)
);

CREATE TABLE IF NOT EXISTS matches (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user1      TEXT NOT NULL,
    user2      TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user1, user2)
);

CREATE TABLE IF NOT EXISTS banned_users (
    user_id   TEXT PRIMARY KEY,
    reason    TEXT,
    banned_by TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscriptions (
    user_id    TEXT PRIMARY KEY,
    tier       TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    granted_by TEXT
);

CREATE TABLE IF NOT EXISTS profile_views (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    viewer_id  TEXT NOT NULL,
    profile_id TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS connections (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_id TEXT NOT NULL,
    target_id    TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pending',
    created_at   INTEGER NOT NULL,
    UNIQUE(requester_id, target_id)
);

CREATE TABLE IF NOT EXISTS daily_usage (
    user_id TEXT NOT NULL,
    action  TEXT NOT NULL,
    day     TEXT NOT NULL,
    count   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, action, day)
);

CREATE INDEX IF NOT EXISTS idx_profiles_category ON profiles(category);
CREATE INDEX IF NOT EXISTS idx_likes_receiver    ON likes(receiver_id);
CREATE INDEX IF NOT EXISTS idx_likes_sender      ON likes(sender_id);
CREATE INDEX IF NOT EXISTS idx_matches_user1     ON matches(user1);
CREATE INDEX IF NOT EXISTS idx_matches_user2     ON matches(user2);
CREATE INDEX IF NOT EXISTS idx_views_profile     ON profile_views(profile_id);
CREATE INDEX IF NOT EXISTS idx_views_viewer      ON profile_views(viewer_id);
CREATE INDEX IF NOT EXISTS idx_conn_target       ON connections(target_id);
`);

/**
 * Lightweight migration: add any columns that are missing from an
 * existing table created by an older version of the bot.
 */
function ensureColumns(table, columns) {
    const existing = new Set(
        db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name)
    );
    for (const [name, definition] of Object.entries(columns)) {
        if (!existing.has(name)) {
            db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
            logger.info(`Migrated: added ${table}.${name}`);
        }
    }
}

ensureColumns("profiles", {
    gender: "TEXT",
    interested_in: "TEXT",
    skills: "TEXT",
    profession: "TEXT",
    linkedin: "TEXT",
    github: "TEXT",
    portfolio: "TEXT",
    interests: "TEXT",
    category: "TEXT",
    created_at: "DATETIME",
    updated_at: "DATETIME",
    theme: "TEXT",
    featured: "INTEGER DEFAULT 0",
    featured_until: "INTEGER DEFAULT 0",
    investor_role: "TEXT",
    portfolio_projects: "TEXT",
    search_appearances: "INTEGER DEFAULT 0",
    discord_tag: "TEXT"
});

// Migrate legacy tier names from the earlier 2-tier system.
db.exec(`
UPDATE subscriptions SET tier = 'premium' WHERE tier = 'gold';
UPDATE subscriptions SET tier = 'pro'     WHERE tier = 'platinum';
`);

/* ------------------------------------------------------------------
 * Growth engine: votes, referrals, entitlements, credits, audit.
 * ------------------------------------------------------------------ */
db.exec(`
-- Time-based tier entitlements. Multiple rows per user (one per tier) so
-- someone can hold e.g. Pro-time AND Premium-time at once; the highest
-- currently-active tier wins. Time stacks by extending expires_at.
CREATE TABLE IF NOT EXISTS entitlements (
    user_id    TEXT NOT NULL,
    tier       TEXT NOT NULL,
    expires_at INTEGER NOT NULL,          -- epoch ms
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, tier)
);

-- Every top.gg vote we accept (idempotent via dedupe_key).
CREATE TABLE IF NOT EXISTS votes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT NOT NULL,
    voted_at   INTEGER NOT NULL,          -- epoch ms
    weekend    INTEGER NOT NULL DEFAULT 0,
    source     TEXT,                      -- 'webhook' | 'api'
    dedupe_key TEXT UNIQUE                -- e.g. "<userId>:<12h-bucket>"
);

-- Per-user vote streak / cumulative state.
CREATE TABLE IF NOT EXISTS vote_state (
    user_id        TEXT PRIMARY KEY,
    current_streak INTEGER NOT NULL DEFAULT 0,
    best_streak    INTEGER NOT NULL DEFAULT 0,
    total_votes    INTEGER NOT NULL DEFAULT 0,
    last_vote_at   INTEGER NOT NULL DEFAULT 0,
    last_vote_day  TEXT,                  -- 'YYYY-MM-DD' (UTC) for streak math
    reminder_optin INTEGER NOT NULL DEFAULT 0
);

-- Spendable bonus match credits.
CREATE TABLE IF NOT EXISTS match_credits (
    user_id    TEXT PRIMARY KEY,
    balance    INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
);

-- One permanent referral code per user.
CREATE TABLE IF NOT EXISTS referral_codes (
    user_id    TEXT PRIMARY KEY,
    code       TEXT UNIQUE NOT NULL,
    created_at INTEGER NOT NULL
);

-- Redeemed referrals. An invited user can be credited at most once.
CREATE TABLE IF NOT EXISTS referrals (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    inviter_id   TEXT NOT NULL,
    invited_id   TEXT NOT NULL UNIQUE,
    code         TEXT NOT NULL,
    redeemed_at  INTEGER NOT NULL,
    activated    INTEGER NOT NULL DEFAULT 0,
    activated_at INTEGER,
    week_key     TEXT,                    -- ISO week the activation counted (weekly cap)
    flagged      INTEGER NOT NULL DEFAULT 0
);

-- Cosmetic / status badges (OG Supporter, Streak Keeper, Vouched, ...).
CREATE TABLE IF NOT EXISTS reward_badges (
    user_id    TEXT NOT NULL,
    badge      TEXT NOT NULL,
    granted_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, badge)
);

-- Audit trail of every grant / expiry / credit / badge.
CREATE TABLE IF NOT EXISTS reward_audit (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT NOT NULL,
    kind       TEXT NOT NULL,             -- vote|referral|grant|expiry|credit|badge
    detail     TEXT,
    amount     INTEGER,
    created_at INTEGER NOT NULL
);

-- Suspicious-pattern flags for manual review (never auto-ban).
CREATE TABLE IF NOT EXISTS reward_flags (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT NOT NULL,
    reason     TEXT NOT NULL,
    detail     TEXT,
    resolved   INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ent_user       ON entitlements(user_id);
CREATE INDEX IF NOT EXISTS idx_votes_user     ON votes(user_id);
CREATE INDEX IF NOT EXISTS idx_ref_inviter    ON referrals(inviter_id);
CREATE INDEX IF NOT EXISTS idx_ref_invited    ON referrals(invited_id);
CREATE INDEX IF NOT EXISTS idx_audit_user     ON reward_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_flags_open     ON reward_flags(resolved);
`);

// One-time, idempotent: carry any active legacy subscription into the new
// entitlements table so existing paid members keep their tier.
db.exec(
    `INSERT OR IGNORE INTO entitlements (user_id, tier, expires_at, updated_at)
     SELECT user_id, tier, expires_at, expires_at
     FROM subscriptions WHERE expires_at > ${Date.now()};`
);

logger.info("Database schema loaded.");

module.exports = db;
