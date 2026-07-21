/**
 * Fired once when the bot connects to Discord.
 * Sets a rotating presence so Orbit always feels alive.
 */

const { ActivityType } = require("discord.js");
const config = require("../config/config");
const logger = require("../utils/logger");

module.exports = {
    name: "clientReady",
    once: true,

    execute(client) {
        logger.info(`${client.user.tag} is online! Serving ${config.BOT_NAME}.`);

        const statuses = () => [
            { name: `/help • ${config.BOT_NAME}`, type: ActivityType.Watching },
            { name: "people connect & match", type: ActivityType.Watching },
            { name: "networking, founders & more", type: ActivityType.Listening },
            { name: "/profile create", type: ActivityType.Playing },
            { name: "your community grow", type: ActivityType.Watching }
        ];

        let i = 0;
        const rotate = () => {
            const list = statuses();
            const activity = list[i % list.length];
            client.user.setPresence({
                activities: [activity],
                status: "online"
            });
            i++;
        };

        rotate(); // set immediately
        setInterval(rotate, 20 * 1000); // change every 20 seconds
    }
};
