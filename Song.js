import autobind from 'auto-bind';
import { sprintf } from 'sprintf-js';
/**
 * Convert a number of seconds into a comma-separated format (hh:mm:ss).
 * @param {number} seconds Seconds to convert to time string.
 * @param {boolean} forceHours Force displaying hours.
 * @returns {string} The time string in a comma-separated format (hh:mm:ss).
 */
function secondsToTimeString(seconds, forceHours = false) {
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

		/**
		 * UNIX timestamp in seconds (Date.now() / 1000) of when the song was started.
		 * @see Date.now
		 * @type {number}
		 */
		this.timeStarted = 0;

		/**
		 * Number of seconds that have elapsed since starting the song.
		 * Used when the song has been paused and restarted.
		 * @type {number}
		 */
		this.timeElapsed = 0;

		/**
		 * Whether the song has been paused.
		 * @type {boolean}
		 */
		this.paused = false;

		/** @type {number} */
		this.duration = duration;

		/** @type {string} */
		this.url = `https://www.youtube.com/watch?v=${youtubeId}`;
		autobind(this);
	}

	durationString() {
		return secondsToTimeString(this.duration);
	}

	calcTimeElapsedString() {
		return secondsToTimeString(
			this.paused
				? this.timeElapsed
				: this.timeElapsed + (Date.now() / 1000 - this.timeStarted),
			this.duration >= 3600,
		);
	}

	onPause() {
		this.timeElapsed += Date.now() / 1000 - this.timeStarted;
		this.paused = true;
	}

	onResume() {
		this.timeStarted = Date.now() / 1000;
		this.paused = false;
	}
}

export { Song };
