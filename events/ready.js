/**
 * Fired once when the bot connects to Discord.
 * Sets a rotating presence so Orbit always feels alive.
 */

const { ActivityType } = require("discord.js");
const config = require("../config/config");
const logger = require("../utils/logger");
const { countProfiles } = require("../database/profileQueries");

module.exports = {
    name: "clientReady",
    once: true,

    execute(client) {
        logger.info(`${client.user.tag} is online! Serving ${config.BOT_NAME}.`);

        const statuses = () => {
            let members = 0;
            try {
                members = countProfiles.get().count;
            } catch {
                /* db not ready yet */
            }
            return [
                { name: `/help • ${config.BOT_NAME}`, type: ActivityType.Watching },
                { name: `${members} members connect`, type: ActivityType.Watching },
                { name: "networking, founders & more", type: ActivityType.Listening },
                { name: `/profile create`, type: ActivityType.Playing },
                { name: `${client.guilds.cache.size} servers`, type: ActivityType.Watching }
            ];
        };

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
