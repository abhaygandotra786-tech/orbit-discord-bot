/**
 * /ping - check bot latency.
 */

const { SlashCommandBuilder } = require("discord.js");
const { baseEmbed } = require("../../utils/embed");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Check the bot's latency"),

    async execute(interaction) {
        const sent = await interaction.reply({
            embeds: [baseEmbed({ title: "🏓 Pinging..." })],
            fetchReply: true,
            ephemeral: true
        });

        const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
        const heartbeat = Math.round(interaction.client.ws.ping);

        return interaction.editReply({
            embeds: [
                baseEmbed({ title: "🏓 Pong!" }).addFields(
                    {
                        name: "Roundtrip",
                        value: `${roundtrip}ms`,
                        inline: true
                    },
                    {
                        name: "Websocket",
                        value: `${heartbeat < 0 ? "N/A" : heartbeat + "ms"}`,
                        inline: true
                    }
                )
            ]
        });
    }
};
