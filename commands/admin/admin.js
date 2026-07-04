/**
 * /admin - administrative commands. Restricted to ADMIN_IDS in config.
 * The `adminOnly` flag is enforced centrally in interactionCreate.js.
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

const {
    countProfiles,
    deleteProfile,
    getProfile,
    getAllProfiles
} = require("../../database/profileQueries");
const { countLikes } = require("../../database/likesQueries");
const { countMatches } = require("../../database/matchQueries");
const { banUser, unbanUser, getBan } = require("../../database/banQueries");
const {
    countActiveSubscriptions
} = require("../../database/subscriptionQueries");
const premium = require("../../utils/premiumService");

const { baseEmbed, successEmbed, errorEmbed } = require("../../utils/embed");
const config = require("../../config/config");
const logger = require("../../utils/logger");

const TIER_CHOICES = Object.values(config.PREMIUM.TIERS)
    .filter((t) => t.key !== "free")
    .map((t) => ({ name: t.name, value: t.key }));

module.exports = {
    adminOnly: true,

    data: new SlashCommandBuilder()
        .setName("admin")
        .setDescription("Administrative tools")
        // Hidden from regular members in the UI; runtime check further
        // restricts execution to ADMIN_IDS only.
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false)
        .addSubcommand((s) =>
            s.setName("stats").setDescription("View bot statistics")
        )
        .addSubcommand((s) =>
            s
                .setName("broadcast")
                .setDescription("DM a message to all profile owners")
                .addStringOption((o) =>
                    o
                        .setName("message")
                        .setDescription("The message to broadcast")
                        .setRequired(true)
                )
        )
        .addSubcommand((s) =>
            s
                .setName("delete-profile")
                .setDescription("Delete a user's profile")
                .addUserOption((o) =>
                    o
                        .setName("user")
                        .setDescription("User whose profile to delete")
                        .setRequired(true)
                )
        )
        .addSubcommand((s) =>
            s
                .setName("ban-user")
                .setDescription("Ban a user from the bot")
                .addUserOption((o) =>
                    o.setName("user").setDescription("User to ban").setRequired(true)
                )
                .addStringOption((o) =>
                    o.setName("reason").setDescription("Reason for the ban")
                )
        )
        .addSubcommand((s) =>
            s
                .setName("unban-user")
                .setDescription("Unban a user")
                .addUserOption((o) =>
                    o
                        .setName("user")
                        .setDescription("User to unban")
                        .setRequired(true)
                )
        )
        .addSubcommand((s) =>
            s
                .setName("grant-premium")
                .setDescription("Grant a premium subscription")
                .addUserOption((o) =>
                    o.setName("user").setDescription("User to upgrade").setRequired(true)
                )
                .addStringOption((o) =>
                    o
                        .setName("tier")
                        .setDescription("Subscription tier")
                        .setRequired(true)
                        .addChoices(...TIER_CHOICES)
                )
                .addIntegerOption((o) =>
                    o
                        .setName("days")
                        .setDescription("Duration in days (defaults to tier length)")
                        .setMinValue(1)
                )
        )
        .addSubcommand((s) =>
            s
                .setName("revoke-premium")
                .setDescription("Revoke a premium subscription")
                .addUserOption((o) =>
                    o
                        .setName("user")
                        .setDescription("User to downgrade")
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const admin = interaction.user;

        if (sub === "stats") {
            const embed = baseEmbed({ title: "🛡️ Bot Statistics" }).addFields(
                {
                    name: "👤 Total Profiles",
                    value: String(countProfiles.get().count),
                    inline: true
                },
                {
                    name: "❤️ Total Likes",
                    value: String(countLikes.get().count),
                    inline: true
                },
                {
                    name: "✨ Total Matches",
                    value: String(countMatches.get().count),
                    inline: true
                },
                {
                    name: "💎 Active Premium",
                    value: String(countActiveSubscriptions.get(Date.now()).count),
                    inline: true
                },
                {
                    name: "🌐 Total Servers",
                    value: String(interaction.client.guilds.cache.size),
                    inline: true
                },
                {
                    name: "👥 Total Users",
                    value: String(
                        interaction.client.guilds.cache.reduce(
                            (acc, g) => acc + (g.memberCount || 0),
                            0
                        )
                    ),
                    inline: true
                }
            );
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === "broadcast") {
            const message = interaction.options.getString("message");
            await interaction.reply({
                embeds: [successEmbed("Broadcast started...", "📣 Broadcasting")],
                ephemeral: true
            });

            const profiles = getAllProfiles.all();
            let sent = 0;
            let failed = 0;

            const embed = baseEmbed({
                title: `📣 ${config.BOT_NAME} Announcement`,
                description: message
            });

            for (const p of profiles) {
                try {
                    const user = await interaction.client.users.fetch(p.user_id);
                    await user.send({ embeds: [embed] });
                    sent++;
                } catch {
                    failed++;
                }
            }

            logger.admin(
                `${admin.id} broadcast a message (sent: ${sent}, failed: ${failed})`
            );

            return interaction.followUp({
                embeds: [
                    successEmbed(
                        `Delivered to **${sent}** user(s). Failed: **${failed}**.`,
                        "📣 Broadcast Complete"
                    )
                ],
                ephemeral: true
            });
        }

        if (sub === "delete-profile") {
            const target = interaction.options.getUser("user");
            if (!getProfile.get(target.id)) {
                return interaction.reply({
                    embeds: [errorEmbed("That user has no profile.")],
                    ephemeral: true
                });
            }
            deleteProfile.run(target.id);
            logger.admin(`${admin.id} deleted profile of ${target.id}`);
            return interaction.reply({
                embeds: [
                    successEmbed(`Deleted **${target.username}**'s profile.`)
                ],
                ephemeral: true
            });
        }

        if (sub === "ban-user") {
            const target = interaction.options.getUser("user");
            const reason =
                interaction.options.getString("reason") || "No reason provided";

            banUser.run({
                user_id: target.id,
                reason,
                banned_by: admin.id
            });
            deleteProfile.run(target.id); // banned users lose their profile

            logger.admin(`${admin.id} banned ${target.id} — ${reason}`);

            return interaction.reply({
                embeds: [
                    successEmbed(
                        `**${target.username}** has been banned.\nReason: ${reason}`,
                        "🔨 User Banned"
                    )
                ],
                ephemeral: true
            });
        }

        if (sub === "unban-user") {
            const target = interaction.options.getUser("user");
            if (!getBan.get(target.id)) {
                return interaction.reply({
                    embeds: [errorEmbed("That user is not banned.")],
                    ephemeral: true
                });
            }
            unbanUser.run(target.id);
            logger.admin(`${admin.id} unbanned ${target.id}`);
            return interaction.reply({
                embeds: [
                    successEmbed(`**${target.username}** has been unbanned.`)
                ],
                ephemeral: true
            });
        }

        if (sub === "grant-premium") {
            const target = interaction.options.getUser("user");
            const tierKey = interaction.options.getString("tier");
            const days = interaction.options.getInteger("days");
            const tier = config.PREMIUM.TIERS[tierKey];

            const record = premium.grant(target.id, tierKey, days, admin.id);
            const expires = Math.floor(record.expires_at / 1000);

            return interaction.reply({
                embeds: [
                    successEmbed(
                        `Granted **${tier.emoji} ${tier.name}** to **${target.username}**.\nExpires <t:${expires}:R>.`,
                        "💎 Premium Granted"
                    )
                ],
                ephemeral: true
            });
        }

        if (sub === "revoke-premium") {
            const target = interaction.options.getUser("user");
            if (!premium.getActive(target.id)) {
                return interaction.reply({
                    embeds: [errorEmbed("That user has no active subscription.")],
                    ephemeral: true
                });
            }
            premium.revoke(target.id);
            return interaction.reply({
                embeds: [
                    successEmbed(
                        `Revoked premium from **${target.username}**.`,
                        "💎 Premium Revoked"
                    )
                ],
                ephemeral: true
            });
        }
    }
};
