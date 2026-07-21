/**
 * /refer - your personal referral code and a shareable invite message.
 */
const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { baseEmbed } = require("../../utils/embed");
const referrals = require("../../utils/referralService");
const config = require("../../config/config");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("refer")
        .setDescription("Get your referral code to invite friends and earn rewards"),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const code = referrals.getOrCreateCode(interaction.user.id);

        const embed = baseEmbed({
            title: "🎁 Invite friends, earn rewards",
            description:
                `Your code: **\`${code}\`**\n\n` +
                "Share it. When a friend runs `/redeem` and gets their first match, you both win.",
            color: config.COLORS.PRIMARY
        });
        embed.addFields(
            {
                name: "Message to share",
                value: `Come meet people on Orbit. Run \`/redeem ${code}\` after you join to get a head start. ${config.SUPPORT_SERVER}`
            },
            {
                name: "What you earn",
                value:
                    "1 friend: match credits and Pro time\n" +
                    "3 friends: a month of Pro and the Vouched badge\n" +
                    "10 friends: a month of Premium and a custom accent"
            }
        );
        return interaction.editReply({ embeds: [embed] });
    }
};
