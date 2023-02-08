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
	if (
		newState.channelId === oldState.channelId &&
		newState.streaming === oldState.streaming
	)
		return;

	const hasUserLeft = newState.channelId === null;
	const hasUserJoined = newState.channelId !== oldState.channelId;
	const hasUserStartStream =
		newState.streaming && newState.streaming !== oldState.streaming;
	const userName = client.users.cache.find(
		(user) => user.id === newState.id
	).username;

	if (hasUserLeft) {
		return await sendMessageToAllUsers(
			oldState.channelId,
			`${userName} вышел из`
		);
	}

	if (hasUserStartStream) {
		return await sendMessageToChannel(
			newState.channelId,
			`${userName} начал стрим в`
		);
	}

	if (hasUserJoined) {
		return await sendMessageToAllUsers(
			newState.channelId,
			`${userName} зашел в`
		);
	}
});

async function sendMessageToAllUsers(channelId, message) {
	const users = await db.get('users.id');
	if (users == undefined) return;

	const channelName = client.channels.cache.find(
		(channel) => channel.id === channelId
	).name;
	users.forEach((user) =>
		bot.telegram
			.sendMessage(user, `${message} ${channelName}`)
			.catch(async (err) => {
				if (err.response.error_code === 403) {
					await db.pull('users.id', err.on.payload.chat_id);
					console.log(`Blocked chat ${err.on.payload.chat_id} removed`);
				} else {
					console.error(err);
				}
			})
	);
}

async function sendMessageToChannel(channelId, message) {
	const channelName = client.channels.cache.find(
		(channel) => channel.id === channelId
	).name;

	await bot.telegram
		.sendMessage(process.env.TELEGRAM_CHANNEL_ID, `${message} ${channelName}`)
		.catch((err) => console.error(err));
}

client.login(process.env.DISCORD_TOKEN);
