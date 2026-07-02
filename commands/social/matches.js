/**
 * /matches - view all your mutual matches.
 */

const { SlashCommandBuilder } = require("discord.js");

const { getMatches, otherUser } = require("../../database/matchQueries");
const { getProfile } = require("../../database/profileQueries");
const { baseEmbed, infoEmbed } = require("../../utils/embed");
const { CATEGORY_EMOJI } = require("../../utils/constants");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("matches")
        .setDescription("View all of your matches"),

    async execute(interaction) {
        const userId = interaction.user.id;
        const matches = getMatches(userId);

        if (matches.length === 0) {
            return interaction.reply({
                embeds: [
                    infoEmbed(
                        "You have no matches yet. Like other members with `/like` or while browsing!",
                        "💔 No Matches"
                    )
                ],
                ephemeral: true
            });
        }

        const embed = baseEmbed({
            title: "✨ Your Matches",
            description: `You have **${matches.length}** match(es).`
        });

        for (const match of matches) {
            const otherId = otherUser(match, userId);
            const profile = getProfile.get(otherId);
            const emoji = profile ? CATEGORY_EMOJI[profile.category] || "🏷️" : "🏷️";

            embed.addFields({
                name: profile ? `👤 ${profile.name}` : "👤 Unknown User",
                value: profile
                    ? `💼 ${profile.profession || "N/A"} • 📍 ${
                          profile.location || "N/A"
                      }\n${emoji} ${profile.category || "N/A"} • <@${otherId}>`
                    : `<@${otherId}>`
            });
        }

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
