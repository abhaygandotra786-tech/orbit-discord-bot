/**
 * Community Hub - Master Configuration
 * ------------------------------------------------------------------
 * This is the single source of truth for all customizable settings.
 * Changing values here updates the behavior of the entire bot.
 */

module.exports = {
    // --- Identity ---
    BOT_NAME: "Orbit",

    // --- Embed theming (royal indigo) ---
    EMBED_COLOR: 0x6d63f5, // royal indigo — primary brand color
    COLORS: {
        PRIMARY: 0x6d63f5, // royal indigo
        SUCCESS: 0x5b50e0, // indigo (positive)
        ERROR: 0x7c3aed, // violet-indigo (errors)
        INFO: 0x818cf8, // light indigo
        PREMIUM: 0x9466ff // bright royal indigo (premium accents)
    },

    // --- Footer ---
    FOOTER: {
        TEXT: "Orbit • Connect · Discover · Grow",
        ICON: process.env.LOGO_URL || "" // small footer icon (uses logo)
    },

    // --- Branding ---
    // Public image URLs. On the website these fall back to /assets/logo.png
    // and /assets/banner.png. For Discord embeds they must be publicly
    // reachable URLs (set LOGO_URL / BANNER_URL in .env).
    LOGO_URL: process.env.LOGO_URL || "", // square logo (thumbnail / author icon)
    BANNER_URL: process.env.BANNER_URL || "", // wide banner (shown in embeds)

    // --- Links ---
    WEBSITE: "https://example.com",
    SUPPORT_SERVER: "https://discord.gg/your-invite",

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
    ADMIN_IDS: [
        // "123456789012345678"
    ],

    // --- Premium / Subscriptions (monetization) ---
    PREMIUM: {
        CURRENCY: "$",

        // Where users go to pay. Plug in Stripe / Ko-fi / Patreon / etc.
        PAYMENT_URL: "https://example.com/upgrade",

        // Available profile themes (Premium+). Maps name -> embed color.
        THEMES: {
            royal: 0x4f46e5,
            indigo: 0x6d63f5,
            violet: 0x9466ff,
            periwinkle: 0x8b80ff,
            midnight: 0x3730a3
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
                color: 0x6b6e8f,
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
                color: 0x8b80ff,
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
                color: 0x4f46e5,
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
