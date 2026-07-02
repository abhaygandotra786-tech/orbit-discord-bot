/**
 * /help - a beautiful, grouped overview of everything Orbit can do.
 */

const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { brandedEmbed, DIVIDER } = require("../../utils/embed");
const premium = require("../../utils/premiumService");
const config = require("../../config/config");

// Each section: a titled group of `command` · description lines.
const SECTIONS = [
    {
        name: "🚀  Getting Started",
        lines: [
            "`/profile create`  ·  Build your profile",
            "`/profile view`  ·  View & customise yours",
            "`/profile edit`  ·  Update your details"
        ]
    },
    {
        name: "🔭  Discover",
        lines: [
            "`/profile browse`  ·  Browse the whole community",
            "`/search`  ·  Filter by location, skills, profession…",
            "`/networking` · `/freelance` · `/founder` · `/dating`"
        ]
    },
    {
        name: "💞  Connect",
        lines: [
            "`/like`  ·  Like a member — mutual likes match",
            "`/matches`  ·  See who you matched with",
            "`/friends` · `/friend-remove`  ·  Manage your circle"
        ]
    },
    {
        name: "👑  Premium",
        lines: [
            "`/premium plans`  ·  Membership tiers",
            "`/admirers`  ·  See who liked you",
            "`/premium-hub`  ·  Exclusive networking hub",
            "`/profile theme` · `/profile feature`  ·  Stand out"
        ]
    },
    {
        name: "✅  Pro",
        lines: [
            "`/match-ai`  ·  AI compatibility matching",
            "`/recommend`  ·  AI recommendations for you",
            "`/connect`  ·  Direct connection requests",
            "`/profile visitors` · `/profile analytics`",
            "`/founder match` · `/investor` · `/portfolio`"
        ]
    }
];

const ADMIN_SECTION = {
    name: "🛡️  Admin",
    lines: [
        "`/admin stats` · `/admin broadcast`",
        "`/admin grant-premium` · `/admin revoke-premium`",
        "`/admin ban-user` · `/admin unban-user` · `/admin delete-profile`"
    ]
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription(`Everything ${config.BOT_NAME} can do`),

    async execute(interaction) {
        // Defer first — attaching the banner can take a moment to upload.
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const isAdmin = config.ADMIN_IDS.includes(interaction.user.id);
        const tier = premium.meta(interaction.user.id);
        const planLine = tier.badge || "🆓 Free Member";

        const { embed, files } = brandedEmbed({
            title: "🪐 Orbit — Command Guide",
            description:
                "Your all-in-one community for **networking, founders, " +
                "freelancing, friends, gaming & dating.**\n\n" +
                `🎫 **Your plan** · ${planLine}\n` +
                `💫 **${tier.key === "free" ? "Upgrade with `/premium plans`" : "Thanks for supporting Orbit!"}**\n` +
                DIVIDER
        });

        for (const section of SECTIONS) {
            embed.addFields({ name: section.name, value: section.lines.join("\n") });
        }

        if (isAdmin) {
            embed.addFields({ name: ADMIN_SECTION.name, value: ADMIN_SECTION.lines.join("\n") });
        }

        embed.addFields({
            name: "🌐  More",
            value:
                `[Website](${config.WEBSITE})  ·  ` +
                `[Premium](${config.PREMIUM.PAYMENT_URL})  ·  ` +
                `Support: ${config.SUPPORT_SERVER}`
        });

        return interaction.editReply({ embeds: [embed], files });
    }
};
