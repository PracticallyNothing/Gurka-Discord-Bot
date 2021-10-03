import autobind from 'auto-bind';
import { sprintf } from 'sprintf-js';
/**
 * Convert a number of seconds into a comma-separated format (hh:mm:ss).
 * @param {number} seconds Seconds to convert to time string.
 * @returns {string} The time string in a comma-separated format (hh:mm:ss).
 */
function secondsToTimeString(seconds) {
	const h = Math.floor(seconds / 3600.0);
	const m = Math.floor((seconds / 60.0) % 60);
	const s = Math.floor(seconds % 60);

	return h > 0
		? sprintf('%02d:%02d:%02d', h, m, s)
		: sprintf('%02d:%02d', m, s);
}

class Song {
	/**
	 * Create a new song.
	 * @param {string} title Title of the song.
	 * @param {number} duration How many seconds the track lasts.
	 * @param {string} youtubeId Youtube ID to use for constructing the song's URL.
	 */
	constructor(title, duration, youtubeId) {
		/** @type {string} */
		this.title = title;

		/** @type {string} */
		this.duration = secondsToTimeString(duration);

		/** @type {string} */
		this.url = `https://www.youtube.com/watch?v=${youtubeId}`;
		autobind(this);
	}
}

export { Song };
