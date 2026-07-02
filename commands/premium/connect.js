/**
 * /connect - Pro: direct connection requests.
 *   send <user> - send a connection request
 *   list        - view pending requests you've received (accept/decline)
 *   accepted    - view your accepted connections
 */

const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const {
    createConnection,
    getPendingForUser,
    getAcceptedForUser
} = require("../../database/connectionQueries");
const { getProfile } = require("../../database/profileQueries");
const { baseEmbed, successEmbed, errorEmbed } = require("../../utils/embed");
const { requireCapability } = require("../../utils/gate");
const config = require("../../config/config");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("connect")
        .setDescription("Pro: direct connection requests")
        .addSubcommand((s) =>
            s
                .setName("send")
                .setDescription("Send a connection request")
                .addUserOption((o) =>
                    o.setName("user").setDescription("Who to connect with").setRequired(true)
                )
        )
        .addSubcommand((s) =>
            s.setName("list").setDescription("View pending requests you've received")
        )
        .addSubcommand((s) =>
            s.setName("accepted").setDescription("View your accepted connections")
        ),

    async execute(interaction) {
        if (!(await requireCapability(interaction, "connect", "Direct connections"))) return;

        const sub = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        if (sub === "send") {
            const target = interaction.options.getUser("user");
            if (target.id === userId) {
                return interaction.reply({
                    embeds: [errorEmbed("You can't connect with yourself.")],
                    ephemeral: true
                });
            }
            if (!getProfile.get(target.id)) {
                return interaction.reply({
                    embeds: [errorEmbed("That user doesn't have a profile.")],
                    ephemeral: true
                });
            }

            createConnection.run({
                requester_id: userId,
                target_id: target.id,
                created_at: Date.now()
            });

            // Best-effort DM with accept/decline buttons.
            try {
                const me = getProfile.get(userId);
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`connect_accept:${userId}`)
                        .setLabel("Accept")
                        .setEmoji("✅")
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`connect_decline:${userId}`)
                        .setLabel("Decline")
                        .setEmoji("✖️")
                        .setStyle(ButtonStyle.Danger)
                );
                const dm = await target.createDM();
                await dm.send({
                    embeds: [
                        baseEmbed({
                            title: "🤝 New Connection Request",
                            description: `**${me?.name || interaction.user.username}** wants to connect with you on ${config.BOT_NAME}.`
                        })
                    ],
                    components: [row]
                });
            } catch {
                // DM closed — they can still see it via /connect list.
            }

            return interaction.reply({
                embeds: [
                    successEmbed(
                        `Connection request sent to **${target.username}**.`,
                        "🤝 Request Sent"
                    )
                ],
                ephemeral: true
            });
        }

        if (sub === "list") {
            const pending = getPendingForUser.all(userId);
            if (pending.length === 0) {
                return interaction.reply({
                    embeds: [baseEmbed({ title: "🤝 Pending Requests", description: "No pending requests." })],
                    ephemeral: true
                });
            }

            const embed = baseEmbed({
                title: "🤝 Pending Connection Requests",
                description: `You have **${pending.length}** request(s).`
            });
            const rows = [];
            for (const c of pending.slice(0, 5)) {
                const rp = getProfile.get(c.requester_id);
                embed.addFields({
                    name: rp ? `👤 ${rp.name}` : "👤 Someone",
                    value: `💼 ${rp?.profession || "N/A"} • <@${c.requester_id}>`
                });
                rows.push(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`connect_accept:${c.requester_id}`)
                            .setLabel(`Accept ${rp?.name || ""}`.trim())
                            .setEmoji("✅")
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId(`connect_decline:${c.requester_id}`)
                            .setLabel("Decline")
                            .setEmoji("✖️")
                            .setStyle(ButtonStyle.Danger)
                    )
                );
            }

            return interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
        }

        if (sub === "accepted") {
            const accepted = getAcceptedForUser.all(userId, userId);
            if (accepted.length === 0) {
                return interaction.reply({
                    embeds: [baseEmbed({ title: "🤝 Connections", description: "No connections yet." })],
                    ephemeral: true
                });
            }
            const embed = baseEmbed({
                title: "🤝 Your Connections",
                description: `You have **${accepted.length}** connection(s).`
            });
            for (const c of accepted) {
                const otherId = c.requester_id === userId ? c.target_id : c.requester_id;
                const op = getProfile.get(otherId);
                embed.addFields({
                    name: op ? `👤 ${op.name}` : "👤 Someone",
                    value: `💼 ${op?.profession || "N/A"} • <@${otherId}>`
                });
            }
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
