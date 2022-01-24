import { BaseGuildTextChannel } from 'discord.js';

async function sendMessage(message: string, channel: BaseGuildTextChannel) {
	if(channel == null) {
		console.log(`ERROR: Attempt to send message to null channel.`)
	}

	if(message == null) {
		console.log(`WARNING: Attempted to send null message to channel ${channel.name}`)
		return;
	}

	message = message.trim()

	if(message.length == 0) {
		console.log(`WARNING: Attempted to send empty message to channel ${channel.name}`)
		return;
	}

	if (message.length < 2000 && message.length > 0) {
		await channel.send(message);
		return
	}

	let i = 2000;
	for (; i >= 0; i--) if (message[i] == '\n') break;

	try {
		await channel.send(message.substr(0, i));
	} catch (e) {
		console.log(`ERROR: ${e}`)
	}
	sendMessage(message.substr(i), channel);
}

export { sendMessage };
