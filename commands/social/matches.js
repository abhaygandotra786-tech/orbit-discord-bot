/**
 * /matches - view all your mutual matches.
 */

const { SlashCommandBuilder } = require("discord.js");

const { getMatches, otherUser } = require("../../database/matchQueries");
const { getProfile } = require("../../database/profileQueries");
const { baseEmbed, infoEmbed } = require("../../utils/embed");

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
                        "No matches yet. Like members with `/like` or while browsing.",
                        "No matches yet"
                    )
                ],
                ephemeral: true
            });
        }

        const embed = baseEmbed({
            title: "Your Matches",
            description: `You have **${matches.length}** match${matches.length === 1 ? "" : "es"}.`
        });

        for (const match of matches) {
            const otherId = otherUser(match, userId);
            const profile = getProfile.get(otherId);
            const details = profile
                ? [profile.profession, profile.location, profile.category]
                      .filter(Boolean)
                      .join(" · ")
                : "";

            embed.addFields({
                name: profile ? profile.name : "Unknown member",
                value: `${details ? details + "\n" : ""}<@${otherId}>`
            });
        }

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
