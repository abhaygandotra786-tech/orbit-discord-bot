/**
 * Fired when Orbit is added to a new server.
 * Sends an eye-catching welcome message to the best available channel.
 */

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    ChannelType
} = require("discord.js");

const { createOrbitEmbed } = require("../utils/embed");
const S = require("../config/strings");
const config = require("../config/config");
const logger = require("../utils/logger");

module.exports = {
    name: "guildCreate",

    async execute(guild, client) {
        logger.info(`Joined new server: ${guild.name} (${guild.id})`);

        const channel = findWelcomeChannel(guild);
        if (!channel) return;

        const embed = createOrbitEmbed({
            title: S.welcome.title,
            body: S.welcome.body,
            footer: config.WEBSITE.replace(/^https?:\/\//, "")
        });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("welcome_create")
                .setLabel(S.welcome.createButton)
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setLabel(S.welcome.helpButton)
                .setStyle(ButtonStyle.Link)
                .setURL(config.WEBSITE)
        );

        try {
            await channel.send({ embeds: [embed], components: [row] });
        } catch (err) {
            logger.error(`Could not send welcome message in ${guild.name}`, err);
        }
    }
};

/**
 * Pick the best channel to greet a new server:
 * the system channel if usable, otherwise the first text channel where
 * Orbit can view + send messages.
 */
function findWelcomeChannel(guild) {
    const me = guild.members.me;
    if (!me) return null;

    const canSend = (ch) =>
        ch &&
        ch.type === ChannelType.GuildText &&
        ch.permissionsFor(me)?.has([
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.EmbedLinks
        ]);

    if (canSend(guild.systemChannel)) return guild.systemChannel;

    return (
        guild.channels.cache
            .filter(canSend)
            .sort((a, b) => a.rawPosition - b.rawPosition)
            .first() || null
    );
}
