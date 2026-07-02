/**
 * Registers slash commands with Discord.
 *
 * Usage:
 *   - Guild deploy (instant, for development): set GUILD_ID in .env
 *   - Global deploy (up to 1h to propagate): leave GUILD_ID empty
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

        if (process.env.GUILD_ID) {
            await rest.put(
                Routes.applicationGuildCommands(
                    process.env.CLIENT_ID,
                    process.env.GUILD_ID
                ),
                { body: commands }
            );
            console.log("Guild commands deployed successfully!");
        } else {
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands }
            );
            console.log("Global commands deployed successfully!");
        }
    } catch (error) {
        console.error("Deployment failed:", error);
        process.exitCode = 1;
    }
})();
