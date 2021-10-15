import { TextBasedChannels } from 'discord.js';

async function sendMessage(message: string, channel: TextBasedChannels) {
	await channel.send(message.substr(0, 1800));

	if (message.length >= 1800)
		await sendMessage(message.substr(1800), channel);
}

export { sendMessage };
