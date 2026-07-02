/**
 * /match-ai - Pro: AI-style compatibility matching.
 */

const { SlashCommandBuilder } = require("discord.js");

const { getProfile, getAllProfiles } = require("../../database/profileQueries");
const { baseEmbed, errorEmbed, nameWithBadge } = require("../../utils/embed");
const { requireCapability } = require("../../utils/gate");
const { compatibility } = require("../../utils/similarity");
const config = require("../../config/config");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("match-ai")
        .setDescription("Pro: AI compatibility matching")
        .addUserOption((o) =>
            o
                .setName("user")
                .setDescription("Score compatibility with a specific user (optional)")
        ),

    async execute(interaction) {
        if (!(await requireCapability(interaction, "aiMatch", "AI matchmaking"))) return;

        const me = getProfile.get(interaction.user.id);
        if (!me) {
            return interaction.reply({
                embeds: [errorEmbed("Create a profile first with `/profile create`.")],
                ephemeral: true
            });
        }

        const target = interaction.options.getUser("user");

        // Direct comparison against one user.
        if (target) {
            const other = getProfile.get(target.id);
            if (!other) {
                return interaction.reply({
                    embeds: [errorEmbed("That user does not have a profile.")],
                    ephemeral: true
                });
            }
            const r = compatibility(me, other);
            return interaction.reply({
                embeds: [
                    baseEmbed({
                        title: `🤖 ${r.score}% Match with ${other.name}`,
                        description:
                            `${bar(r.score)}\n\n**Why you match:**\n` +
                            r.reasons.map((x) => `• ${x}`).join("\n"),
                        color: config.COLORS.PREMIUM
                    })
                ],
                ephemeral: true
            });
        }

        // Top matches across the community.
        const ranked = getAllProfiles
            .all()
            .filter((p) => p.user_id !== me.user_id)
            .map((p) => ({ p, r: compatibility(me, p) }))
            .sort((a, b) => b.r.score - a.r.score)
            .slice(0, 5);

        if (ranked.length === 0) {
            return interaction.reply({
                embeds: [errorEmbed("No other profiles to match with yet.")],
                ephemeral: true
            });
        }

        const embed = baseEmbed({
            title: "🤖 Your Top AI Matches",
            description: "Ranked by compatibility with your profile.",
            color: config.COLORS.PREMIUM
        });

        for (const { p, r } of ranked) {
            embed.addFields({
                name: `${r.score}% — ${nameWithBadge(p)}`,
                value: `${r.reasons.slice(0, 2).join(" • ")}\n<@${p.user_id}>`
            });
        }

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
};

function bar(score) {
    const filled = Math.round(score / 10);
    return "🟩".repeat(filled) + "⬜".repeat(10 - filled);
}
