import {Client, Intents, TextChannel} from 'discord.js';
import { readFileSync } from 'fs';
import { log } from './Util.js';

import {
	Command,
	ClearMusicQueueCommand,
	JoinVoiceChannelCommand,
	LeaveVoiceChannelCommand,
	MessageContext,
	PauseMusicCommand,
	PlayMusicCommand,
	ResponseCommand,
	SkipSongCommand,
	NowPlayingCommand,
	PrintQueueCommand,
	RemoveSongCommand,
	ShuffleMusicQueueCommand,
} from './Command.js';

type Config = {
	token: string | null;
};

const config: Config = JSON.parse(
	readFileSync('./config.json').toString('utf-8'),
);

if (config.token == null) {
	log('ERROR: NO TOKEN IN config.json FOUND!');
	process.exit(-1);
}

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
	log('Loading complete.');
});

var Commands: Command[] = []
/** Map from command name to index in Commands array. */
var CommandLookup: Map<string, number> = new Map();

function addCmd(cmd: Command) {
	const idx = Commands.length
	Commands.push(cmd);
	CommandLookup.set(cmd.name(), idx);

	if (cmd.aliases != undefined && cmd.aliases() != undefined) {
		for (let a of cmd.aliases()) {
			if (CommandLookup.has(a)) {
				console.error(`ERROR: Alias/Command ${a} already exists. Skipping.`);
				continue;
			}

			CommandLookup.set(a, idx);
		}
	}
}

function genHelp() {
	let respMsg = 'Помагам ти:\n';

	respMsg += '    - `help` - Помагай, шефе!\n';
	for (let cmd of Commands) {
		let name = cmd.name()
		let descr = cmd.description()

		if(cmd.aliases && cmd.aliases() != undefined && cmd.aliases().length > 0) {
			const aliases = cmd.aliases().map(a => `\`${a}\``).join(', ')
			respMsg += `    - \`${name}\` (или ${aliases}) - ${descr}\n`;
		} else {
			respMsg += `    - \`${name}\` - ${descr}\n`;
		}
	}

	return respMsg;
}

addCmd(
	new ResponseCommand('boqn e gej', 'mrazq boqn', [
		'boqn e pedal',
		'boqn e gej',
		'boqn e retard',
		'boqn e majmuna',
		'boqn e izrod',
		'boqn e prudljo',
		'boqn ima maluk huj',
		'boqn si zaslujava tova koeto mu predstoi',
		'boqn e prase',
		'boqn e mravka',
		'boqn e pluh',
		'boqn e chervej',
	]),
);

addCmd(
	new ResponseCommand('daj gurka', 'Нали все пак е краставичар?', [
		':cucumber:',
	]),
);
addCmd(
	new ResponseCommand('daj gurki', 'Нали все пак е краставичар(2)?', [
		':cucumber: :cucumber:',
	]),
);

addCmd(new JoinVoiceChannelCommand());
addCmd(new LeaveVoiceChannelCommand());
addCmd(new PlayMusicCommand());
addCmd(new PauseMusicCommand());
addCmd(new SkipSongCommand());
addCmd(new ClearMusicQueueCommand());

addCmd(new NowPlayingCommand());
addCmd(new PrintQueueCommand());

addCmd(new RemoveSongCommand());
addCmd(new ShuffleMusicQueueCommand());

addCmd(new ResponseCommand('>help', 'Помагай, шефе!', [genHelp()]));

client.on('messageCreate', async (msg) => {
	if (msg.author.id == client.user.id) return;

	log(`[${msg.guild.name}, @${msg.author.username}]: "${msg.content}"`);

	const member = await msg.guild.members.fetch({ user: msg.author });

	let msgCtx: MessageContext = {
		content: msg.content,

		client: client,

		senderId: msg.author.id,
		senderUsername: msg.author.username,
		senderNickname: member.nickname,
		senderIsBot: msg.author.bot,

		senderVoiceChannelId: member.voice.channelId,

		channelId: msg.channelId,
		channelName: (msg.channel as TextChannel).name,

		guildId: msg.guildId,
		guildName: msg.guild.name,
	};

	const cmdParts = msg.content.trimLeft().split(' ');

	const cmd = cmdParts[0];
	const args = cmdParts.slice(1).join(' ');

	if (CommandLookup.has(cmd)) {
		const idx = CommandLookup.get(cmd)
		let res = await Commands[idx].execute(msgCtx, args);

		if (res.error != null) {
			await msg.channel.send(`ГРЕШКА: ${res.error}`);
		} else if (res.response != null) {
			await msg.channel.send(res.response);
		}

		return;
	}

	if(msg.content == ">kill")
		process.exit(-1)

	if (msg.content.startsWith('>nick ')) {
		let self = await msg.guild.members.fetch(client.user.id);
		self.setNickname(msg.content.substr('>nick '.length));
		return;
	}
});

// Login to Discord with your client's token
client.login(config.token);
