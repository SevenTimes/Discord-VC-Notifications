const { REST, Routes } = require('discord.js');
const fs = require('node:fs');

const dotenv = require('dotenv');
dotenv.config();

const { TOKEN, CLIENT_ID, GUILD_ID } = process.env;

const commands = [];
const commandFiles = fs
	.readdirSync('./commands')
	.filter((file) => file.endsWith('js'));

for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
	try {
		console.log(
			`Started refreshing ${commands.length} application (/) commands.`
		);

		const data = await rest.put(
			Routes.applicationCommands(CLIENT_ID, GUILD_ID),
			{ body: commands }
		);

		console.log(
			`Successfully reloaded ${data.length} application (/) commands.`
		);
	} catch (error) {
		console.error(error);
	}
})();
