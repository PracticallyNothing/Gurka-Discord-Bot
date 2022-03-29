import {
	createAudioPlayer,
	DiscordGatewayAdapterCreator,
	joinVoiceChannel,
	NoSubscriberBehavior,
	VoiceConnection,
} from '@discordjs/voice';
import { BaseGuildTextChannel, BaseGuildVoiceChannel, Client } from 'discord.js';
import { AudioPlayerWrapper } from './AudioPlayerWrapper.js';

/// Result of a command that's been run. If error is non-null, it's considered that the command failed.
export type CommandResult = {
	response: string | null;
	/// Error string if an error occurred.
	error: string | null;
};

export type MessageContext = {
	content: string;

	client: Client;

	senderId: string;
	senderUsername: string;
	senderNickname: string;
	senderIsBot: boolean;

	senderVoiceChannelId: string | null;

	channelId: string;
	channelName: string;

	guildId: string;
	guildName: string;
};

export interface Command {
	name: () => string;
	description: () => string;
	aliases?: () => string[];

	execute: (msg: MessageContext, args?: string) => Promise<CommandResult>;
}

export class ResponseCommand implements Command {
	private _name: string;
	private _description: string;
	private _responses: string[];

	private _aliases?: string[];

	constructor(
		name: string,
		description: string,
		responses: string[],
		aliases?: string[],
	) {
		this._name = name;
		this._description = description;
		this._responses = responses;
		this._aliases = aliases;
	}

	public name = () => this._name;
	public description = () => this._description;
	public aliases = () => this._aliases;

	public execute = async (
		_msg: MessageContext,
		_args?: string,
	): Promise<CommandResult> => {
		if (this._responses.length == 0) {
			return {
				response: null,
				error: `"${this._name}" has no responses set!`,
			};
		}

		let i = Math.floor(Math.random() * this._responses.length);

		return {
			response: this._responses[i],
			error: null,
		};
	};
}

export class SequentialResponseCommand implements Command {
	private _name: string;
	private _description: string;
	private _responses: string[];
	private _nextIdx: number;

	constructor(name: string, description: string, responses: string[]) {
		this._name = name;
		this._description = description;
		this._responses = responses;
		this._nextIdx = 0;
	}

	public name = () => this._name;
	public description = () => this._description;

	public execute = async (
		_msg: MessageContext,
		_args?: string,
	): Promise<CommandResult> => {
		if (this._responses.length == 0) {
			return {
				response: null,
				error: `"${this._name}" has no responses set!`,
			};
		}

		let i = this._nextIdx;
		this._nextIdx = (this._nextIdx + 1) % this._responses.length;

		return {
			response: this._responses[i],
			error: null,
		};
	};
}

/******* VOICE COMMANDS *******/

type VoiceState = {
	voiceConnection: VoiceConnection;
	player: AudioPlayerWrapper;
};

type GuildId = string;

const globalVoiceState: Map<GuildId, VoiceState> = new Map();

enum JoinVoiceResult {
	OK,
	Error_SenderNotInVC,
	Error_AlreadyInVC,
}

async function doJoinVC(msg: MessageContext): Promise<JoinVoiceResult> {
	if (msg.senderVoiceChannelId == null)
		return JoinVoiceResult.Error_SenderNotInVC;

	if (globalVoiceState.has(msg.guildId)) {
		if (globalVoiceState.get(msg.guildId).voiceConnection.joinConfig.channelId != msg.senderVoiceChannelId) {
			return JoinVoiceResult.Error_AlreadyInVC;
		} else {
			return JoinVoiceResult.OK;
		}
	}

	let voiceConnection = joinVoiceChannel({
		guildId: msg.guildId,
		channelId: msg.senderVoiceChannelId,
		adapterCreator: (await msg.client.guilds.fetch(msg.guildId))
			.voiceAdapterCreator as unknown as DiscordGatewayAdapterCreator,
	});

	let player = createAudioPlayer({
		behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
	});

	voiceConnection.subscribe(player);

	let wrapper = new AudioPlayerWrapper(
		player,
		(await msg.client.channels.fetch(msg.channelId)) as BaseGuildTextChannel,
	);

	globalVoiceState.set(msg.guildId, {
		voiceConnection: voiceConnection,
		player: wrapper,
	});

	return JoinVoiceResult.OK;
}

// Can only join 1 VC per server (guild).
// User who asked for join must be in VC.
// TODO: VC must exist until we've joined. (currently not checked)
export class JoinVoiceChannelCommand implements Command {
	public name = () => '>join';
	public description = () => 'Присъединяване към гласов канал';
	public aliases?= () => ['>ela', 'laf?'];

	public execute = async (
		msg: MessageContext,
		_args?: string,
	): Promise<CommandResult> => {
		switch (await doJoinVC(msg)) {
			case JoinVoiceResult.OK:
				return { response: 'Идвам.', error: null };
			case JoinVoiceResult.Error_SenderNotInVC:
				return {
					response: null,
					error: 'You must be in a voice channel!',
				};
			case JoinVoiceResult.Error_AlreadyInVC:
				return {
					response: null,
					error: 'I already am in another voice channel!',
				};
		}
	};
}

export class LeaveVoiceChannelCommand implements Command {
	public name = () => '>leave';
	public description = () => 'Напуска гласов канал.';
	public aliases?= () => ['>marsh'];

	public execute = async (msg: MessageContext): Promise<CommandResult> => {
		if (!globalVoiceState.has(msg.guildId)) {
			return {
				response: null,
				error: "I'm not in a voice channel.",
			};
		}

		globalVoiceState.get(msg.guildId).voiceConnection.destroy();
		globalVoiceState.delete(msg.guildId);

		return { response: "Аре до после.", error: null }
	};
}

export class PlayMusicCommand implements Command {
	public name = () => '>play';
	public description = () => 'Пусни музика';
	public aliases?= () => ['>pusni', '>p'];

	public execute = async (
		msg: MessageContext,
		args: string,
	): Promise<CommandResult> => {
		switch (await doJoinVC(msg)) {
			case JoinVoiceResult.Error_SenderNotInVC:
				return {
					response: null,
					error: 'You must be in a voice channel to play music!',
				};
			case JoinVoiceResult.Error_AlreadyInVC:
				return {
					response: null,
					error: "I'm already playing music in another voice channel",
				};
		}

		globalVoiceState.get(msg.guildId).player.play(args);

		// TODO: Може би AudioPlayerWrapper не трябва изписва съобщение за добавена песен,
		//       а от тук да става това.
		return {
			response: null,
			error: null,
		};
	};
}

/** @returns Error string or null if there is no error. */
async function musicCmdSanityChecks(msg: MessageContext): Promise<string | null> {
	if (msg.senderVoiceChannelId == null)
		return "You must be in a voice channel!"

	let vc: BaseGuildVoiceChannel = await msg.client.channels.fetch(msg.senderVoiceChannelId) as BaseGuildVoiceChannel

	// TODO: Това включва ли ситуацията, в която бота няма permissions, за да влезе?
	if (!vc.joinable)
		return "I can't join into that VC!";

	let vs = globalVoiceState.get(msg.guildId)

	if (vs == null)
		return "I'm not in your voice channel!"

	return null
}

export class ResumeMusicCommand implements Command {
	public name = () => '>resume';
	public description = () => 'Продължава спряна музика.';
	public aliases?= () => ['>daj'];

	public execute = async (
		msg: MessageContext,
		_args: string,
	): Promise<CommandResult> => {
		let err = await musicCmdSanityChecks(msg);

		if (err != null)
			return { response: null, error: err }

		globalVoiceState.get(msg.guildId).player.unpause()
		return { response: null, error: null }
	}
}
export class PauseMusicCommand implements Command {
	public name = () => '>pause';
	public description = () => 'Паузира музика.';
	public aliases?= () => ['>spri'];

	public execute = async (
		msg: MessageContext,
		_args: string,
	): Promise<CommandResult> => {
		let err = await musicCmdSanityChecks(msg);

		if (err != null)
			return { response: null, error: err }

		globalVoiceState.get(msg.guildId).player.pause()
		return { response: null, error: null }
	}
}
export class SkipSongCommand implements Command {
	public name = () => '>skip';
	public description = () => 'Пропуска сегашната песен и продължава към следващата.';
	public aliases? = () => ['>s'];

	public execute = async (
		msg: MessageContext,
		_args: string,
	): Promise<CommandResult> => {
		let err = await musicCmdSanityChecks(msg);

		if (err != null)
			return { response: null, error: err }

		globalVoiceState.get(msg.guildId).player.skip()
		return { response: null, error: null }
	}
}
export class ClearMusicQueueCommand implements Command {
	public name = () => '>clear';
	public description = () => 'Спира каквото и да свири и изчиства опашката.';
	public aliases?= () => [];

	public execute = async (
		msg: MessageContext,
		_args: string,
	): Promise<CommandResult> => {
		let err = await musicCmdSanityChecks(msg);

		if (err != null)
			return { response: null, error: err }

		globalVoiceState.get(msg.guildId).player.clearQueue()
		return { response: null, error: null }
	}
}

export class NowPlayingCommand implements Command {
	public name = () => '>nowplaying';
	public description = () => 'Показва какво свири в момента.';
	public aliases?= () => ['>np'];

	public execute = async (
		msg: MessageContext,
		_args: string,
	): Promise<CommandResult> => {
		let err = await musicCmdSanityChecks(msg);

		if (err != null)
			return { response: null, error: err }

		globalVoiceState.get(msg.guildId).player.printCurrentSong()
		return { response: null, error: null }
	}
}

export class PrintQueueCommand implements Command {
	public name = () => '>queue';
	public description = () => 'Показва песента в момента и опашката.';
	public aliases?= () => ['>q'];

	public execute = async (
		msg: MessageContext,
		_args: string,
	): Promise<CommandResult> => {
		let err = await musicCmdSanityChecks(msg);

		if (err != null)
			return { response: null, error: err }

		globalVoiceState.get(msg.guildId).player.printQueue()
		return { response: null, error: null }
	}
}

export class RemoveSongCommand implements Command {
	public name = () => '>remove';
	public aliases?= () => ['>rm'];

	public description = () => {
		let example1 = '`' + this.name() + ' 3`';
		let example2 = '`' + this.name() + ' 5-10`';
		return `Маха оказаната песен според подадения номер. Примери: ${example1} ${example2}`;
	}

	public execute = async (
		msg: MessageContext,
		args: string,
	): Promise<CommandResult> => {
		let err = await musicCmdSanityChecks(msg);

		if (err != null)
			return { response: null, error: err }

		if (args.trim().length == 0) {
			return {
				response: null,
				error: 'You must pass in a number (e.g. `>rm 1`) ' +
					'or a range of numbers (e.g. `>rm 5-10`).'
			}
		}

		const player = globalVoiceState.get(msg.guildId).player;

		let arg = args.split(' ')[0].trim()

		if (arg.indexOf('-') >= 0) {
			let args = arg.split('-').map(parseInt)

			if (args.length != 2) {
				return {
					response: null,
					error: "There must be exactly two numbers in the range."
				}
			}

			if (isNaN(args[0]) || isNaN(args[1])) {
				return {
					response: null,
					error: "Parts of range must be numbers."
				}
			}

			if (!player.remove({ begin: args[0], end: args[1] })) {
				return { response: null, error: "Incorrect values for range!" }
			}
		} else {
			let num = parseInt(arg)
			if (isNaN(num)) {
				return { response: null, error: "You must pass in a number or a range." }
			}

			if (!player.remove(num)) {
				return { response: null, error: "Incorrect song number!" }
			}
		}

		return { response: "Готово, махнато.", error: null }
	}
}

export class ShuffleMusicQueueCommand implements Command {
	public name = () => '>shuffle';
	public aliases? = () => ['>shuf', '>razburkaj'];

	public description = () => 'Размесва песните в опашката.'

	public execute = async (
		msg: MessageContext,
		_args: string,
	): Promise<CommandResult> => {
		let err = await musicCmdSanityChecks(msg);

		if (err != null)
			return { response: null, error: err }

		globalVoiceState.get(msg.guildId).player.shuffle();

		return { response: 'Хубу, ей ви разна риба.', error: null }
	}
}
