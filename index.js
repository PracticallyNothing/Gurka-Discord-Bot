/* eslint-disable no-fallthrough */
import { Client, Intents } from 'discord.js';
import {
	joinVoiceChannel,
	getVoiceConnection,
	createAudioPlayer,
	NoSubscriberBehavior,
} from '@discordjs/voice';
import { readFileSync } from 'fs';
import { AudioPlayerWrapper } from './AudioPlayerWrapper.js';

const config = JSON.parse(readFileSync('./config.json'));
const client = new Client({
	intents: [
		Intents.FLAGS.DIRECT_MESSAGES,
		Intents.FLAGS.GUILDS,
		Intents.FLAGS.GUILD_MESSAGES,
		Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
		Intents.FLAGS.GUILD_VOICE_STATES,
	],
});

// When the client is ready, run this code (only once)
client.once('ready', () => {
	console.log('Ready!');
});

/** The id of the "Апокалипсисът закъснява" server.
 * @readonly */
// const apocalipsisGuildId = '554610557949575168';

/** The id of the music channel in "Апокалипсисът закъснява" server.
 * @readonly */
const musicChannelId = '558738202811432969';

/**
 * Checks if all conditions are met to execute a voice channel command.
 * @param {boolean} authorIsBot Whether the author of the command which summoned the bot is another bot.
 * @param {string} channelId The id of the text channel where the bot was summoned.
 * @param {string | null} voiceChannelId The id of the voice channel where the bot was summoned to.
 * @returns {"botAuthor"|"wrongChannel"|"notInVC"|null} Either __a string__ containing an error message to send or __null__ if all checks are met.
 */
function doMusicCmdChecks(authorIsBot, channelId, voiceChannelId) {
	if (authorIsBot) return 'botAuthor';
	if (channelId !== musicChannelId) return 'wrongChannel';
	if (voiceChannelId === null) return 'notInVC';

	return null;
}

/**
 * Attempts to join a voice channel.
 * The voice channel is the same as the one of the user who asked for the bot.
 * @param {Message} msg The message sent to make the bot join VC.
 * @param {boolean} willPlayMusic Will the bot be playing music?
 * @returns {Promise<{channelId: string, voiceConnection: VoiceConnection} | null>} A __VoiceConnection__ if the connection was successful, __null__ otherwise.
 */
async function tryJoinVC(msg, willPlayMusic) {
	const member = await msg.guild.members.fetch({ user: msg.author });

	const err = doMusicCmdChecks(
		msg.author.bot,
		msg.channelId,
		member.voice.channelId,
	);

	if (err !== null) {
		let is_err = true;

		switch (err) {
			case 'botAuthor':
				await msg.channel.send('Аве ей, лайно, я не ми се прави.');
				break;
			case 'notInVC':
				await msg.channel.send('Влез в гласов канал бе...');
				break;
			case 'wrongChannel':
				if (willPlayMusic) {
					await msg.channel.send(
						`Не тука, шефе. <#${musicChannelId}>`,
					);
				} else {
					is_err = false;
				}
				break;
		}
		if (is_err) return null;
	}

	return {
		channelId: member.voice.channelId,
		voiceConnection: joinVoiceChannel({
			guildId: msg.guildId,
			channelId: member.voice.channelId,
			adapterCreator: msg.guild.voiceAdapterCreator,
		}),
	};
}

/**
 * @global
 * @type {Map<string, AudioPlayerWrapper>}
 */
const PLAYERS = new Map();

/**
 * Create a new discord.js AudioPlayer for a certain voice chat.
 * @param {VoiceConnection} vconn VoiceConnection to target channel.
 * @param {import("discord.js").TextBasedChannels} musicTextChannel Text channel which the bot reports to.
 * @returns {AudioPlayerWrapper|null} The audio player for the given VC or null if there's no way to get a player.
 */
function getPlayer(vconn, musicTextChannel) {
	if (vconn == null) return null;

	const id = vconn.joinConfig.channelId;

	if (PLAYERS[id] != null) return PLAYERS[id];

	const player = createAudioPlayer({
		behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
	});
	vconn.subscribe(player);

	const playerWrapper = new AudioPlayerWrapper(player, musicTextChannel);

	PLAYERS[id] = playerWrapper;
	return playerWrapper;
}
// TODO: >udri команда - чалга рулетка

client.on('messageCreate', async (msg) => {
	if (msg.author.id == client.user.id) return;

	const player = getPlayer(getVoiceConnection(msg.guildId), msg.channel);

	switch (msg.content) {
		case 'boqn e gej':
			if (msg.author.id == '787324797860053022') {
				msg.channel.send('mlukvaj koumi');
			} else {
				msg.channel.send('boqn e gej');
			}
			break;

		case 'daj krastavica':
		case 'daj krastavichka':
		case 'daj krastavicata':
		case 'daj gurka':
		case 'daj kornishon':
			msg.channel.send(':cucumber:');
			break;

		case 'daj krastavici':
		case 'daj krastavichki':
		case 'daj krastavicite':
		case 'daj gurki':
		case 'daj kornishoni':
			msg.channel.send(
				':cucumber: :cucumber: :cucumber: :cucumber: :cucumber:',
			);
			break;

		case 'laf?':
		case 'are laf':
		case 'aj laf':
		case 'ai laf':
		case 'aj laf?':
		case 'ai laf?':
			msg.channel.send('ai');
		case '>ela_vc':
		case '>ela vc':
		case '>join':
			await tryJoinVC(msg, false);
			break;

		case '>pause':
		case '>spri malko':
		case '>spri':
			player.pause();
			msg.channel.send('Хубу, шефе.');
			break;

		case '>s':
		case '>skip':
			player.skip();
			break;

		case '>daj mu':
			msg.channel.send('ДАЙ МУ');
		case '>daj pak':
		case '>resume':
		case '>unpause':
			player.unpause();
			break;

		case '>leave':
		case '>mahaj_se':
		case '>mahaj se':
			player.clearQueue();
			getVoiceConnection(msg.guildId).destroy();
			break;

		case '>kvo sledva':
		case '>kvo sledva?':
		case '>q':
		case '>queue':
			player.printQueue();
			break;

		case '>kvo slushame?':
		case '>nowplaying':
		case '>now playing':
		case '>np':
			player.printCurrentSong();
			break;
	}

	if (
		msg.content.startsWith('pusni ') ||
		msg.content.startsWith('>pusni ') ||
		msg.content.startsWith('>p ') ||
		msg.content.startsWith('>play ')
	) {
		const vc = await tryJoinVC(msg, true);
		const args = msg.content.substr(msg.content.indexOf(' ') + 1).trim();
		getPlayer(vc.voiceConnection, msg.channel).play(args);
	}

	console.log(`Got a message from ${msg.author}: "${msg.content}"`);
});

// Login to Discord with your client's token
client.login(config.token);
