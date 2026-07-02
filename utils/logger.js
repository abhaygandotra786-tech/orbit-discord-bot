/**
 * Community Hub - Logger
 * ------------------------------------------------------------------
 * Lightweight file + console logger. Writes category-specific logs
 * into the /logs folder and mirrors important events to the console.
 */

const fs = require("fs");
const path = require("path");

const LOG_DIR = path.join(__dirname, "../logs");

// Ensure the logs directory exists.
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

const FILES = {
    error: "error.log",
    profile: "profile.log",
    like: "like.log",
    match: "match.log",
    admin: "admin.log",
    combined: "combined.log"
};

function timestamp() {
    return new Date().toISOString();
}

function writeLine(file, line) {
    try {
        fs.appendFileSync(path.join(LOG_DIR, file), line + "\n");
    } catch (err) {
        // Last resort — never let logging crash the bot.
        console.error("Logger write failed:", err);
    }
}

/**
 * Core writer. Always mirrors to combined.log and (for errors) console.
 * @param {string} level  one of FILES keys
 * @param {string} message
 */
function log(level, message) {
    const line = `[${timestamp()}] [${level.toUpperCase()}] ${message}`;

    const file = FILES[level] || FILES.combined;
    writeLine(file, line);

    if (file !== FILES.combined) {
        writeLine(FILES.combined, line);
    }
}

module.exports = {
    error(message, err) {
        const detail = err
            ? `${message} :: ${err.stack || err.message || err}`
            : message;
        log("error", detail);
        console.error(`❌ ${detail}`);
    },
    profile(message) {
        log("profile", message);
        console.log(`👤 ${message}`);
    },
    like(message) {
        log("like", message);
        console.log(`❤️ ${message}`);
    },
    match(message) {
        log("match", message);
        console.log(`✨ ${message}`);
    },
    admin(message) {
        log("admin", message);
        console.log(`🛡️ ${message}`);
    },
    info(message) {
        log("combined", message);
        console.log(`ℹ️ ${message}`);
    }
};
