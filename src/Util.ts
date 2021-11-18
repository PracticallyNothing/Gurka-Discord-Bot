import { TextBasedChannels } from 'discord.js';

async function sendMessage(message: string, channel: TextBasedChannels) {
	if(message.length < 2000)
		await channel.send(message)

	let i = 2000;
	for(; i >= 0; i++)
		if(message[i] == '\n')
			break;

	await channel.send(message.substr(0, i));
	sendMessage(message.substr(i), channel);
}

export { sendMessage };
