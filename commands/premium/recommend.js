/**
 * /recommend - Pro: AI recommendations based on profile similarity.
 */

const { SlashCommandBuilder } = require("discord.js");

const {
    getProfile,
    getAllProfiles,
    getProfilesByCategory
} = require("../../database/profileQueries");
const { baseEmbed, errorEmbed, nameWithBadge } = require("../../utils/embed");
const { requireCapability } = require("../../utils/gate");
const { compatibility } = require("../../utils/similarity");
const config = require("../../config/config");

// Recommendation "types" map to a target category.
const TYPES = {
    friends: "Friends",
    "co-founders": "Co-Founder",
    freelancers: "Freelancing",
    networking: "Networking",
    matches: "Dating"
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName("recommend")
        .setDescription("Pro: get AI-powered recommendations")
        .addStringOption((o) =>
            o
                .setName("type")
                .setDescription("What to recommend")
                .addChoices(
                    ...Object.keys(TYPES).map((k) => ({ name: k, value: k }))
                )
        ),

    async execute(interaction) {
        if (!(await requireCapability(interaction, "recommend", "AI recommendations")))
            return;

        const me = getProfile.get(interaction.user.id);
        if (!me) {
            return interaction.reply({
                embeds: [errorEmbed("Create a profile first with `/profile create`.")],
                ephemeral: true
            });
        }

        const type = interaction.options.getString("type");
        const pool = type
            ? getProfilesByCategory.all(TYPES[type])
            : getAllProfiles.all();

        const ranked = pool
            .filter((p) => p.user_id !== me.user_id)
            .map((p) => ({ p, r: compatibility(me, p) }))
            .sort((a, b) => b.r.score - a.r.score)
            .slice(0, 5);

        if (ranked.length === 0) {
            return interaction.reply({
                embeds: [errorEmbed("No recommendations available yet.")],
                ephemeral: true
            });
        }

        const embed = baseEmbed({
            title: `💡 Recommended ${type ? `(${type})` : "for You"}`,
            description: "Curated by your skills, interests and goals.",
            color: config.COLORS.PREMIUM
        });

        for (const { p, r } of ranked) {
            embed.addFields({
                name: `${r.score}% — ${nameWithBadge(p)}`,
                value:
                    `💼 ${p.profession || "N/A"} • 📍 ${p.location || "N/A"}\n` +
                    `${r.reasons[0]} • <@${p.user_id}>`
            });
        }

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
