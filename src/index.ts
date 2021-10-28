import { Client, Intents, Message, TextBasedChannels } from 'discord.js';
import {
	joinVoiceChannel,
	getVoiceConnection,
	createAudioPlayer,
	NoSubscriberBehavior,
	VoiceConnection,
	DiscordGatewayAdapterCreator,
} from '@discordjs/voice';
import { readFileSync } from 'fs';
import { AudioPlayerWrapper } from './AudioPlayerWrapper.js';

const config = JSON.parse(readFileSync('./config.json').toString('utf-8'));
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

enum MusicCmdError {
	OK,
	BotAuthor,
	WrongChannel,
	NotInVC,
	NoPlayer,
}

/**
 * Checks if all conditions are met to execute a voice channel command.
 * @param authorIsBot Whether the author of the command which summoned the bot is another bot.
 * @param channelId The id of the text channel where the bot was summoned.
 * @param voiceChannelId The id of the voice channel where the bot was summoned to.
 * @param player The audio player that will be used to play music.
 * @returns MusicCmdError.OK if everything is ok, an error otherwise.
 */
function doMusicCmdChecks(
	authorIsBot: boolean,
	channelId: string,
	voiceChannelId: string | null,
	player: AudioPlayerWrapper | null,
): MusicCmdError {
	if (authorIsBot) return MusicCmdError.BotAuthor;
	//if (channelId !== musicChannelId) return MusicCmdError.WrongChannel;
	if (voiceChannelId === null) return MusicCmdError.NotInVC;
	if (player == null) return MusicCmdError.NoPlayer;

	return null;
}

const MusicCmdErrorsMap = new Map([
	[MusicCmdError.BotAuthor, 'Ей, лайно, не си пробвай късмета.'],
	[MusicCmdError.WrongChannel, `Не тука, шефе. <#${musicChannelId}>`],
	[MusicCmdError.NotInVC, 'Влез в гласов канал бе...'],
	[MusicCmdError.NoPlayer, 'Първо трябва да ме поканиш в гласов канал.'],
]);

const PLAYERS: Map<string, AudioPlayerWrapper> = new Map();

/**
 * Create a new discord.js AudioPlayer for a certain voice chat.
 * @param vconn VoiceConnection to target channel.
 * @param  musicTextChannel Text channel which the bot reports to.
 * @returns The audio player for the given VC or null if there's no way to get a player.
 */
function getPlayer(
	vconn: VoiceConnection,
	musicTextChannel: import('discord.js').TextBasedChannels,
): AudioPlayerWrapper | null {
	if (vconn == null) return null;

	const id = vconn.joinConfig.channelId;

	if (PLAYERS[id] != null) return PLAYERS[id];

	const player = createAudioPlayer({
		behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
	});
	vconn.subscribe(player);

	const playerWrapper = new AudioPlayerWrapper(player, musicTextChannel);

	console.log(`>> Created player for ${id}.`);

	PLAYERS[id] = playerWrapper;
	return playerWrapper;
}

type JoinVCResult = {
	channelId: string;
	voiceConnection: VoiceConnection;
	player: AudioPlayerWrapper;
};

/**
 * Attempts to join a voice channel.
 * The voice channel is the same as the one of the user who asked for the bot.
 * @param msg The message sent to make the bot join VC.
 * @param willPlayMusic Will the bot be playing music?
 * @returns A __VoiceConnection__ if the connection was successful, __null__ otherwise.
 */
async function tryJoinVC(
	msg: Message,
	willPlayMusic: boolean,
): Promise<JoinVCResult | null> {
	const member = await msg.guild.members.fetch({ user: msg.author });

	const err = doMusicCmdChecks(
		msg.author.bot,
		msg.channelId,
		member.voice.channelId,
		null,
	);

	if (err !== null && err !== MusicCmdError.NoPlayer) {
		if (err !== MusicCmdError.WrongChannel || !willPlayMusic) {
			await msg.channel.send(MusicCmdErrorsMap[err]);
			return null;
		}
	}

	const res = {
		channelId: member.voice.channelId,
		voiceConnection: joinVoiceChannel({
			guildId: msg.guildId,
			channelId: member.voice.channelId,
			adapterCreator: msg.guild
				.voiceAdapterCreator as unknown as DiscordGatewayAdapterCreator,
		}),
		player: null,
	};
	res.player = getPlayer(res.voiceConnection, msg.channel);
	return res;
}

// TODO: >udri команда - чалга рулетка

client.on('messageCreate', async (msg) => {
	if (msg.author.id == client.user.id) return;

	const player = getPlayer(getVoiceConnection(msg.guildId), msg.channel);

	const member = await msg.guild.members.fetch({ user: msg.author });
	const err = doMusicCmdChecks(
		msg.author.bot,
		msg.channelId,
		member.voice.id,
		player,
	);

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
			if (err == null) {
				if (player.currentSong == null) {
					msg.channel.send('Няма какво да паузирам.');
				} else {
					player.pause();
					msg.channel.send('Хубу, шефе.');
				}
			} else {
				msg.channel.send(MusicCmdErrorsMap[err]);
			}
			break;

		case '>s':
		case '>skip':
			if (err == null) {
				player.skip();
			} else {
				msg.channel.send(MusicCmdErrorsMap[err]);
			}
			break;

		case '>daj mu':
			if (err == null) {
				msg.channel.send('ДАЙ МУ');
			}
		case '>daj pak':
		case '>resume':
		case '>unpause':
			if (err == null) {
				player.unpause();
			} else {
				msg.channel.send(MusicCmdErrorsMap[err]);
			}
			break;

		case '>leave':
		case '>mahaj_se':
		case '>mahaj se':
			if (err == null) {
				player.clearQueue();
				getVoiceConnection(msg.guildId).destroy();
			} else {
				msg.channel.send(MusicCmdErrorsMap[err]);
			}
			break;

		case '>clear':
			if (err == null) {
				player.clearQueue();
			} else {
				msg.channel.send(MusicCmdErrorsMap[err]);
			}
			break;

		case '>povtarqi':
		case '>loop':
			if (err == null) {
				player.changeMode();
			} else {
				msg.channel.send(MusicCmdErrorsMap[err]);
			}
			break;

		case '>kvo sledva':
		case '>kvo sledva?':
		case '>q':
		case '>queue':
			if (err == null) {
				player.printQueue();
			} else {
				msg.channel.send(MusicCmdErrorsMap[err]);
			}
			break;

		case '>kvo slushame?':
		case '>nowplaying':
		case '>now playing':
		case '>np':
			if (err == null) {
				player.printCurrentSong();
			} else {
				msg.channel.send(MusicCmdErrorsMap[err]);
			}
			break;
	}

	if (
		msg.content.startsWith('pusni ') ||
		msg.content.startsWith('>pusni ') ||
		msg.content.startsWith('>p ') ||
		msg.content.startsWith('>play ')
	) {
		const newPlayer = (await tryJoinVC(msg, true)).player;
		const args = msg.content.substr(msg.content.indexOf(' ') + 1).trim();
		newPlayer.play(args);
	}

	console.log(`Got a message from ${msg.author}: "${msg.content}"`);
});

// Login to Discord with your client's token
client.login(config.token);
