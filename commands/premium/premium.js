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
                description: "Three simple plans. Cancel anytime.",
                color: config.COLORS.PREMIUM
            });

            const clean = (p) => p.replace(/^[^\w`]+/, "").trim();
            const cur = config.PREMIUM.CURRENCY;

            // Three tidy columns — a clean comparison, not a wall of text.
            for (const tier of Object.values(config.PREMIUM.TIERS)) {
                const price =
                    tier.key === "free"
                        ? "**Free**"
                        : `**${cur}${tier.price.toFixed(2)}**/mo`;
                const label = tier.key === "premium" ? `${tier.name} ⭐` : tier.name;
                const perks = tier.perks
                    .slice(0, 3)
                    .map((p) => clean(p))
                    .join("\n");

                embed.addFields({
                    name: `${tier.emoji ? tier.emoji + " " : ""}${label}`,
                    value: `${price}\n\n${perks}`,
                    inline: true
                });
            }

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("Upgrade")
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

            const clean = (p) => p.replace(/^[^\w`]+/, "").trim();
            // Clean, compact status card — no oversized banner here.
            const embed = baseEmbed({
                title: `${tier.emoji} ${tier.name} Member`,
                description: `Thanks for supporting ${config.BOT_NAME} 🧡`,
                color: tier.color
            });
            embed.addFields(
                { name: "Plan", value: tier.name, inline: true },
                { name: "Renews", value: `<t:${expires}:R>`, inline: true },
                {
                    name: "Your perks",
                    value: tier.perks.slice(0, 4).map((p) => `• ${clean(p)}`).join("\n")
                }
            );

            return interaction.editReply({ embeds: [embed] });
        }
    }
};
