/**
 * Community Hub Web - Discord helpers
 * ------------------------------------------------------------------
 * OAuth2 login (identify) and cached username lookups.
 * Usernames are resolved via the bot token and cached in memory + the
 * profiles.discord_tag column so we rarely hit the Discord API.
 */

const config = require("../../config/config");
const db = require("../../database/database");

const API = "https://discord.com/api/v10";

const setTag = db.prepare(
    "UPDATE profiles SET discord_tag = ? WHERE user_id = ?"
);

// userId -> { tag, fetchedAt }
const cache = new Map();

function redirectUri() {
    return (
        process.env.OAUTH_REDIRECT_URI ||
        `${config.WEB.BASE_URL.replace(/\/$/, "")}/auth/callback`
    );
}

/** Build the Discord OAuth2 authorization URL. */
function authUrl(state) {
    const params = new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        redirect_uri: redirectUri(),
        response_type: "code",
        scope: config.WEB.OAUTH_SCOPES.join(" "),
        state
    });
    return `${API}/oauth2/authorize?${params.toString()}`;
}

/** Exchange an OAuth code for the logged-in user's identity. */
async function exchangeCode(code) {
    const body = new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri()
    });

    const tokenRes = await fetch(`${API}/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body
    });
    if (!tokenRes.ok) {
        throw new Error(`Token exchange failed: ${tokenRes.status}`);
    }
    const token = await tokenRes.json();

    const userRes = await fetch(`${API}/users/@me`, {
        headers: { Authorization: `Bearer ${token.access_token}` }
    });
    if (!userRes.ok) {
        throw new Error(`User fetch failed: ${userRes.status}`);
    }
    const user = await userRes.json();

    const tag = displayName(user);
    cache.set(user.id, { tag, fetchedAt: Date.now() });
    try {
        setTag.run(tag, user.id);
    } catch {
        /* user may not have a profile row yet */
    }

    return { id: user.id, username: tag, avatar: user.avatar };
}

/** Prefer the new global username; fall back to legacy discriminator. */
function displayName(user) {
    if (user.global_name) return user.global_name;
    if (user.discriminator && user.discriminator !== "0") {
        return `${user.username}#${user.discriminator}`;
    }
    return user.username || "Unknown";
}

/**
 * Resolve a Discord username for a user id, using cache -> stored tag ->
 * Discord API (bot token). Returns a best-effort string.
 */
async function getUsername(userId, storedTag) {
    const hit = cache.get(userId);
    if (hit && Date.now() - hit.fetchedAt < config.WEB.USERNAME_CACHE_TTL) {
        return hit.tag;
    }
    if (storedTag) {
        cache.set(userId, { tag: storedTag, fetchedAt: Date.now() });
        return storedTag;
    }

    if (!process.env.TOKEN) return "Discord User";
    try {
        const res = await fetch(`${API}/users/${userId}`, {
            headers: { Authorization: `Bot ${process.env.TOKEN}` }
        });
        if (!res.ok) return "Discord User";
        const user = await res.json();
        const tag = displayName(user);
        cache.set(userId, { tag, fetchedAt: Date.now() });
        try {
            setTag.run(tag, userId);
        } catch {
            /* no profile row */
        }
        return tag;
    } catch {
        return "Discord User";
    }
}

module.exports = { authUrl, exchangeCode, getUsername, redirectUri };
