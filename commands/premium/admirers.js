/**
 * /admirers - Premium+: see who liked you (name, profession, location, category).
 */

const { SlashCommandBuilder } = require("discord.js");

const { getReceivedLikes, hasLiked } = require("../../database/likesQueries");
const { getProfile } = require("../../database/profileQueries");
const { baseEmbed, infoEmbed, nameWithBadge } = require("../../utils/embed");
const { requireCapability } = require("../../utils/gate");
const { CATEGORY_EMOJI } = require("../../utils/constants");
const config = require("../../config/config");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("admirers")
        .setDescription("Premium: see who liked you"),

    async execute(interaction) {
        if (!(await requireCapability(interaction, "seeWhoLiked", "Seeing who liked you")))
            return;

        const userId = interaction.user.id;
        const admirers = getReceivedLikes.all(userId);

        if (admirers.length === 0) {
            return interaction.reply({
                embeds: [
                    infoEmbed("No one has liked you yet — keep browsing!", "💛 Admirers")
                ],
                ephemeral: true
            });
        }

        const embed = baseEmbed({
            title: "💛 Your Admirers",
            description: `**${admirers.length}** member(s) liked you.`,
            color: config.COLORS.PREMIUM
        });

        for (const like of admirers) {
            const profile = getProfile.get(like.sender_id);
            if (!profile) continue;
            const mutual = hasLiked.get(userId, like.sender_id) ? " ✨ *(matched)*" : "";
            const emoji = CATEGORY_EMOJI[profile.category] || "🏷️";
            embed.addFields({
                name: `${nameWithBadge(profile)}${mutual}`,
                value:
                    `💼 ${profile.profession || "N/A"} • 📍 ${profile.location || "N/A"}\n` +
                    `${emoji} ${profile.category || "N/A"} • <@${like.sender_id}>`
            });
        }

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
