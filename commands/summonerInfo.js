const { AttachmentBuilder, SlashCommandBuilder } = require('discord.js');

const { request } = require('undici');
const dotenv = require('dotenv');
dotenv.config();

module.exports = {
	data: new SlashCommandBuilder()
		.setName('info')
		.setDescription('Get summoner info')
		.addStringOption((option) =>
			option
				.setName('region')
				.setDescription('Region')
				.setRequired(true)
				.addChoices(
					{ name: 'Brazil', value: 'br1' },
					{ name: 'Europe Nordic & East', value: 'eun1' },
					{ name: 'Europe West', value: 'euw1' },
					{ name: 'Japan', value: 'jp1' },
					{ name: 'Republic of Korea', value: 'kr' },
					{ name: 'Latin America North', value: 'la1' },
					{ name: 'Latin America South', value: 'la2' },
					{ name: 'North America', value: 'na1' },
					{ name: 'Oceania', value: 'oc1' },
					{ name: 'Russia', value: 'ru' },
					{ name: 'Turkey', value: 'tr1' }
				)
		)
		.addStringOption((option) =>
			option.setName('name').setDescription('Summoner name').setRequired(true)
		),
	async execute(interaction) {
		const region = interaction.options.getString('region');
		const name = interaction.options.getString('name');

		await interaction.deferReply();

		const uri = `https://${region}.api.riotgames.com/lol/summoner/v4/summoners/by-name/${name}?api_key=${process.env.RIOT_API_KEY}`;
		const summonerResponse = await request(uri);
		const summonerData = await summonerResponse.body.json();

		if (summonerResponse.statusCode === 200) {
			const file = new AttachmentBuilder(
				`http://ddragon.leagueoflegends.com/cdn/12.23.1/img/profileicon/${summonerData.profileIconId}.png`
			);
			await interaction.editReply({
				content: `Summoner ${summonerData.name} (LVL ${summonerData.summonerLevel}) \npuuid: ${summonerData.puuid}`,
				files: [file],
			});
		} else {
			console.error(summonerData.status);
			await interaction.editReply(`Summoner not found`);
		}
	},
};
