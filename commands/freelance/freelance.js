/**
 * /freelance - browse the Freelancing category, optionally filtered by
 * skill or profession.
 */

const { SlashCommandBuilder } = require("discord.js");

const { getProfilesByCategory } = require("../../database/profileQueries");
const { startBrowse } = require("../../utils/browse");
const { requireCapability } = require("../../utils/gate");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("freelance")
        .setDescription("Freelancing — find freelancers and clients")
        .addSubcommand((s) =>
            s.setName("browse").setDescription("Browse all freelancers")
        )
        .addSubcommand((s) =>
            s
                .setName("browse-skills")
                .setDescription("Browse freelancers by skill")
                .addStringOption((o) =>
                    o
                        .setName("skill")
                        .setDescription("Skill to filter by")
                        .setRequired(true)
                )
        )
        .addSubcommand((s) =>
            s
                .setName("browse-profession")
                .setDescription("Browse freelancers by profession")
                .addStringOption((o) =>
                    o
                        .setName("profession")
                        .setDescription("Profession to filter by")
                        .setRequired(true)
                )
        )
        .addSubcommand((s) =>
            s.setName("clients").setDescription("Pro: find potential clients")
        )
        .addSubcommand((s) =>
            s.setName("projects").setDescription("Pro: browse freelancer project showcases")
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        let profiles = getProfilesByCategory
            .all("Freelancing")
            .filter((p) => p.user_id !== userId);

        if (sub === "browse-skills") {
            const skill = interaction.options.getString("skill").toLowerCase();
            profiles = profiles.filter((p) =>
                (p.skills || "").toLowerCase().includes(skill)
            );
            return startBrowse(
                interaction,
                profiles,
                "freelance",
                `No freelancers found with skill "${skill}".`
            );
        }

        if (sub === "browse-profession") {
            const prof = interaction.options
                .getString("profession")
                .toLowerCase();
            profiles = profiles.filter((p) =>
                (p.profession || "").toLowerCase().includes(prof)
            );
            return startBrowse(
                interaction,
                profiles,
                "freelance",
                `No freelancers found with profession "${prof}".`
            );
        }

        if (sub === "clients") {
            if (!(await requireCapability(interaction, "freelanceMarketplace", "The Freelancer Marketplace")))
                return;
            // Clients = members seeking talent (Networking / Co-Founder).
            const clients = getProfilesByCategory
                .all("Networking")
                .concat(getProfilesByCategory.all("Co-Founder"))
                .filter((p) => p.user_id !== userId);
            return startBrowse(
                interaction,
                clients,
                "freelance",
                "No potential clients available right now."
            );
        }

        if (sub === "projects") {
            if (!(await requireCapability(interaction, "freelanceMarketplace", "The Freelancer Marketplace")))
                return;
            const withProjects = profiles.filter((p) => p.portfolio_projects);
            return startBrowse(
                interaction,
                withProjects,
                "freelance",
                "No project showcases yet. Freelancers can add them with `/portfolio set`."
            );
        }

        // default: browse
        return startBrowse(
            interaction,
            profiles,
            "freelance",
            "No freelancer profiles available yet."
        );
    }
};
