/**
 * Fired once when the bot connects to Discord.
 */

const { ActivityType } = require("discord.js");
const config = require("../config/config");
const logger = require("../utils/logger");

module.exports = {
    name: "clientReady",
    once: true,

    execute(client) {
        logger.info(`${client.user.tag} is online! Serving ${config.BOT_NAME}.`);

        client.user.setPresence({
            activities: [
                {
                    name: `/profile • ${config.BOT_NAME}`,
                    type: ActivityType.Watching
                }
            ],
            status: "online"
        });
    }
};
