/**
 * /founder - browse and match within the Co-Founder category.
 */

const { SlashCommandBuilder } = require("discord.js");

const {
    getProfile,
    getProfilesByCategory
} = require("../../database/profileQueries");
const { startBrowse } = require("../../utils/browse");
const { showCategoryMatches } = require("../../utils/categoryMatches");
const { baseEmbed, errorEmbed, nameWithBadge } = require("../../utils/embed");
const { requireCapability } = require("../../utils/gate");
const { compatibility } = require("../../utils/similarity");
const config = require("../../config/config");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("founder")
        .setDescription("Co-Founder — find your business partner")
        .addSubcommand((s) =>
            s.setName("browse").setDescription("Browse co-founder profiles")
        )
        .addSubcommand((s) =>
            s.setName("matches").setDescription("View your co-founder matches")
        )
        .addSubcommand((s) =>
            s.setName("match").setDescription("Pro: AI-matched co-founders for you")
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        if (sub === "browse") {
            const profiles = getProfilesByCategory
                .all("Co-Founder")
                .filter((p) => p.user_id !== userId);

            return startBrowse(
                interaction,
                profiles,
                "founder",
                "No co-founder profiles available yet."
            );
        }

        if (sub === "matches") {
            return showCategoryMatches(interaction, "Co-Founder");
        }

        if (sub === "match") {
            if (!(await requireCapability(interaction, "founderNetwork", "The Founder Network")))
                return;

            const me = getProfile.get(userId);
            if (!me) {
                return interaction.reply({
                    embeds: [errorEmbed("Create a profile first with `/profile create`.")],
                    ephemeral: true
                });
            }

            const ranked = getProfilesByCategory
                .all("Co-Founder")
                .filter((p) => p.user_id !== userId)
                .map((p) => ({ p, r: compatibility(me, p) }))
                .sort((a, b) => b.r.score - a.r.score)
                .slice(0, 5);

            if (ranked.length === 0) {
                return interaction.reply({
                    embeds: [errorEmbed("No co-founders to match with yet.")],
                    ephemeral: true
                });
            }

            const embed = baseEmbed({
                title: "🚀 Your Co-Founder Matches",
                description: "AI-ranked by complementary skills and shared goals.",
                color: config.COLORS.PREMIUM
            });
            for (const { p, r } of ranked) {
                embed.addFields({
                    name: `${r.score}% — ${nameWithBadge(p)}`,
                    value: `💼 ${p.profession || "N/A"} • ${r.reasons[0]} • <@${p.user_id}>`
                });
            }
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
