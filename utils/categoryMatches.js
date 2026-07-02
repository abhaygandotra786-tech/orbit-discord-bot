/**
 * Community Hub - Category match helper
 * Returns the current user's matches whose partner profile belongs to
 * a given category, rendered into a themed embed.
 */

const { getMatches, otherUser } = require("../database/matchQueries");
const { getProfile } = require("../database/profileQueries");
const { baseEmbed, infoEmbed } = require("./embed");
const { CATEGORY_EMOJI } = require("./constants");

/**
 * @param {import("discord.js").ChatInputCommandInteraction} interaction
 * @param {string} category
 */
async function showCategoryMatches(interaction, category) {
    const userId = interaction.user.id;
    const emoji = CATEGORY_EMOJI[category] || "🏷️";

    const partners = getMatches(userId)
        .map((m) => getProfile.get(otherUser(m, userId)))
        .filter((p) => p && p.category === category);

    if (partners.length === 0) {
        return interaction.reply({
            embeds: [
                infoEmbed(
                    `You have no ${category} matches yet.`,
                    `${emoji} No ${category} Matches`
                )
            ],
            ephemeral: true
        });
    }

    const embed = baseEmbed({
        title: `${emoji} Your ${category} Matches`,
        description: `You have **${partners.length}** ${category} match(es).`
    });

    for (const p of partners) {
        embed.addFields({
            name: `👤 ${p.name}`,
            value: `💼 ${p.profession || "N/A"} • 📍 ${
                p.location || "N/A"
            } • <@${p.user_id}>`
        });
    }

    return interaction.reply({ embeds: [embed], ephemeral: true });
}

module.exports = { showCategoryMatches };
