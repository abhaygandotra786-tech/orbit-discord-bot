/**
 * /dating - 18+ dating browse and matches.
 *
 * Browsing requires the viewer to:
 *   - be 18 or older
 *   - have a gender set
 *   - have an "interested in" preference set
 *
 * Candidates are filtered by mutual gender preference and age >= 18.
 */

const { SlashCommandBuilder } = require("discord.js");

const {
    getProfile,
    getProfilesByCategory
} = require("../../database/profileQueries");
const { startBrowse } = require("../../utils/browse");
const { showCategoryMatches } = require("../../utils/categoryMatches");
const { errorEmbed } = require("../../utils/embed");

/**
 * Does `viewer` want to see `candidate` based on gender preference?
 */
function prefersGender(interestedIn, gender) {
    if (interestedIn === "Everyone") return true;
    return interestedIn === gender;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("dating")
        .setDescription("Dating (18+) — find a romantic connection")
        .addSubcommand((s) =>
            s.setName("browse").setDescription("Browse dating profiles (18+)")
        )
        .addSubcommand((s) =>
            s.setName("matches").setDescription("View your dating matches")
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const viewer = getProfile.get(interaction.user.id);

        if (!viewer) {
            return interaction.reply({
                embeds: [
                    errorEmbed(
                        "You need a profile first. Use `/profile create`."
                    )
                ],
                ephemeral: true
            });
        }

        if (sub === "matches") {
            return showCategoryMatches(interaction, "Dating");
        }

        // --- browse: enforce 18+ and required fields ---
        if (!viewer.age || viewer.age < 18) {
            return interaction.reply({
                embeds: [
                    errorEmbed(
                        "Dating is 18+ only. Your profile must list an age of 18 or older."
                    )
                ],
                ephemeral: true
            });
        }

        if (!viewer.gender || !viewer.interested_in) {
            return interaction.reply({
                embeds: [
                    errorEmbed(
                        "Dating requires both **Gender** and **Interested In** to be set. Update them via `/profile view`."
                    )
                ],
                ephemeral: true
            });
        }

        const candidates = getProfilesByCategory
            .all("Dating")
            .filter(
                (p) =>
                    p.user_id !== viewer.user_id &&
                    p.age >= 18 &&
                    p.gender &&
                    p.interested_in &&
                    // viewer is interested in candidate's gender
                    prefersGender(viewer.interested_in, p.gender) &&
                    // candidate is interested in viewer's gender
                    prefersGender(p.interested_in, viewer.gender)
            );

        return startBrowse(
            interaction,
            candidates,
            "dating",
            "No compatible dating profiles found right now."
        );
    }
};
