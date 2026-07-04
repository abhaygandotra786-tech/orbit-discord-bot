/**
 * /admirers - Premium+: see who liked you (name, profession, location, category).
 */

const { SlashCommandBuilder } = require("discord.js");

const { getReceivedLikes, hasLiked } = require("../../database/likesQueries");
const { getProfile } = require("../../database/profileQueries");
const { baseEmbed, infoEmbed, nameWithBadge } = require("../../utils/embed");
const { requireCapability } = require("../../utils/gate");
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
                    infoEmbed("No one has liked you yet — keep browsing.", "Admirers")
                ],
                ephemeral: true
            });
        }

        const embed = baseEmbed({
            title: "💛 Your Admirers",
            description: `**${admirers.length}** member${admirers.length === 1 ? "" : "s"} liked you.`,
            color: config.COLORS.PREMIUM
        });

        for (const like of admirers) {
            const profile = getProfile.get(like.sender_id);
            if (!profile) continue;
            const mutual = hasLiked.get(userId, like.sender_id) ? "  ·  matched" : "";
            const details = [profile.profession, profile.location, profile.category]
                .filter(Boolean)
                .join(" · ");
            embed.addFields({
                name: `${nameWithBadge(profile)}${mutual}`,
                value: `${details ? details + "\n" : ""}<@${like.sender_id}>`
            });
        }

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
