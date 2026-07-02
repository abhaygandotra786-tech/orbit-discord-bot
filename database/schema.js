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

logger.info("Database schema loaded.");

module.exports = db;
