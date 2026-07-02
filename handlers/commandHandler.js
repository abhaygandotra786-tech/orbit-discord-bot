const fs = require("fs");
const path = require("path");

module.exports = (client) => {

    const commandsPath = path.join(
        __dirname,
        "../commands"
    );

    const folders = fs.readdirSync(commandsPath);

    for (const folder of folders) {

        const folderPath = path.join(
            commandsPath,
            folder
        );

        if (!fs.statSync(folderPath).isDirectory())
            continue;

        const files = fs
            .readdirSync(folderPath)
            .filter(file => file.endsWith(".js"));

        for (const file of files) {

            const command = require(
                path.join(folderPath, file)
            );

            client.commands.set(
                command.data.name,
                command
            );
        }
    }

    console.log(
        `${client.commands.size} commands loaded.`
    );
};