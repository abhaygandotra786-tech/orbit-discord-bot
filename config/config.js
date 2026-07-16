/**
 * Community Hub - Master Configuration
 * ------------------------------------------------------------------
 * This is the single source of truth for all customizable settings.
 * Changing values here updates the behavior of the entire bot.
 */

// Public logo URL — used as the embed author/thumbnail icon in Discord and
// as the site logo. Defaults to the deployed site's /assets/logo.png so the
// bot can show the logo by URL (no per-message file uploads).
const _base = (process.env.WEB_BASE_URL || "").replace(/\/$/, "");
const LOGO_URL =
    process.env.LOGO_URL || (_base ? `${_base}/assets/logo.png` : "");

module.exports = {
    // --- Identity ---
    BOT_NAME: "Orbit",

    // --- Embed theming (warm orange) ---
    EMBED_COLOR: 0xff5f2e, // primary orange — brand color
    COLORS: {
        PRIMARY: 0xff5f2e, // primary orange
        SUCCESS: 0xff6a3d, // warm orange (positive)
        ERROR: 0xe73b27, // deep orange-red (errors)
        INFO: 0xffb648, // gold (info)
        PREMIUM: 0xffb648 // gold (premium accents)
    },

    // --- Footer ---
    FOOTER: {
        TEXT: "Orbit • Connect · Discover · Grow",
        ICON: LOGO_URL // small footer icon (uses logo)
    },

    // --- Branding ---
    LOGO_URL, // square logo (author/thumbnail icon in embeds + site logo)
    BANNER_URL: process.env.BANNER_URL || "", // optional wide banner

    // --- Links ---
    WEBSITE: process.env.WEBSITE_URL || process.env.WEB_BASE_URL || "https://example.com",
    SUPPORT_SERVER: process.env.SUPPORT_SERVER || "https://discord.gg/MBnqeusz92",

    // --- Website (public showcase) ---
    WEB: {
        // Koyeb (and most PaaS) inject PORT; fall back to WEB_PORT then 3000.
        PORT: Number(process.env.PORT) || Number(process.env.WEB_PORT) || 3000,
        // Public base URL of the site (used to build the OAuth redirect).
        BASE_URL: process.env.WEB_BASE_URL || "http://localhost:3000",
        // Discord OAuth2 scopes — identify is enough to know who is liking.
        OAUTH_SCOPES: ["identify"],
        // How long to cache fetched Discord usernames (ms).
        USERNAME_CACHE_TTL: 6 * 60 * 60 * 1000
    },

    // --- Match / browsing limits ---
    LIMITS: {
        BROWSE_PAGE_SIZE: 1, // profiles shown per browse page
        SEARCH_RESULTS: 10, // max results returned by /search
        SESSION_TTL_MS: 5 * 60 * 1000 // browse session lifetime
    },

    // --- Admins (Discord user IDs) ---
    // Set ADMIN_IDS in .env / Render as a comma-separated list, e.g.
    // ADMIN_IDS=123456789012345678,987654321098765432
    ADMIN_IDS: (process.env.ADMIN_IDS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),

    // --- Premium / Subscriptions (monetization) ---
    PREMIUM: {
        CURRENCY: "$",

        // Legacy fallback link (used only if Dodo isn't configured).
        PAYMENT_URL: process.env.PAYMENT_URL || "https://example.com/upgrade",

        // Dodo Payments (checkout + webhook auto-grant).
        DODO: {
            API_KEY: process.env.DODO_PAYMENTS_API_KEY || "",
            ENVIRONMENT: process.env.DODO_ENVIRONMENT || "test_mode", // or "live_mode"
            WEBHOOK_SECRET: process.env.DODO_WEBHOOK_SECRET || "",
            PRODUCTS: {
                premium: process.env.DODO_PRODUCT_PREMIUM || "",
                pro: process.env.DODO_PRODUCT_PRO || ""
            }
        },

        // Available profile themes (Premium+). Maps name -> embed color.
        THEMES: {
            royal: 0xe73b27,
            indigo: 0xff5f2e,
            violet: 0xff6a3d,
            periwinkle: 0xffb648,
            midnight: 0xb5321f
        },

        // Roles selectable in the Investor Network (Pro).
        INVESTOR_ROLES: ["Investor", "Startup Founder", "Angel Investor", "Advisor"],

        // Subscription tiers. `rank` drives visibility (higher = seen first).
        // `limits` of null mean unlimited. `capabilities` gate features.
        TIERS: {
            free: {
                key: "free",
                name: "Free",
                emoji: "",
                badge: "",
                price: 0,
                durationDays: null,
                rank: 0,
                color: 0x8a7d74,
                limits: { views: 50, likes: 25, searches: 10 },
                capabilities: [],
                perks: [
                    "Create & browse profiles",
                    "Basic search & matching",
                    "Friend & networking discovery"
                ]
            },
            premium: {
                key: "premium",
                name: "Premium",
                emoji: "👑",
                badge: "👑 Premium Member",
                price: 4.99,
                durationDays: 30,
                rank: 1,
                color: 0xff6a3d,
                limits: { views: null, likes: null, searches: null },
                capabilities: [
                    "advancedSearch",
                    "seeWhoLiked",
                    "featuredProfile",
                    "profileBoost",
                    "premiumHub",
                    "profileThemes",
                    "earlyAccess",
                    "priorityDiscovery"
                ],
                perks: [
                    "👑 Premium badge everywhere",
                    "Unlimited views, likes & searches",
                    "See who liked you (`/admirers`)",
                    "Profile boost & featured placement",
                    "Advanced multi-filter search",
                    "Premium Networking Hub",
                    "Custom profile themes",
                    "Early access to new features"
                ]
            },
            pro: {
                key: "pro",
                name: "Pro",
                emoji: "✅",
                badge: "✅ Verified Pro",
                price: 14.99,
                durationDays: 30,
                rank: 2,
                color: 0xe73b27,
                limits: { views: null, likes: null, searches: null },
                capabilities: [
                    // everything Premium has...
                    "advancedSearch",
                    "seeWhoLiked",
                    "featuredProfile",
                    "profileBoost",
                    "premiumHub",
                    "profileThemes",
                    "earlyAccess",
                    "priorityDiscovery",
                    // ...plus Pro-exclusive
                    "verifiedBadge",
                    "aiMatch",
                    "profileVisitors",
                    "analytics",
                    "founderNetwork",
                    "freelanceMarketplace",
                    "investorNetwork",
                    "portfolioShowcase",
                    "connect",
                    "recommend",
                    "betaProgram",
                    "vipDiscovery"
                ],
                perks: [
                    "✅ Verified Pro badge (ranks above Premium)",
                    "Everything in Premium",
                    "AI matchmaking (`/match-ai`)",
                    "Profile visitors (`/profile visitors`)",
                    "Analytics dashboard (`/profile analytics`)",
                    "Founder Network & Freelancer Marketplace",
                    "Investor Network & Portfolio Showcase",
                    "Direct connection requests (`/connect`)",
                    "AI recommendations (`/recommend`)",
                    "VIP discovery & beta program access"
                ]
            }
        }
    }
};
