import {
	createAudioPlayer,
	DiscordGatewayAdapterCreator,
	joinVoiceChannel,
	NoSubscriberBehavior,
	VoiceConnection,
} from '@discordjs/voice';
import { BaseGuildTextChannel, Client } from 'discord.js';
import { AudioPlayerWrapper } from './AudioPlayerWrapper';

export type CommandResult = {
	response: string | null;
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

const globalVoiceState: Map<string, VoiceState> = new Map();

async function doJoinVC(msg: MessageContext): Promise<CommandResult> {
	if (msg.senderVoiceChannelId == null) {
		return {
			response: null,
			error: 'You must be in a voice channel for me to enter!',
		};
	}

	if (globalVoiceState.has(msg.guildId)) {
		return {
			response: null,
			error: "I've already joined another voice channel!",
		};
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
		(await msg.client.channels.fetch(
			msg.channelId,
		)) as BaseGuildTextChannel,
	);

	globalVoiceState.set(msg.senderVoiceChannelId, {
		voiceConnection: voiceConnection,
		player: wrapper,
	});

	return {
		response: 'Идвам.',
		error: null,
	};
}

// Can only join 1 VC per server (guild).
// User who asked for join must be in VC.
// TODO: VC must exist until we've joined. (currently not checked)
export class JoinVoiceChannelCommand implements Command {
	name: () => '>join';
	description: () => 'Присъединяване към гласов канал';
	aliases?: () => ['>ela', 'ai laf', 'laf?'];

	public execute = async (
		msg: MessageContext,
		_args?: string,
	): Promise<CommandResult> => {
		return doJoinVC(msg);
	};
}

export class LeaveVoiceChannelCommand implements Command {
	name: () => '>leave';
	description: () => 'Напуска гласов канал.';
	aliases?: () => ['>marsh', '>mahaj se'];

	public execute = async (msg: MessageContext): Promise<CommandResult> => {
		if (globalVoiceState.has(msg.guildId)) {
			return {
				response: null,
				error: "I'm not in a voice channel.",
			};
		}

		globalVoiceState.get(msg.guildId).voiceConnection.destroy();
		globalVoiceState.delete(msg.guildId);
	};
}

export class PlayMusicCommand implements Command {
	name: () => '>play';
	description: () => 'Пусни музика';
	aliases?: () => [''];

	public execute = async (
		msg: MessageContext,
		args: string,
	): Promise<CommandResult> => {
		let res = await doJoinVC(msg);
		if (res.error != null) return res;

		globalVoiceState.get(msg.guildId).player.play(args);

		return {
			response: null,
			error: null,
		};
	};
}
