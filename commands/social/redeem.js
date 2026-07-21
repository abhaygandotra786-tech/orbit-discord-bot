/**
 * /redeem <code> - credit the friend who invited you, and grab a welcome bonus.
 */
const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { baseEmbed, errorEmbed } = require("../../utils/embed");
const referrals = require("../../utils/referralService");
const R = require("../../config/rewards");
const config = require("../../config/config");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("redeem")
        .setDescription("Redeem a friend's referral code")
        .addStringOption((o) =>
            o.setName("code").setDescription("The referral code you were given").setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const code = interaction.options.getString("code");
        const joinedAt = interaction.member && interaction.member.joinedTimestamp;

        const res = referrals.redeem(interaction.user.id, code, { joinedAt });
        if (!res.ok) {
            return interaction.editReply({ embeds: [errorEmbed(res.error)] });
        }

        const wb = R.REFERRAL.WELCOME_BONUS;
        const tierName = config.PREMIUM.TIERS[R.TIER.common].name;
        const embed = baseEmbed({
            title: "🎉 Code redeemed",
            description: "Welcome to Orbit! Here is your head start:",
            color: config.COLORS.SUCCESS
        });
        embed.addFields({
            name: "You earned",
            value: `• +${wb.credits} match credit\n• ${wb.tierHours}h of ${tierName}`
        });
        embed.addFields({
            name: "Next step",
            value: "Run `/profile create` and you will be matched this week. Your friend gets rewarded once you get your first match."
        });
        return interaction.editReply({ embeds: [embed] });
    }
};
