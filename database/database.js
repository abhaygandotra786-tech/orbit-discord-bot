/**
 * Orbit - database connection (libSQL / Turso)
 * ------------------------------------------------------------------
 * Uses the `libsql` package, which is a synchronous, better-sqlite3
 * compatible driver. This lets the whole codebase keep its existing
 * synchronous `.prepare().get()/.all()/.run()` calls unchanged.
 *
 * Modes:
 *   - Production: set LIBSQL_URL (+ LIBSQL_AUTH_TOKEN) to connect directly
 *     to a remote Turso database — data persists across redeploys.
 *   - Local dev: no env vars -> a local SQLite file (database.sqlite).
 */

const path = require("path");
const Database = require("libsql");

const url = process.env.LIBSQL_URL || process.env.TURSO_DATABASE_URL || "";
const authToken =
    process.env.LIBSQL_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || "";

let db;

if (url) {
    // Remote Turso database (persistent, card-free hosting).
    db = new Database(url, authToken ? { authToken } : {});
    console.log("🗄️  Connected to remote libSQL/Turso database.");
} else {
    // Local development file.
    db = new Database(path.join(__dirname, "database.sqlite"));
    safePragma("journal_mode = WAL");
    safePragma("busy_timeout = 5000");
    console.log("🗄️  Using local SQLite database file.");
}

/** Apply a PRAGMA, ignoring drivers/modes that don't support it. */
function safePragma(statement) {
    try {
        db.exec(`PRAGMA ${statement};`);
    } catch {
        /* not supported in this mode — safe to ignore */
    }
}

// Expose a helper so other modules can set pragmas safely too.
db.safePragma = safePragma;

/**
 * libSQL's remote (Turso/Hrana) protocol does NOT bind @named parameters
 * correctly — they come through as NULL. Positional (?) params work fine.
 * This helper lets query modules keep their object-based call sites
 * (`stmt.run({ a, b })`) while binding positionally under the hood.
 *
 * @param {string} sql   SQL using positional `?` placeholders
 * @param {string[]} keys object keys in the same order as the `?`
 * @returns {{ run: (obj?: object) => any }}
 */
db.namedRun = function namedRun(sql, keys) {
    const stmt = db.prepare(sql);
    return {
        run: (obj = {}) => stmt.run(...keys.map((k) => obj[k]))
    };
};

module.exports = db;
