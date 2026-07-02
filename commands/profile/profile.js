/**
 * /profile - create, view, edit, delete and browse profiles.
 * Modal submits and component interactions are handled centrally in
 * events/interactionCreate.js.
 */

const { SlashCommandBuilder } = require("discord.js");

const {
    getProfile,
    deleteProfile,
    getAllProfiles,
    setTheme,
    setFeatured
} = require("../../database/profileQueries");

const {
    buildCoreModal,
    buildSetupRows
} = require("../../utils/profileComponents");

const { profileEmbed, successEmbed, errorEmbed, baseEmbed } = require("../../utils/embed");
const { startBrowse } = require("../../utils/browse");
const { requireCapability } = require("../../utils/gate");
const {
    getRecentViewers,
    countViews,
    countUniqueViewers
} = require("../../database/viewQueries");
const { getReceivedLikes } = require("../../database/likesQueries");
const { getMatches } = require("../../database/matchQueries");
const { CATEGORY_EMOJI } = require("../../utils/constants");
const config = require("../../config/config");
const logger = require("../../utils/logger");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("profile")
        .setDescription("Manage your Orbit profile")
        .addSubcommand((sub) =>
            sub.setName("create").setDescription("Create your profile")
        )
        .addSubcommand((sub) =>
            sub.setName("view").setDescription("View your profile")
        )
        .addSubcommand((sub) =>
            sub.setName("edit").setDescription("Edit your profile")
        )
        .addSubcommand((sub) =>
            sub.setName("delete").setDescription("Delete your profile")
        )
        .addSubcommand((sub) =>
            sub.setName("browse").setDescription("Browse community profiles")
        )
        .addSubcommand((sub) =>
            sub
                .setName("theme")
                .setDescription("Premium: customize your profile color")
                .addStringOption((o) =>
                    o
                        .setName("color")
                        .setDescription("Theme color")
                        .setRequired(true)
                        .addChoices(
                            ...Object.keys(require("../../config/config").PREMIUM.THEMES).map(
                                (c) => ({ name: c, value: c })
                            )
                        )
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("feature")
                .setDescription("Premium: feature your profile at the top for 7 days")
        )
        .addSubcommand((sub) =>
            sub
                .setName("visitors")
                .setDescription("Pro: see who viewed your profile")
        )
        .addSubcommand((sub) =>
            sub
                .setName("analytics")
                .setDescription("Pro: view your profile analytics dashboard")
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        if (sub === "create") {
            if (getProfile.get(userId)) {
                return interaction.reply({
                    embeds: [
                        errorEmbed(
                            "You already have a profile. Use `/profile edit` to change it."
                        )
                    ],
                    ephemeral: true
                });
            }
            return interaction.showModal(buildCoreModal());
        }

        if (sub === "edit") {
            const profile = getProfile.get(userId);
            if (!profile) {
                return interaction.reply({
                    embeds: [
                        errorEmbed(
                            "You don't have a profile yet. Use `/profile create`."
                        )
                    ],
                    ephemeral: true
                });
            }
            return interaction.showModal(buildCoreModal(profile));
        }

        if (sub === "view") {
            const profile = getProfile.get(userId);
            if (!profile) {
                return interaction.reply({
                    embeds: [
                        errorEmbed(
                            "You don't have a profile yet. Use `/profile create`."
                        )
                    ],
                    ephemeral: true
                });
            }
            return interaction.reply({
                embeds: [profileEmbed(profile)],
                components: buildSetupRows(profile),
                ephemeral: true
            });
        }

        if (sub === "delete") {
            const profile = getProfile.get(userId);
            if (!profile) {
                return interaction.reply({
                    embeds: [errorEmbed("You don't have a profile to delete.")],
                    ephemeral: true
                });
            }
            deleteProfile.run(userId);
            logger.profile(`Profile deleted by ${userId}`);
            return interaction.reply({
                embeds: [successEmbed("Your profile has been deleted.")],
                ephemeral: true
            });
        }

        if (sub === "browse") {
            const profiles = getAllProfiles
                .all()
                .filter((p) => p.user_id !== userId);

            return startBrowse(
                interaction,
                profiles,
                "browse",
                "There are no other profiles to browse yet."
            );
        }

        if (sub === "theme") {
            if (!(await requireCapability(interaction, "profileThemes", "Profile themes")))
                return;
            if (!getProfile.get(userId)) {
                return interaction.reply({
                    embeds: [errorEmbed("Create a profile first with `/profile create`.")],
                    ephemeral: true
                });
            }
            const color = interaction.options.getString("color");
            setTheme.run({ user_id: userId, theme: color });
            const profile = getProfile.get(userId);
            return interaction.reply({
                embeds: [
                    successEmbed(`Your profile theme is now **${color}**.`, "🎨 Theme Updated"),
                    profileEmbed(profile)
                ],
                ephemeral: true
            });
        }

        if (sub === "feature") {
            if (!(await requireCapability(interaction, "featuredProfile", "Featured profile")))
                return;
            if (!getProfile.get(userId)) {
                return interaction.reply({
                    embeds: [errorEmbed("Create a profile first with `/profile create`.")],
                    ephemeral: true
                });
            }
            const until = Date.now() + 7 * 24 * 60 * 60 * 1000;
            setFeatured.run({ user_id: userId, featured: 1, featured_until: until });
            logger.profile(`Profile featured by ${userId}`);
            return interaction.reply({
                embeds: [
                    successEmbed(
                        `🌟 Your profile is now **featured** at the top of discovery until <t:${Math.floor(
                            until / 1000
                        )}:D>.`,
                        "🌟 Profile Featured"
                    )
                ],
                ephemeral: true
            });
        }

        if (sub === "visitors") {
            if (!(await requireCapability(interaction, "profileVisitors", "Profile visitors")))
                return;

            const viewers = getRecentViewers.all(userId, 15);
            if (viewers.length === 0) {
                return interaction.reply({
                    embeds: [baseEmbed({ title: "👀 Profile Visitors", description: "No visitors yet." })],
                    ephemeral: true
                });
            }
            const embed = baseEmbed({
                title: "👀 Profile Visitors",
                description: `Your most recent **${viewers.length}** visitor(s).`,
                color: config.COLORS.PREMIUM
            });
            for (const v of viewers) {
                const vp = getProfile.get(v.viewer_id);
                const emoji = vp ? CATEGORY_EMOJI[vp.category] || "🏷️" : "🏷️";
                embed.addFields({
                    name: vp ? `👤 ${vp.name}` : "👤 Someone",
                    value: `${emoji} ${vp?.category || "N/A"} • viewed <t:${Math.floor(
                        v.last_viewed / 1000
                    )}:R> • <@${v.viewer_id}>`
                });
            }
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === "analytics") {
            if (!(await requireCapability(interaction, "analytics", "Analytics dashboard")))
                return;

            const profile = getProfile.get(userId);
            if (!profile) {
                return interaction.reply({
                    embeds: [errorEmbed("Create a profile first with `/profile create`.")],
                    ephemeral: true
                });
            }

            const totalViews = countViews.get(userId).count;
            const unique = countUniqueViewers.get(userId).count;
            const likesReceived = getReceivedLikes.all(userId).length;
            const matchCount = getMatches(userId).length;
            const matchRate =
                likesReceived > 0 ? Math.round((matchCount / likesReceived) * 100) : 0;

            const embed = baseEmbed({
                title: "📊 Analytics Dashboard",
                description: `Performance for **${profile.name}**\n${"━".repeat(28)}`,
                color: config.COLORS.PREMIUM
            }).addFields(
                { name: "👀 Total Views", value: String(totalViews), inline: true },
                { name: "🧑‍🤝‍🧑 Unique Viewers", value: String(unique), inline: true },
                {
                    name: "🔍 Search Appearances",
                    value: String(profile.search_appearances || 0),
                    inline: true
                },
                { name: "❤️ Likes Received", value: String(likesReceived), inline: true },
                { name: "✨ Matches", value: String(matchCount), inline: true },
                { name: "📈 Match Rate", value: `${matchRate}%`, inline: true },
                { name: "🛠️ Your Skills", value: profile.skills || "N/A" },
                { name: "🎯 Your Interests", value: profile.interests || "N/A" }
            );

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
