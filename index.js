/**
 * Community Hub - Entry point
 * ------------------------------------------------------------------
 * Boots the database schema, loads commands and events via handlers,
 * and logs the client in.
 */

require("dotenv").config();

const { Client, GatewayIntentBits, Collection } = require("discord.js");

// Initialize the database schema before anything else queries it.
require("./database/schema");

const loadCommands = require("./handlers/commandHandler");
const loadEvents = require("./handlers/eventHandler");
const logger = require("./utils/logger");

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.commands = new Collection();

loadCommands(client);
loadEvents(client);

// Global safety nets so a stray error never crashes the process.
process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled promise rejection", reason);
});
process.on("uncaughtException", (err) => {
    logger.error("Uncaught exception", err);
});

if (!process.env.TOKEN) {
    logger.error("Missing TOKEN in .env — cannot start the bot.");
    process.exit(1);
}

client.login(process.env.TOKEN);
