/**
 * /beta - Premium+ early access & Pro beta program overview.
 */

const { SlashCommandBuilder } = require("discord.js");

const { baseEmbed } = require("../../utils/embed");
const { requireCapability } = require("../../utils/gate");
const premium = require("../../utils/premiumService");
const config = require("../../config/config");

// Experimental features and the capability that unlocks them.
const EXPERIMENTS = [
    { name: "🤖 AI Matchmaking Engine", cap: "aiMatch", cmd: "/match-ai" },
    { name: "💡 Smart Recommendations", cap: "recommend", cmd: "/recommend" },
    { name: "📊 Analytics Dashboard", cap: "analytics", cmd: "/profile analytics" },
    { name: "👀 Visitor Tracking", cap: "profileVisitors", cmd: "/profile visitors" },
    { name: "🎨 Profile Themes", cap: "profileThemes", cmd: "/profile theme" },
    { name: "🌟 Featured Placement", cap: "featuredProfile", cmd: "/profile feature" }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("beta")
        .setDescription("Premium: early access & beta features"),

    async execute(interaction) {
        if (!(await requireCapability(interaction, "earlyAccess", "The Early Access program")))
            return;

        const userId = interaction.user.id;
        const meta = premium.meta(userId);

        const embed = baseEmbed({
            title: "🧪 Early Access & Beta Program",
            description:
                `You're a **${meta.badge || meta.name}** member with early access.\n` +
                "Here's what's unlocked for you right now:",
            color: config.COLORS.PREMIUM
        });

        const unlocked = [];
        const locked = [];
        for (const e of EXPERIMENTS) {
            (premium.has(userId, e.cap) ? unlocked : locked).push(
                `${e.name} — \`${e.cmd}\``
            );
        }

        embed.addFields({
            name: "✅ Available to You",
            value: unlocked.length ? unlocked.join("\n") : "—"
        });
        if (locked.length) {
            embed.addFields({
                name: "🔒 Unlock with Pro",
                value: locked.join("\n")
            });
        }

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
