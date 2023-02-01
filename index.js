const fs = require('node:fs');
const path = require('node:path');
const {
	Client,
	Events,
	GatewayIntentBits,
	Collection,
	ActivityType,
	NewsChannel,
} = require('discord.js');
const { Telegraf } = require('telegraf');

const dotenv = require('dotenv');
dotenv.config();

const { QuickDB } = require('quick.db');
const db = new QuickDB();

//Telegram
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
bot.command('start', (ctx) => {
	ctx.reply(
		'Используйте команду /register, чтобы добавить себя в список, и команду /delete для удаления себя из списка'
	);
});
bot.command('register', async (ctx) => {
	const users = await db.get('users.id');
	if (users == undefined) {
		await db.set('users', { id: [] });
	}
	if (users.find((user) => user === ctx.from.id)) {
		ctx.reply('Вы уже зарегистрированы');
	} else {
		await db.push('users.id', ctx.from.id);
		ctx.reply('Вы добавлены в список');
	}
});
bot.command('delete', async (ctx) => {
	const users = await db.get('users.id');
	if (users == undefined) return;
	await db.pull('users.id', ctx.from.id);
	ctx.reply('Запись удалена');
});

bot.launch();

// Discord
const client = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs
	.readdirSync(commandsPath)
	.filter((file) => file.endsWith('js'));

for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	if ('data' in command && 'execute' in command) {
		client.commands.set(command.data.name, command);
	} else {
		console.log(
			`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
		);
	}
}

client.once(Events.ClientReady, (c) => {
	console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
	if (!interaction.isChatInputCommand()) return;

	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		await interaction.reply({
			content: 'There was an error while executing this command!',
			ephemeral: true,
		});
	}
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
	console.log(oldState);
	console.log(newState);
	if (
		newState.channelId === oldState.channelId &&
		newState.streaming === oldState.streaming
	)
		return;
	if (newState.channelId === null) {
		const users = await db.get('users.id');
		if (users == undefined) return;
		users.forEach((user) => {
			bot.telegram.sendMessage(
				user,
				`${
					client.users.cache.find((user) => user.id === newState.id).username
				} вышел из ${
					client.channels.cache.find(
						(channel) => channel.id === oldState.channelId
					).name
				}`
			);
		});
	} else if (newState.streaming && newState.streaming !== oldState.streaming) {
		await bot.telegram
			.sendMessage(
				process.env.TELEGRAM_CHANNEL_ID,
				`${
					client.users.cache.find((user) => user.id === newState.id).username
				} начал стрим в ${
					client.channels.cache.find(
						(channel) => channel.id === newState.channelId
					).name
				}`
			)
			.catch((err) => console.error(err));
	} else if (newState.channelId !== oldState.channelId) {
		const users = await db.get('users.id');
		if (users == undefined) return;
		users.forEach((user) => {
			bot.telegram.sendMessage(
				user,
				`${
					client.users.cache.find((user) => user.id === newState.id).username
				} зашел в ${
					client.channels.cache.find(
						(channel) => channel.id === newState.channelId
					).name
				}`
			);
		});
	}
});

client.login(process.env.DISCORD_TOKEN);
