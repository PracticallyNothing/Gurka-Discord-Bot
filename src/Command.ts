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
		if(globalVoiceState.get(msg.guildId).voiceConnection.joinConfig.channelId != msg.senderVoiceChannelId) {
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
	public description = () => '???????????????????????????? ?????? ???????????? ??????????';
	public aliases? = () => ['>ela', 'laf?'];

	public execute = async (
		msg: MessageContext,
		_args?: string,
	): Promise<CommandResult> => {
		switch (await doJoinVC(msg)) {
			case JoinVoiceResult.OK:
				return { response: '??????????.', error: null };
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
	public description = () => '?????????????? ???????????? ??????????.';
	public aliases? = () => ['>marsh'];

	public execute = async (msg: MessageContext): Promise<CommandResult> => {
		if (!globalVoiceState.has(msg.guildId)) {
			return {
				response: null,
				error: "I'm not in a voice channel.",
			};
		}

		globalVoiceState.get(msg.guildId).voiceConnection.destroy();
		globalVoiceState.delete(msg.guildId);

		return { response: "?????? ???? ??????????.", error: null }
	};
}

export class PlayMusicCommand implements Command {
	public name = () => '>play';
	public description = () => '?????????? ????????????';
	public aliases? = () => ['>pusni', '>p'];

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

		// TODO: ???????? ???? AudioPlayerWrapper ???? ???????????? ?????????????? ?????????????????? ???? ???????????????? ??????????,
		//       ?? ???? ?????? ???? ?????????? ????????.
		return {
			response: null,
			error: null,
		};
	};
}

/** @returns Error string or null if there is no error. */
async function musicCmdSanityChecks(msg: MessageContext): Promise<string | null> {
	if(msg.senderVoiceChannelId == null)
		return "You must be in a voice channel!"

	let vc: BaseGuildVoiceChannel = await msg.client.channels.fetch(msg.senderVoiceChannelId) as BaseGuildVoiceChannel

	// TODO: ???????? ?????????????? ???? ????????????????????, ?? ?????????? ???????? ???????? permissions, ???? ???? ???????????
	if(!vc.joinable)
		return "I can't join into that VC!";

	let vs = globalVoiceState.get(msg.guildId)

	if(vs == null)
		return "I'm not in your voice channel!"

	return null
}

export class ResumeMusicCommand implements Command {
	public name = () => '>resume';
	public description = () => '???????????????????? ???????????? ????????????.';
	public aliases? = () => ['>daj'];

	public execute = async (
		msg: MessageContext,
		_args: string,
	): Promise<CommandResult> => {
		let err = await musicCmdSanityChecks(msg);

		if(err != null)
			return { response: null, error: err }

		globalVoiceState.get(msg.guildId).player.unpause()
		return { response: null, error: null }
	}
}
export class PauseMusicCommand implements Command {
	public name = () => '>pause';
	public description = () => '?????????????? ????????????.';
	public aliases? = () => ['>spri'];

	public execute = async (
		msg: MessageContext,
		_args: string,
	): Promise<CommandResult> => {
		let err = await musicCmdSanityChecks(msg);

		if(err != null)
			return { response: null, error: err }

		globalVoiceState.get(msg.senderVoiceChannelId).player.pause()
		return { response: null, error: null }
	}
}
export class SkipSongCommand implements Command {
	public name = () => '>skip';
	public description = () => '???????????????? ?????????????????? ?????????? ?? ???????????????????? ?????? ????????????????????.';
	public aliases? = () => [];

	public execute = async (
		msg: MessageContext,
		_args: string,
	): Promise<CommandResult> => {
		let err = await musicCmdSanityChecks(msg);

		if(err != null)
			return { response: null, error: err }

		globalVoiceState.get(msg.guildId).player.skip()
		return { response: null, error: null }
	}
}
export class ClearMusicQueueCommand implements Command {
	public name = () => '>clear';
	public description = () => '?????????? ?????????????? ?? ???? ?????????? ?? ???????????????? ????????????????.';
	public aliases? = () => [];

	public execute = async (
		msg: MessageContext,
		_args: string,
	): Promise<CommandResult> => {
		let err = await musicCmdSanityChecks(msg);

		if(err != null)
			return { response: null, error: err }

		globalVoiceState.get(msg.guildId).player.clearQueue()
		return { response: null, error: null }
	}
}

export class NowPlayingCommand implements Command {
	public name = () => '>nowplaying';
	public description = () => '?????????????? ?????????? ?????????? ?? ??????????????.';
	public aliases? = () => ['>np'];

	public execute = async (
		msg: MessageContext,
		_args: string,
	): Promise<CommandResult> => {
		let err = await musicCmdSanityChecks(msg);

		if(err != null)
			return { response: null, error: err }

		globalVoiceState.get(msg.guildId).player.printCurrentSong()
		return { response: null, error: null }
	}
}

export class PrintQueueCommand implements Command {
	public name = () => '>queue';
	public description = () => '?????????????? ?????????????? ?? ?????????????? ?? ????????????????.';
	public aliases? = () => ['>q'];

	public execute = async (
		msg: MessageContext,
		_args: string,
	): Promise<CommandResult> => {
		let err = await musicCmdSanityChecks(msg);

		if(err != null)
			return { response: null, error: err }

		globalVoiceState.get(msg.guildId).player.printQueue()
		return { response: null, error: null }
	}
}

// TODO: ?????????????? ????????.
// export class RemoveSongCommand implements Command { }
// export class ShuffleMusicQueueCommand implements Command {}
