/**
 * /help - a clean, scannable overview of everything Orbit can do.
 */

const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { brandedEmbed } = require("../../utils/embed");
const premium = require("../../utils/premiumService");
const config = require("../../config/config");

const SECTIONS = [
    {
        name: "Getting Started",
        lines: [
            "`/profile create` — build your profile",
            "`/profile view` — view & customise",
            "`/profile edit` — update your details"
        ]
    },
    {
        name: "Discover",
        lines: [
            "`/profile browse` — browse the community",
            "`/search` — filter by skills, location, profession…",
            "`/networking` · `/freelance` · `/founder` · `/dating`"
        ]
    },
    {
        name: "Connect",
        lines: [
            "`/like` — like a member (mutual = a match)",
            "`/matches` — your matches",
            "`/friends` · `/friend-remove`"
        ]
    },
    {
        name: "Premium",
        lines: [
            "`/premium plans` — membership tiers",
            "`/admirers` — see who liked you",
            "`/premium-hub` · `/profile theme` · `/profile feature`"
        ]
    },
    {
        name: "Pro",
        lines: [
            "`/match-ai` — AI compatibility matching",
            "`/recommend` — AI recommendations",
            "`/connect` · `/profile visitors` · `/profile analytics`",
            "`/founder match` · `/investor` · `/portfolio`"
        ]
    }
];

const ADMIN_SECTION = {
    name: "Admin",
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
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const isAdmin = config.ADMIN_IDS.includes(interaction.user.id);
        const tier = premium.meta(interaction.user.id);
        const planLine = tier.badge || "Free";

        const { embed, files } = brandedEmbed({
            title: `${config.BOT_NAME} — Commands`,
            description: `One community bot for everything.\n**Your plan:** ${planLine}`
        });

        for (const section of SECTIONS) {
            embed.addFields({ name: section.name, value: section.lines.join("\n") });
        }
        if (isAdmin) {
            embed.addFields({ name: ADMIN_SECTION.name, value: ADMIN_SECTION.lines.join("\n") });
        }
        embed.addFields({
            name: "Links",
            value: `[Website](${config.WEBSITE})  ·  [Premium](${config.PREMIUM.PAYMENT_URL})`
        });

        return interaction.editReply({ embeds: [embed], files });
    }
};
