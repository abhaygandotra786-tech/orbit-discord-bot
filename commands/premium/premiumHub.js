/**
 * /premium-hub - Premium+: the exclusive Premium Networking Hub.
 * Curated lists of Premium & Pro members across key categories.
 */

const { SlashCommandBuilder } = require("discord.js");

const { getAllProfiles } = require("../../database/profileQueries");
const { baseEmbed, nameWithBadge } = require("../../utils/embed");
const { requireCapability } = require("../../utils/gate");
const premium = require("../../utils/premiumService");
const config = require("../../config/config");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("premium-hub")
        .setDescription("Premium: exclusive networking hub"),

    async execute(interaction) {
        if (!(await requireCapability(interaction, "premiumHub", "The Premium Networking Hub")))
            return;

        // Only Premium/Pro members appear in the hub.
        const members = getAllProfiles
            .all()
            .filter((p) => premium.isPremium(p.user_id) && p.user_id !== interaction.user.id);

        const embed = baseEmbed({
            title: "👑 Premium Networking Hub",
            description:
                "An exclusive space for Premium & Pro members.\n" +
                "Connect with verified, high-intent professionals.",
            color: config.COLORS.PREMIUM
        });

        const sections = {
            "🤝 Premium Networking": ["Networking"],
            "💼 Premium Freelancers": ["Freelancing"],
            "🚀 Premium Founders": ["Co-Founder"]
        };

        let any = false;
        for (const [title, cats] of Object.entries(sections)) {
            const list = members
                .filter((p) => cats.includes(p.category))
                .slice(0, 5)
                .map((p) => `${nameWithBadge(p)} — 💼 ${p.profession || "N/A"} • <@${p.user_id}>`);
            if (list.length) {
                any = true;
                embed.addFields({ name: title, value: list.join("\n") });
            }
        }

        if (!any) {
            embed.addFields({
                name: "✨ Be the First",
                value: "No premium members in these categories yet — invite your network!"
            });
        }

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
