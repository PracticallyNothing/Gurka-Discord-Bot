import { TextBasedChannels } from 'discord.js';

async function sendMessage(message: string, channel: TextBasedChannels) {
	message = message.trim()

	if (message.length < 2000 && message.length > 0) {
		await channel.send(message);
		return
	}

	let i = 2000;
	for (; i >= 0; i--) if (message[i] == '\n') break;

	await channel.send(message.substr(0, i));
	sendMessage(message.substr(i), channel);
}

export { sendMessage };
