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
                        "You have no friends yet. Match with members to add them here!",
                        "👥 No Friends Yet"
                    )
                ],
                ephemeral: true
            });
        }

        const embed = baseEmbed({
            title: "👥 Your Friends",
            description: `You are connected with **${matches.length}** member(s). Use \`/friend-remove\` to remove one.`
        });

        for (const match of matches) {
            const otherId = otherUser(match, userId);
            const profile = getProfile.get(otherId);

            embed.addFields({
                name: profile ? `👤 ${profile.name}` : "👤 Unknown User",
                value: `📍 ${profile?.location || "N/A"} • 💼 ${
                    profile?.profession || "N/A"
                } • <@${otherId}>`
            });
        }

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
