/**
 * /networking - browse and match within the Networking category.
 */

const { SlashCommandBuilder } = require("discord.js");

const { getProfilesByCategory } = require("../../database/profileQueries");
const { startBrowse } = require("../../utils/browse");
const { showCategoryMatches } = require("../../utils/categoryMatches");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("networking")
        .setDescription("Networking — meet professionals")
        .addSubcommand((s) =>
            s.setName("browse").setDescription("Browse networking profiles")
        )
        .addSubcommand((s) =>
            s.setName("matches").setDescription("View your networking matches")
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === "browse") {
            const profiles = getProfilesByCategory
                .all("Networking")
                .filter((p) => p.user_id !== interaction.user.id);

            return startBrowse(
                interaction,
                profiles,
                "networking",
                "No networking profiles available yet."
            );
        }

        if (sub === "matches") {
            return showCategoryMatches(interaction, "Networking");
        }
    }
};
