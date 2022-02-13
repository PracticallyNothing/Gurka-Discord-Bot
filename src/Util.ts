import { BaseGuildTextChannel } from 'discord.js';
import { sprintf } from 'sprintf-js';

async function sendMessage(message: string, channel: BaseGuildTextChannel) {
	if (channel == null) {
		console.log(`ERROR: Attempt to send message to null channel.`)
	}

	if (message == null) {
		console.log(`WARNING: Attempted to send null message to channel ${channel.name}`)
		return;
	}

	message = message.trim()

	if (message.length == 0) {
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

function log(msg: string) {
	const time = new Date();
	console.log(`${time.toISOString()}: ${msg}`);
}

/**
 * Convert a number of seconds into a comma-separated format (hh:mm:ss).
 * @param seconds Seconds to convert to time string.
 * @param forceHours Force displaying hours.
 * @returns The time string in a comma-separated format (hh:mm:ss).
 */
function secondsToTimeString(
	seconds: number,
	forceHours: boolean = false,
): string {
	const h = Math.floor(seconds / 3600.0);
	const m = Math.floor((seconds / 60.0) % 60);
	const s = Math.floor(seconds % 60);

	if (forceHours) {
		return sprintf('%02d:%02d:%02d', h, m, s);
	} else {
		return h > 0
			? sprintf('%02d:%02d:%02d', h, m, s)
			: sprintf('%02d:%02d', m, s);
	}
}

function shuffleArray<T>(arr: T[], skipFirstN: number = 0) {
	for(let i = arr.length - 1; i > skipFirstN; i--) {
		let j = Math.floor(Math.random() * i)

		let tmp = arr[i];
		arr[i] = arr[j];
		arr[j] = tmp;
	}
	return arr;
}

export { sendMessage, log, secondsToTimeString, shuffleArray };
