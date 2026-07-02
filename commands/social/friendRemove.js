/**
 * /friend-remove - remove a matched friend (deletes the match and the
 * underlying likes between the two users).
 */

const { SlashCommandBuilder } = require("discord.js");

const { deleteMatch, matchExists } = require("../../database/matchQueries");
const { removeLike } = require("../../database/likesQueries");
const { successEmbed, errorEmbed } = require("../../utils/embed");
const logger = require("../../utils/logger");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("friend-remove")
        .setDescription("Remove a matched friend")
        .addUserOption((o) =>
            o
                .setName("user")
                .setDescription("The friend to remove")
                .setRequired(true)
        ),

    async execute(interaction) {
        const userId = interaction.user.id;
        const target = interaction.options.getUser("user");

        if (!matchExists(userId, target.id)) {
            return interaction.reply({
                embeds: [errorEmbed("You are not matched with that user.")],
                ephemeral: true
            });
        }

        deleteMatch(userId, target.id);
        removeLike.run(userId, target.id);
        removeLike.run(target.id, userId);

        logger.match(`${userId} removed friend ${target.id}`);

        return interaction.reply({
            embeds: [
                successEmbed(
                    `**${target.username}** has been removed from your friends.`,
                    "👋 Friend Removed"
                )
            ],
            ephemeral: true
        });
    }
};
