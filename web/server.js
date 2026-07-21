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
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

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
const { getMatches } = require("../database/matchQueries");
const { countViews, countUniqueViewers } = require("../database/viewQueries");
const discord = require("./lib/discord");
const db = require("../database/database");

const dodo = require("./lib/dodo");
const { grant } = premium;

const app = express();
app.set("trust proxy", 1);

// Security headers. CSP is disabled (the site uses inline styles/fonts);
// CORP is set to cross-origin so Discord can fetch our /assets/logo.png.
app.use(
    helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: "cross-origin" }
    })
);

const isHttps = /^https:\/\//i.test(config.WEB.BASE_URL);

// --- Dodo webhook: MUST be registered before express.json() so we can read
// the raw body for signature verification. ---
app.post(
    "/api/dodo/webhook",
    express.raw({ type: "*/*" }),
    async (req, res) => {
        const raw = Buffer.isBuffer(req.body)
            ? req.body.toString("utf8")
            : String(req.body || "");
        const headers = {
            "webhook-id": req.header("webhook-id"),
            "webhook-signature": req.header("webhook-signature"),
            "webhook-timestamp": req.header("webhook-timestamp")
        };

        let evt;
        try {
            evt = dodo.verifyWebhook(raw, headers);
        } catch (err) {
            logger.error("Dodo webhook signature verification failed", err);
            return res.status(401).send("invalid signature");
        }

        try {
            const type = evt.type || evt.event_type;
            const data = evt.data || {};
            const paid =
                type === "payment.succeeded" ||
                type === "subscription.active" ||
                type === "subscription.renewed";

            const revoked =
                type === "subscription.cancelled" ||
                type === "subscription.expired" ||
                type === "subscription.on_hold" ||
                type === "subscription.failed";

            const meta = data.metadata || {};
            const discordId = meta.discord_id;

            if (paid && discordId) {
                const tier =
                    meta.tier ||
                    dodo.tierFromProduct(
                        data.product_id || data.product_cart?.[0]?.product_id
                    );
                if (tier) {
                    grant(discordId, tier, undefined, "dodo");
                    logger.info(`[dodo] ${type} → granted ${tier} to ${discordId}`);
                } else {
                    logger.error(`[dodo] ${type} missing tier in metadata`);
                }
            } else if (revoked && discordId) {
                premium.revoke(discordId);
                logger.info(`[dodo] ${type} → revoked premium for ${discordId}`);
            } else if (paid || revoked) {
                logger.error(`[dodo] ${type} missing discord_id in metadata`);
            }
        } catch (err) {
            logger.error("Dodo webhook handler error", err);
        }
        // Always 200 so Dodo doesn't retry a handled event.
        return res.status(200).send("ok");
    }
);

app.use(express.json({ limit: "64kb" }));
app.use(
    session({
        name: "ch.sid",
        secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: isHttps, // HTTPS-only cookie in production
            maxAge: 7 * 24 * 60 * 60 * 1000
        }
    })
);

// Basic rate limiting to curb abuse of the API (login/like/checkout).
app.use(
    "/api",
    rateLimit({
        windowMs: 60 * 1000,
        max: 60,
        standardHeaders: true,
        legacyHeaders: false
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
        website: config.WEBSITE,
        supportServer: config.SUPPORT_SERVER,
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
        paymentsEnabled: dodo.isConfigured(),
        manageUrl: process.env.DODO_PORTAL_URL || "",
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

// Keyword search across name, skills, profession, location and interests.
app.get("/api/search", async (req, res) => {
    const q = String(req.query.q || "").trim();
    const category = req.query.category;
    const viewerId = req.session.user?.id || null;

    if (!q) return res.json({ q: "", profiles: [] });

    const like = `%${q}%`;
    const fields =
        "(name LIKE ? OR skills LIKE ? OR profession LIKE ? OR location LIKE ? OR interests LIKE ?)";
    const args = [like, like, like, like, like];

    let rows;
    if (category && CATEGORIES.includes(category)) {
        rows = db
            .prepare(`SELECT * FROM profiles WHERE category = ? AND ${fields} LIMIT 100`)
            .all(category, ...args);
    } else {
        rows = db
            .prepare(`SELECT * FROM profiles WHERE ${fields} LIMIT 100`)
            .all(...args);
    }

    rows = rank(rows.filter((p) => p.category));
    const profiles = await Promise.all(rows.map((p) => publicProfile(p, viewerId)));
    res.json({ q, category: category || "all", profiles });
});

app.post("/api/checkout", requireAuth, async (req, res) => {
    const tier = String(req.body?.tier || "");
    if (!["premium", "pro"].includes(tier)) {
        return res.status(400).json({ error: "invalid_tier" });
    }
    if (!dodo.isConfigured()) {
        return res.status(503).json({ error: "payments_unconfigured" });
    }
    try {
        const base = config.WEB.BASE_URL.replace(/\/$/, "");
        const url = await dodo.createCheckout({
            tier,
            discordId: req.session.user.id,
            discordName: req.session.user.username,
            returnUrl: `${base}/success.html`
        });
        return res.json({ url });
    } catch (err) {
        logger.error("Checkout creation failed", err);
        return res.status(500).json({ error: "checkout_failed" });
    }
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
    try {
        res.json({
            profiles: getAllProfiles.all().length,
            likes: countLikes.get().count
        });
    } catch (err) {
        logger.error("/api/stats failed", err);
        res.status(500).json({ error: "Stats temporarily unavailable" });
    }
});

// Member dashboard: everything about the logged-in user.
app.get("/api/me/dashboard", requireAuth, async (req, res) => {
    const uid = req.session.user.id;
    const profile = getProfile.get(uid) || null;
    const meta = premium.meta(uid);
    const active = premium.getActive(uid);

    const admirerRows = getReceivedLikes.all(uid);
    const canSee = premium.has(uid, "seeWhoLiked");
    const admirers = [];
    if (canSee) {
        for (const a of admirerRows) {
            const p = getProfile.get(a.sender_id);
            if (!p) continue;
            admirers.push({
                name: p.name,
                discord: await discord.getUsername(p.user_id, p.discord_tag),
                category: p.category,
                matched: Boolean(hasLiked.get(uid, a.sender_id))
            });
        }
    }

    res.json({
        user: req.session.user,
        profile: profile
            ? {
                  name: profile.name,
                  age: profile.age,
                  category: profile.category,
                  profession: profile.profession,
                  location: profile.location,
                  skills: profile.skills,
                  featured: Boolean(profile.featured && profile.featured_until > Date.now())
              }
            : null,
        tier: premium.tierKey(uid),
        tierName: meta.name,
        badge: meta.badge || "",
        expiresAt: active ? active.expires_at : null,
        stats: {
            likesReceived: admirerRows.length,
            matches: getMatches(uid).length,
            views: countViews.get(uid).count,
            uniqueViewers: countUniqueViewers.get(uid).count,
            searchAppearances: profile ? profile.search_appearances || 0 : 0
        },
        admirers: { count: admirerRows.length, locked: !canSee, list: admirers },
        upgradeUrl: config.PREMIUM.PAYMENT_URL,
        manageUrl: process.env.DODO_PORTAL_URL || ""
    });
});

// ---- static + start ----------------------------------------------

app.use(express.static(path.join(__dirname, "public")));

// SPA fallback: client-side routes (e.g. /c/networking, /premium) return
// index.html so they work on refresh and direct links.
app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

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

    // Ping every 5 min — well under Render's ~15 min idle window, and because
    // /api/stats runs a DB query it also keeps the Turso database awake.
    const INTERVAL = 5 * 60 * 1000;
    const ping = () => {
        fetch(`${base}/api/stats`).catch(() => {
            /* transient network blips are fine */
        });
    };
    setInterval(ping, INTERVAL).unref();
    logger.info("⏱️  Self keep-alive enabled (pings every 5 min).");
}

