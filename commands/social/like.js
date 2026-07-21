/**
 * /like - like another user. Creates a match if mutual.
 */

const { SlashCommandBuilder } = require("discord.js");

const { getProfile } = require("../../database/profileQueries");
const { like, canLike } = require("../../utils/likeService");
const { successEmbed, errorEmbed, matchCardEmbed, sayHiRow } = require("../../utils/embed");
const referrals = require("../../utils/referralService");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("like")
        .setDescription("Like another community member")
        .addUserOption((o) =>
            o
                .setName("user")
                .setDescription("The user you want to like")
                .setRequired(true)
        ),

    async execute(interaction) {
        const target = interaction.options.getUser("user");

        if (!getProfile.get(target.id)) {
            return interaction.reply({
                embeds: [errorEmbed("That user does not have a profile yet.")],
                ephemeral: true
            });
        }

        const result = like(interaction.user.id, target.id);

        if (!result.ok) {
            return interaction.reply({
                embeds: [errorEmbed(result.reason)],
                ephemeral: true
            });
        }

        if (result.matched) {
            // A match may activate a pending referral for either user.
            referrals.handleActivation(interaction.user.id, interaction.client);
            referrals.handleActivation(target.id, interaction.client);
            const me = getProfile.get(interaction.user.id);
            const them = getProfile.get(target.id);
            return interaction.reply({
                embeds: [matchCardEmbed({ nameA: me ? me.name : interaction.user.username, nameB: them ? them.name : target.username })],
                components: [sayHiRow(target.id, { withProfile: true })]
            });
        }

        const quota = canLike(interaction.user.id);
        const note =
            quota.limit === Infinity
                ? ""
                : `\n\n🔋 You have **${quota.remaining}** free like(s) left today.`;

        return interaction.reply({
            embeds: [
                successEmbed(
                    `You liked **${target.username}**. They'll match with you if they like you back!${note}`,
                    "❤️ Like Sent"
                )
            ],
            ephemeral: true
        });
    }
};