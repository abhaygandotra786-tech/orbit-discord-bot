/**
 * Community Hub - Feature gate
 * ------------------------------------------------------------------
 * Helper to enforce capability-based access. Replies with a themed
 * upsell embed when the user's tier lacks the capability.
 */

const premium = require("./premiumService");
const { baseEmbed } = require("./embed");
const config = require("../config/config");

// Friendly labels + the minimum tier that unlocks each capability.
const CAPABILITY_TIER = {
    advancedSearch: "Premium",
    seeWhoLiked: "Premium",
    featuredProfile: "Premium",
    profileBoost: "Premium",
    premiumHub: "Premium",
    profileThemes: "Premium",
    earlyAccess: "Premium",
    priorityDiscovery: "Premium",
    verifiedBadge: "Pro",
    aiMatch: "Pro",
    profileVisitors: "Pro",
    analytics: "Pro",
    founderNetwork: "Pro",
    freelanceMarketplace: "Pro",
    investorNetwork: "Pro",
    portfolioShowcase: "Pro",
    connect: "Pro",
    recommend: "Pro",
    betaProgram: "Pro",
    vipDiscovery: "Pro"
};

/**
 * @param {import("discord.js").ChatInputCommandInteraction} interaction
 * @param {string} capability
 * @param {string} [featureName] friendly name for the upsell message
 * @returns {Promise<boolean>} true if allowed (and nothing replied)
 */
async function requireCapability(interaction, capability, featureName) {
    if (premium.has(interaction.user.id, capability)) return true;

    const tierName = CAPABILITY_TIER[capability] || "Premium";

    await interaction.reply({
        embeds: [
            baseEmbed({
                title: `🔒 ${tierName} Feature`,
                description:
                    `${featureName || "This feature"} is exclusive to **${tierName}** members.\n` +
                    `Use \`/premium plans\` to unlock it and a whole lot more.`,
                color: config.COLORS.PREMIUM
            })
        ],
        ephemeral: true
    });
    return false;
}

module.exports = { requireCapability, CAPABILITY_TIER };
