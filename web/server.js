/**
 * Community Hub - Public website
 * ------------------------------------------------------------------
 * A read-only showcase of community profiles, grouped by category with
 * a distinct look per category. Visitors log in with Discord to like
 * members; likes flow into the same database the bot uses, so mutual
 * likes become matches automatically.
 *
 * Profiles are managed entirely from the bot. The site only exposes a
 * member's display name + Discord username, and a Like button.
 */

require("dotenv").config();

const path = require("path");
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");

require("../database/schema"); // ensure tables exist

const config = require("../config/config");
const logger = require("../utils/logger");
const { CATEGORIES, CATEGORY_EMOJI } = require("../utils/constants");
const premium = require("../utils/premiumService");
const { like } = require("../utils/likeService");
const {
    getAllProfiles,
    getProfilesByCategory,
    getProfile
} = require("../database/profileQueries");
const {
    getReceivedLikes,
    hasLiked,
    countLikes
} = require("../database/likesQueries");
const discord = require("./lib/discord");

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use(
    session({
        name: "ch.sid",
        secret: process.env.SESSION_SECRET || "change-me-in-production",
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000
        }
    })
);

const oauthConfigured = Boolean(process.env.CLIENT_ID && process.env.CLIENT_SECRET);

// ---- helpers -----------------------------------------------------

/** Count how many likes a profile has received. */
const receivedCount = (userId) => getReceivedLikes.all(userId).length;

/** Shape a profile for public consumption (minimal, privacy-first). */
async function publicProfile(p, viewerId) {
    return {
        id: p.user_id,
        name: p.name,
        discord: await discord.getUsername(p.user_id, p.discord_tag),
        category: p.category,
        tier: premium.tierKey(p.user_id), // free | premium | pro
        featured: Boolean(p.featured && p.featured_until > Date.now()),
        likes: receivedCount(p.user_id),
        likedByMe: viewerId ? Boolean(hasLiked.get(viewerId, p.user_id)) : false
    };
}

/** Sort by visibility weight (Pro > Premium > Free, featured first). */
function rank(profiles) {
    return profiles
        .map((p, i) => ({ p, i }))
        .sort(
            (a, b) =>
                premium.visibilityWeight(b.p) - premium.visibilityWeight(a.p) ||
                a.i - b.i
        )
        .map((x) => x.p);
}

function requireAuth(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({ error: "login_required" });
    }
    next();
}

// ---- auth routes -------------------------------------------------

app.get("/auth/login", (req, res) => {
    if (!oauthConfigured) {
        return res
            .status(503)
            .send("Discord login is not configured. Set CLIENT_SECRET in .env.");
    }
    const state = crypto.randomBytes(16).toString("hex");
    req.session.oauthState = state;
    res.redirect(discord.authUrl(state));
});

app.get("/auth/callback", async (req, res) => {
    const { code, state } = req.query;
    if (!code || !state || state !== req.session.oauthState) {
        return res.redirect("/?login=failed");
    }
    delete req.session.oauthState;

    try {
        const user = await discord.exchangeCode(code);
        req.session.user = { id: user.id, username: user.username };
        res.redirect("/?login=ok");
    } catch (err) {
        logger.error("OAuth callback failed", err);
        res.redirect("/?login=failed");
    }
});

app.post("/auth/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
});

// ---- API ---------------------------------------------------------

app.get("/api/config", (req, res) => {
    res.json({
        botName: config.BOT_NAME,
        logo: config.LOGO_URL || "/assets/logo.png",
        banner: config.BANNER_URL || "/assets/banner.png",
        categories: CATEGORIES.map((c) => ({
            name: c,
            emoji: CATEGORY_EMOJI[c] || "🏷️"
        })),
        tiers: Object.values(config.PREMIUM.TIERS).map((t) => ({
            key: t.key,
            name: t.name,
            emoji: t.emoji || "",
            price: t.price,
            durationDays: t.durationDays,
            perks: t.perks || [],
            recommended: t.key === "premium"
        })),
        currency: config.PREMIUM.CURRENCY,
        oauthConfigured,
        inviteUrl: process.env.CLIENT_ID
            ? `https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID}&scope=bot+applications.commands&permissions=277025508352`
            : "#",
        upgradeUrl: config.PREMIUM.PAYMENT_URL
    });
});

app.get("/api/me", (req, res) => {
    res.json({ user: req.session.user || null });
});

app.get("/api/categories", (req, res) => {
    const all = getAllProfiles.all();
    const counts = {};
    for (const c of CATEGORIES) counts[c] = 0;
    for (const p of all) if (p.category in counts) counts[p.category]++;

    res.json(
        CATEGORIES.map((c) => ({
            name: c,
            emoji: CATEGORY_EMOJI[c] || "🏷️",
            count: counts[c]
        }))
    );
});

app.get("/api/profiles", async (req, res) => {
    const category = req.query.category;
    const viewerId = req.session.user?.id || null;

    let rows;
    if (category && CATEGORIES.includes(category)) {
        rows = getProfilesByCategory.all(category);
    } else {
        rows = getAllProfiles.all();
    }

    rows = rank(rows.filter((p) => p.category)); // only categorized profiles
    const profiles = await Promise.all(rows.map((p) => publicProfile(p, viewerId)));
    res.json({ category: category || "all", profiles });
});

app.post("/api/like", requireAuth, (req, res) => {
    const targetId = String(req.body?.targetId || "");
    if (!targetId) return res.status(400).json({ error: "missing_target" });
    if (!getProfile.get(targetId)) {
        return res.status(404).json({ error: "no_such_profile" });
    }

    const result = like(req.session.user.id, targetId);
    if (!result.ok) {
        return res.status(409).json({ error: "like_failed", reason: result.reason });
    }
    logger.like(`[web] ${req.session.user.id} liked ${targetId}`);
    res.json({ ok: true, matched: Boolean(result.matched), likes: receivedCount(targetId) });
});

// Who liked me — names are a Premium perk (mirrors the bot).
app.get("/api/admirers", requireAuth, async (req, res) => {
    const userId = req.session.user.id;
    const admirers = getReceivedLikes.all(userId);
    const canSee = premium.has(userId, "seeWhoLiked");

    if (!canSee) {
        return res.json({
            locked: true,
            count: admirers.length,
            upgradeUrl: config.PREMIUM.PAYMENT_URL
        });
    }

    const list = [];
    for (const a of admirers) {
        const p = getProfile.get(a.sender_id);
        if (!p) continue;
        list.push({
            id: p.user_id,
            name: p.name,
            discord: await discord.getUsername(p.user_id, p.discord_tag),
            category: p.category,
            matched: Boolean(hasLiked.get(userId, a.sender_id))
        });
    }
    res.json({ locked: false, count: list.length, admirers: list });
});

app.get("/api/stats", (req, res) => {
    res.json({
        profiles: getAllProfiles.all().length,
        likes: countLikes.get().count
    });
});

// ---- static + start ----------------------------------------------

app.use(express.static(path.join(__dirname, "public")));

app.listen(config.WEB.PORT, () => {
    logger.info(`🌐 ${config.BOT_NAME} website running at ${config.WEB.BASE_URL}`);
    if (!oauthConfigured) {
        logger.info(
            "Discord login disabled — set CLIENT_SECRET (and SESSION_SECRET) in .env to enable liking."
        );
    }
    startKeepAlive();
});

/**
 * Self keep-alive: on free hosts (e.g. Render) that sleep after ~15 min of
 * no traffic, ping our own public URL periodically so the process — and the
 * Discord bot running alongside it — stays online 24/7. No external service
 * needed. Only runs when WEB_BASE_URL is a public https URL (not localhost).
 */
function startKeepAlive() {
    const base = (config.WEB.BASE_URL || "").replace(/\/$/, "");
    if (!/^https:\/\//i.test(base) || base.includes("localhost")) return;

    const INTERVAL = 10 * 60 * 1000; // every 10 minutes (< Render's 15 min idle)
    const ping = () => {
        fetch(`${base}/api/stats`).catch(() => {
            /* transient network blips are fine */
        });
    };
    setInterval(ping, INTERVAL).unref();
    logger.info("⏱️  Self keep-alive enabled (pings every 10 min).");
}

