/**
 * /premium - view subscription plans and your current status.
 */

const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require("discord.js");

const premium = require("../../utils/premiumService");
const { baseEmbed, brandedEmbed, DIVIDER } = require("../../utils/embed");
const config = require("../../config/config");

function formatPrice(tier) {
    return `${config.PREMIUM.CURRENCY}${tier.price.toFixed(2)} / ${tier.durationDays} days`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("premium")
        .setDescription(`${require("../../config/config").BOT_NAME} Premium`)
        .addSubcommand((s) =>
            s.setName("plans").setDescription("View premium plans")
        )
        .addSubcommand((s) =>
            s.setName("status").setDescription("View your subscription status")
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const sub = interaction.options.getSubcommand();

        if (sub === "plans") {
            const { embed, files } = brandedEmbed({
                title: `✨ ${config.BOT_NAME} Membership`,
                description:
                    "Choose the plan that fits your goals.\n" +
                    "**Free** to explore • **👑 Premium** for visibility • **✅ Pro** for elite networking.\n" +
                    DIVIDER,
                color: config.COLORS.PREMIUM,
                banner: true
            });

            for (const tier of Object.values(config.PREMIUM.TIERS)) {
                const heading =
                    tier.key === "free"
                        ? "🆓 Free — $0"
                        : `${tier.emoji} ${tier.name} — ${formatPrice(tier)}`;
                embed.addFields({
                    name: heading,
                    value: tier.perks.map((p) => `✅ ${p}`).join("\n")
                });
            }

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("Upgrade Now")
                    .setEmoji("💳")
                    .setStyle(ButtonStyle.Link)
                    .setURL(config.PREMIUM.PAYMENT_URL)
            );

            return interaction.editReply({
                embeds: [embed],
                components: [row],
                files
            });
        }

        if (sub === "status") {
            const active = premium.getActive(interaction.user.id);

            if (!active) {
                return interaction.editReply({
                    embeds: [
                        baseEmbed({
                            title: "🆓 Free Member",
                            description:
                                "You're on the **Free** tier.\nUse `/premium plans` to upgrade and unlock unlimited likes, visibility boosts and more.",
                            color: config.COLORS.INFO
                        })
                    ]
                });
            }

            const tier = config.PREMIUM.TIERS[active.tier];
            const expires = Math.floor(active.expires_at / 1000);

            const { embed, files } = brandedEmbed({
                title: `${tier.emoji} ${tier.name} Member`,
                description: `Thanks for supporting ${config.BOT_NAME}! 💜\n${DIVIDER}`,
                color: tier.color,
                banner: true
            });
            embed.addFields(
                { name: "Tier", value: tier.badge || tier.name, inline: true },
                { name: "Renews / Expires", value: `<t:${expires}:R>`, inline: true },
                {
                    name: "Perks",
                    value: tier.perks.map((p) => `✅ ${p}`).join("\n")
                }
            );

            return interaction.editReply({ embeds: [embed], files });
        }
    }
};
