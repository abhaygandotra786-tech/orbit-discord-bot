/**
 * /friends - list your matched friends (mutual likes).
 */

const { SlashCommandBuilder } = require("discord.js");

const { getMatches, otherUser } = require("../../database/matchQueries");
const { getProfile } = require("../../database/profileQueries");
const { baseEmbed, infoEmbed } = require("../../utils/embed");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("friends")
        .setDescription("List your matched friends"),

    async execute(interaction) {
        const userId = interaction.user.id;
        const matches = getMatches(userId);

        if (matches.length === 0) {
            return interaction.reply({
                embeds: [
                    infoEmbed(
                        "No friends yet. Match with members to add them here.",
                        "No friends yet"
                    )
                ],
                ephemeral: true
            });
        }

        const embed = baseEmbed({
            title: "👥 Your Friends",
            description: `Connected with **${matches.length}** member${matches.length === 1 ? "" : "s"}. Use \`/friend-remove\` to remove one.`
        });

        for (const match of matches) {
            const otherId = otherUser(match, userId);
            const profile = getProfile.get(otherId);
            const details = profile
                ? [profile.profession, profile.location].filter(Boolean).join(" · ")
                : "";

            embed.addFields({
                name: profile ? profile.name : "Unknown member",
                value: `${details ? details + "\n" : ""}<@${otherId}>`
            });
        }

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
