/**
 * /portfolio - Pro: portfolio showcase.
 *   set <projects> [link] - set your project showcase
 *   view [user]           - view a portfolio
 */

const { SlashCommandBuilder } = require("discord.js");

const {
    getProfile,
    setPortfolioProjects
} = require("../../database/profileQueries");
const { baseEmbed, successEmbed, errorEmbed } = require("../../utils/embed");
const { requireCapability } = require("../../utils/gate");
const config = require("../../config/config");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("portfolio")
        .setDescription("Pro: portfolio showcase")
        .addSubcommand((s) =>
            s
                .setName("set")
                .setDescription("Set your portfolio projects")
                .addStringOption((o) =>
                    o
                        .setName("projects")
                        .setDescription("Your projects (comma separated, or one per line)")
                        .setRequired(true)
                )
                .addStringOption((o) =>
                    o.setName("link").setDescription("Featured portfolio link")
                )
        )
        .addSubcommand((s) =>
            s
                .setName("view")
                .setDescription("View a portfolio")
                .addUserOption((o) =>
                    o.setName("user").setDescription("Whose portfolio (defaults to you)")
                )
        ),

    async execute(interaction) {
        if (!(await requireCapability(interaction, "portfolioShowcase", "Portfolio showcase")))
            return;

        const sub = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        if (sub === "set") {
            const profile = getProfile.get(userId);
            if (!profile) {
                return interaction.reply({
                    embeds: [errorEmbed("Create a profile first with `/profile create`.")],
                    ephemeral: true
                });
            }
            const projects = interaction.options.getString("projects");
            const link = interaction.options.getString("link") || profile.portfolio;
            setPortfolioProjects.run({
                user_id: userId,
                portfolio_projects: projects,
                portfolio: link || null
            });
            return interaction.reply({
                embeds: [successEmbed("Your portfolio showcase has been updated.", "📂 Portfolio Saved")],
                ephemeral: true
            });
        }

        if (sub === "view") {
            const target = interaction.options.getUser("user") || interaction.user;
            const profile = getProfile.get(target.id);
            if (!profile) {
                return interaction.reply({
                    embeds: [errorEmbed("That user has no profile.")],
                    ephemeral: true
                });
            }
            if (!profile.portfolio_projects && !profile.portfolio) {
                return interaction.reply({
                    embeds: [errorEmbed(`${profile.name} hasn't set up a portfolio yet.`)],
                    ephemeral: true
                });
            }

            const embed = baseEmbed({
                title: `📂 ${profile.name}'s Portfolio`,
                color: config.COLORS.PREMIUM
            });
            if (profile.portfolio_projects) {
                embed.addFields({ name: "🚀 Projects", value: profile.portfolio_projects });
            }
            if (profile.portfolio) {
                const url = /^https?:\/\//i.test(profile.portfolio)
                    ? profile.portfolio
                    : `https://${profile.portfolio}`;
                embed.addFields({ name: "🔗 Featured Link", value: `[${profile.portfolio}](${url})` });
            }
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
