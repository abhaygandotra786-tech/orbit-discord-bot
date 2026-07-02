/**
 * /investor - Pro: the Investor Network.
 *   set-role <role> - identify as an Investor / Founder / Angel / Advisor
 *   browse          - browse the investor network
 */

const { SlashCommandBuilder } = require("discord.js");

const {
    getProfile,
    setInvestorRole,
    getInvestors
} = require("../../database/profileQueries");
const { startBrowse } = require("../../utils/browse");
const { successEmbed, errorEmbed } = require("../../utils/embed");
const { requireCapability } = require("../../utils/gate");
const config = require("../../config/config");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("investor")
        .setDescription("Pro: the Investor Network")
        .addSubcommand((s) =>
            s
                .setName("set-role")
                .setDescription("Identify your investor role")
                .addStringOption((o) =>
                    o
                        .setName("role")
                        .setDescription("Your role")
                        .setRequired(true)
                        .addChoices(
                            ...config.PREMIUM.INVESTOR_ROLES.map((r) => ({
                                name: r,
                                value: r
                            }))
                        )
                )
        )
        .addSubcommand((s) =>
            s.setName("browse").setDescription("Browse the investor network")
        ),

    async execute(interaction) {
        if (!(await requireCapability(interaction, "investorNetwork", "The Investor Network")))
            return;

        const sub = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        if (sub === "set-role") {
            if (!getProfile.get(userId)) {
                return interaction.reply({
                    embeds: [errorEmbed("Create a profile first with `/profile create`.")],
                    ephemeral: true
                });
            }
            const role = interaction.options.getString("role");
            setInvestorRole.run({ user_id: userId, investor_role: role });
            return interaction.reply({
                embeds: [
                    successEmbed(`You're now listed as **${role}** in the Investor Network.`, "💰 Role Set")
                ],
                ephemeral: true
            });
        }

        if (sub === "browse") {
            const profiles = getInvestors.all().filter((p) => p.user_id !== userId);
            return startBrowse(
                interaction,
                profiles,
                "investor",
                "No one has joined the Investor Network yet. Use `/investor set-role`."
            );
        }
    }
};
