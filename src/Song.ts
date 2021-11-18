import { sprintf } from 'sprintf-js';
//import { autobind } from 'ts-class-autobind';
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

type SerializedSong = {
	title: string;
	duration: number;
	youtubeId: string;
};

class Song {
	public title: string;

	/** UNIX timestamp in seconds (Date.now() / 1000) of when the song was started. */
	private timeStarted: number;

	/**
	 * Number of seconds that have elapsed since starting the song.
	 * Used when the song has been paused and restarted.
	 */
	private timeElapsed: number;

	/** Whether the song has been paused. */
	private paused: boolean;

	/** Duration of song in seconds. */
	private duration: number;

	private youtubeId: string;

	public url: string;

	/**
	 * Create a new song.
	 * @param title Title of the song.
	 * @param duration How many seconds the track lasts.
	 * @param youtubeId Youtube ID to use for constructing the song's URL.
	 */
	public constructor(title: string, duration: number, youtubeId: string) {
		this.title = title;

		this.timeStarted = 0;
		this.timeElapsed = 0;

		this.paused = false;
		this.duration = duration;

		this.url = `https://www.youtube.com/watch?v=${youtubeId}`;
		this.youtubeId = youtubeId;

		//autobind(this);
	}

	public durationString = () => {
		return secondsToTimeString(this.duration);
	};

	public calcTimeElapsedString = () => {
		return secondsToTimeString(
			this.paused
				? this.timeElapsed
				: this.timeElapsed + (Date.now() / 1000 - this.timeStarted),
			this.duration >= 3600,
		);
	};

	public reset = () => {
		this.timeElapsed = 0;
		this.paused = false;
	};

	public onPause = () => {
		this.timeElapsed += Date.now() / 1000 - this.timeStarted;
		this.paused = true;
	};

	public onResume = () => {
		this.timeStarted = Date.now() / 1000;
		this.paused = false;
	};

	public serialize = (): SerializedSong => {
		return {
			title: this.title,
			duration: this.duration,
			youtubeId: this.youtubeId,
		};
	};
}

export { SerializedSong, Song };
