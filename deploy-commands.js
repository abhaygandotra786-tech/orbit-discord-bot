/**
 * Registers slash commands with Discord.
 *
 * Default: GLOBAL deploy — commands work in every server the bot is in
 * (can take up to ~1 hour to appear the first time).
 *
 * For fast local iteration only, run with DEPLOY_MODE=guild and a GUILD_ID
 * set; that registers instantly but only in that one server.
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { REST, Routes } = require("discord.js");

// Ensure tables exist before command modules build prepared statements.
require("./database/schema");

const commands = [];
const commandsPath = path.join(__dirname, "commands");

for (const folder of fs.readdirSync(commandsPath)) {
    const folderPath = path.join(commandsPath, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    const files = fs
        .readdirSync(folderPath)
        .filter((file) => file.endsWith(".js"));

    for (const file of files) {
        const command = require(path.join(folderPath, file));
        if (command?.data) {
            commands.push(command.data.toJSON());
        } else {
            console.warn(`⚠️  Skipping ${file} — missing "data" export.`);
        }
    }
}

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
    try {
        if (!process.env.TOKEN || !process.env.CLIENT_ID) {
            throw new Error("Missing TOKEN or CLIENT_ID in .env");
        }

        console.log(`Deploying ${commands.length} command(s)...`);

        const guildOnly =
            process.env.DEPLOY_MODE === "guild" && process.env.GUILD_ID;

        if (guildOnly) {
            await rest.put(
                Routes.applicationGuildCommands(
                    process.env.CLIENT_ID,
                    process.env.GUILD_ID
                ),
                { body: commands }
            );
            console.log("Guild commands deployed (guild-only mode).");
        } else {
            // Global deploy — works in every server the bot joins.
            await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
                body: commands
            });
            console.log("Global commands deployed successfully!");

            // Clear any leftover guild-scoped commands so they don't appear
            // twice in the dev/test server.
            if (process.env.GUILD_ID) {
                await rest.put(
                    Routes.applicationGuildCommands(
                        process.env.CLIENT_ID,
                        process.env.GUILD_ID
                    ),
                    { body: [] }
                );
                console.log("Cleared old guild-scoped commands.");
            }
        }
    } catch (error) {
        console.error("Deployment failed:", error);
        process.exitCode = 1;
    }
})();
