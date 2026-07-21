/**
 * /referrals - your code, pending invites, activated count, and progress.
 */
const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { baseEmbed } = require("../../utils/embed");
const referrals = require("../../utils/referralService");
const config = require("../../config/config");

function bar(current, target) {
    const total = 10;
    const filled = Math.max(0, Math.min(total, Math.round((current / (target || 1)) * total)));
    return "▰".repeat(filled) + "▱".repeat(total - filled);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("referrals")
        .setDescription("See your referral progress and rewards"),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const s = referrals.stats(interaction.user.id);

        const embed = baseEmbed({
            title: "📊 Your referrals",
            description: `Your code: **\`${s.code}\`** • Share it with \`/refer\`.`,
            color: config.COLORS.PRIMARY
        });
        embed.addFields(
            { name: "✅ Activated", value: String(s.activated), inline: true },
            { name: "⏳ Pending", value: String(s.pending), inline: true }
        );
        if (s.next) {
            embed.addFields({
                name: `Progress to ${s.next} referrals`,
                value: `${bar(s.activated, s.next)}  ${s.activated}/${s.next}`
            });
        } else {
            embed.addFields({ name: "🏆 Maxed out", value: "You have unlocked every referral reward. Legend." });
        }
        embed.addFields({
            name: "How activation works",
            value: "A referral counts when your friend completes a profile and gets their first match."
        });
        return interaction.editReply({ embeds: [embed] });
    }
};
