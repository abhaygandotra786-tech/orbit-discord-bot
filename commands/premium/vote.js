/**
 * /vote - top.gg vote link, current streak, cooldown, and next unlock.
 */
const {
    SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require("discord.js");
const { baseEmbed } = require("../../utils/embed");
const vote = require("../../utils/voteService");
const R = require("../../config/rewards");
const config = require("../../config/config");

function fmtLeft(ms) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("vote")
        .setDescription("Vote for Orbit on top.gg and earn perks"),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const uid = interaction.user.id;
        const st = vote.state(uid);
        const left = vote.cooldownLeft(uid);
        const tierName = config.PREMIUM.TIERS[R.TIER.common].name;

        let nextUnlock;
        if (st.streak < 3) nextUnlock = "Reach a **3 day streak** for the Rising Supporter role and a highlighted profile.";
        else if (st.streak < 7) nextUnlock = `Reach a **7 day streak** for early match drops and +7 bonus ${tierName} days.`;
        else nextUnlock = "Keep your streak alive to stay in early access. 30 total votes unlocks the OG Supporter badge.";

        const embed = baseEmbed({
            title: "🗳️ Vote for Orbit",
            description: `Every vote gives you **+${R.VOTE.CREDITS_PER_VOTE} bonus match** and **${R.VOTE.TIER_HOURS_PER_VOTE}h of ${tierName}**. Weekends count double.`,
            color: config.COLORS.PRIMARY
        });
        embed.addFields(
            { name: "🔥 Current streak", value: st.streak ? `${st.streak} day${st.streak > 1 ? "s" : ""} (best ${st.best})` : "No streak yet", inline: true },
            { name: "⏳ Next vote", value: left > 0 ? `in ${fmtLeft(left)}` : "available now", inline: true },
            { name: "✨ Next unlock", value: nextUnlock }
        );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel("Vote on top.gg").setEmoji("🗳️").setStyle(ButtonStyle.Link).setURL(R.TOPGG.VOTE_URL),
            new ButtonBuilder().setCustomId("vote_remind").setLabel(st.reminderOptIn ? "Reminders on ✓" : "Remind me").setStyle(ButtonStyle.Secondary)
        );
        return interaction.editReply({ embeds: [embed], components: [row] });
    }
};
