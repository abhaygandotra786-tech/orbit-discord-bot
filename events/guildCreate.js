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

const { brandedEmbed, DIVIDER } = require("../utils/embed");
const config = require("../config/config");
const logger = require("../utils/logger");

module.exports = {
    name: "guildCreate",

    async execute(guild, client) {
        logger.info(`Joined new server: ${guild.name} (${guild.id})`);

        const channel = findWelcomeChannel(guild);
        if (!channel) return;

        const { embed, files } = brandedEmbed({
            title: "👋 Thanks for adding Orbit!",
            description:
                "Your all-in-one community hub for **networking, founders, " +
                "freelancing, friends, gaming & dating.** ✨\n" +
                `${DIVIDER}\n` +
                "Create a profile, get discovered, match with people who share " +
                "your goals, and grow your network — right from Discord."
        });

        embed.addFields(
            {
                name: "🚀  Get started in 30 seconds",
                value:
                    "`/profile create` — build your profile\n" +
                    "`/profile browse` — discover members\n" +
                    "`/like` — connect (mutual likes = a match!)"
            },
            {
                name: "🌟  Explore",
                value:
                    "🤝 Networking · 🚀 Co-Founders · 💼 Freelancing\n" +
                    "👥 Friends · 🎮 Gaming · 💖 Dating"
            },
            {
                name: "👑  Go further",
                value:
                    "Unlock priority visibility, AI matchmaking, analytics & more.\n" +
                    "Type `/premium plans` or `/help` to see everything."
            }
        );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel("🌐 Website")
                .setStyle(ButtonStyle.Link)
                .setURL(config.WEBSITE),
            new ButtonBuilder()
                .setLabel("👑 Premium")
                .setStyle(ButtonStyle.Link)
                .setURL(config.PREMIUM.PAYMENT_URL),
            new ButtonBuilder()
                .setLabel("💬 Support")
                .setStyle(ButtonStyle.Link)
                .setURL(config.SUPPORT_SERVER)
        );

        try {
            await channel.send({ embeds: [embed], files, components: [row] });
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
