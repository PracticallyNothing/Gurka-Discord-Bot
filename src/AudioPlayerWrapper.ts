import {
	AudioPlayer,
	AudioPlayerStatus,
	createAudioResource,
	demuxProbe,
} from '@discordjs/voice';
import { spawn } from 'child_process';
import { TextBasedChannels } from 'discord.js';
//import { autobind } from 'ts-class-autobind';
import { SerializedSong, Song } from './Song.js';
import { sendMessage } from './Util.js';

const YTDL_EXE = 'yt-dlp';

enum PlayerMode {
	PlayOnce,
	//LoopOneSong,
	LoopQueue,
}

type OnNextSongCallback = () => void;

/**
 * A wrapper around the discord.js AudioPlayer class.
 * Adds queue and dedicated music channel.
 * @see AudioPlayer
 */
class AudioPlayerWrapper {
	private player: AudioPlayer;
	public queue: Song[] = [];
	public musicChannel: TextBasedChannels;
	public currentSong: Song = null;

	private mode: PlayerMode = PlayerMode.PlayOnce;

	/**
	 * @param player Player to use to play music.
	 * @param musicTextChannel Channel to use for music messages.
	 */
	constructor(
		player: AudioPlayer,
		musicTextChannel: import('discord.js').TextBasedChannels,
	) {
		this.player = player;
		this.musicChannel = musicTextChannel;

		this.player.on(AudioPlayerStatus.Idle, () => {
			for (let cb of this.callbacks) cb();
			this.playNextSong();
		});

		this.player.on(AudioPlayerStatus.Paused, () => {
			if (this.currentSong != null) {
				this.currentSong.onPause();
			}
		});
		this.player.on(AudioPlayerStatus.Playing, () => {
			if (this.currentSong != null) {
				this.currentSong.onResume();
			}
		});
		this.player.on(AudioPlayerStatus.AutoPaused, () => {
			if (this.currentSong != null) {
				this.currentSong.onPause();
			}
		});

		//autobind(this);
	}

	public changeMode = () => {
		switch (this.mode) {
			case PlayerMode.PlayOnce:
				this.mode = PlayerMode.LoopQueue;
				break;
			case PlayerMode.LoopQueue:
				this.mode = PlayerMode.PlayOnce;
				break;
		}
	};

	private callbacks: OnNextSongCallback[] = [];
	public onNextSong = (callback: OnNextSongCallback) => {
		this.callbacks.push(callback);
	};

	/**
	 * @param str String to pass to the play command. Either contains a link or words to search youtube for.
	 */
	public play = async (str: string) => {
		str = str.trim();
		const words = str.split(' ');

		/** @type {Array<string>} */
		const songUrls: Array<string> = [];
		let justWordsBuf = '';

		words.forEach((word) => {
			if (word.startsWith('http://') || word.startsWith('https://')) {
				if (justWordsBuf.length > 0) {
					songUrls.push(justWordsBuf);
					justWordsBuf = '';
				}

				songUrls.push(word);
			} else {
				justWordsBuf += word;
			}
		});

		if (justWordsBuf.length > 0) {
			songUrls.push(justWordsBuf);
			justWordsBuf = '';
		}

		songUrls.forEach((url) => {
			const child = spawn(
				YTDL_EXE,
				[
					'--default-search',
					'ytsearch',
					'--flat-playlist',
					'--dump-single-json',
					url,
				],
				{
					cwd: process.cwd(),
					stdio: 'pipe',
				},
			);

			let buf = '';

			// Print any errors out to the console.
			child.stderr.on('data', (data: string) => { console.error(data) })

			child.stdout.on('data', (data: string) => {
				let numSongs = 0;
				let json: any;

				try {
					json = JSON.parse(buf + data);
				} catch {
					buf += data;
					return;
				}

				if (json == undefined) {
					this.musicChannel.send('**#** Не го намерих туй???');
					return;
				}

				let entries: any[] = json['entries'];

				if (entries == undefined) {
					entries = [
						{
							title: json['title'],
							duration: json['duration'],
							id: json['id'],
						},
					];
				}

				for (let e of entries) {
					const song = new Song(e['title'], e['duration'], e['id']);

					if (this.queue.length > 0 || this.currentSong != null) {
						this.queue.push(song);
					} else {
						this.currentSong = song;
						this.queue.push(song);
						this.playNextSong();
					}

					numSongs++;
				}

				this.musicChannel.send(
					`+ Добавих ${numSongs} ${
						numSongs > 1 ? 'песни' : 'песен'
					}.`,
				);
			});
		});
	};

	public initFromQueue = (q: SerializedSong[]) => {
		if (this.queue.length != 0) {
			console.error(
				"Attempted to init from queue when queue isn't empty.",
			);
			return;
		}

		this.queue = q.map((s) => new Song(s.title, s.duration, s.youtubeId));
		this.playNextSong();
	};

	public printCurrentSong = () => {
		if (this.currentSong == null) {
			this.musicChannel.send('Нищо.');
		} else {
			this.musicChannel.send(
				`Слушаме **${
					this.currentSong.title
				}** (${this.currentSong.calcTimeElapsedString()}/${this.currentSong.durationString()}).`,
			);
		}
	};

	public printQueue = () => {
		if (this.queue.length == 0 && this.currentSong == null) {
			this.musicChannel.send('Нема какво да свириме.');
		} else if (this.queue.length == 0 && this.currentSong != null) {
			this.musicChannel.send(
				`Сега слушаме **${
					this.currentSong.title
				}** (${this.currentSong.durationString()}), обаче след туй: нищо.`,
			);
		} else {
			const str = [];

			this.queue.forEach((song, i) => {
				str.push(
					`${i + 1}. **${song.title}** (${song.durationString()})`,
				);
			});

			sendMessage(
				`Сега слушаме **${
					this.currentSong.title
				}** (${this.currentSong.durationString()}).\n` +
					`След туй иде:\n  ${str.join('  \n')}`,
				this.musicChannel,
			);
		}
	};

	private playNextSong = async () => {
		const song = this.queue.shift();

		if (song == undefined) {
			this.currentSong = null;
			await this.musicChannel.send('Край на музиката.');
			return;
		}

		if (this.mode == PlayerMode.LoopQueue) {
			this.currentSong.reset();
			this.queue.push(this.currentSong);
		}

		this.currentSong = song;

		const child = spawn(YTDL_EXE, [
			'-f',
			'bestaudio',
			'-o',
			'-',
			'--default-search',
			'ytsearch',
			song.url,
		]);

		const { stream, type } = await demuxProbe(child.stdout);
		const resource = createAudioResource(stream, { inputType: type });

		const titleContains = (str: string) =>
			this.currentSong.title
				.toLocaleLowerCase()
				.indexOf(str.toLocaleLowerCase()) >= 0;

		if (titleContains('bladee')) {
			await this.musicChannel.send('il be blejd');
		} else if (titleContains('KD/A') || titleContains('Pentakill')) {
			await this.musicChannel.send('il be liga');
		} else if (titleContains('Drake')) {
			await this.musicChannel.send('il be drejk');
		}

		this.musicChannel.send(
			`⏵ Пускаме **${song.title}** (${song.durationString()})!`,
		);
		this.player.play(resource);
	};

	public skip = () => {
		this.player.stop();

		if (this.currentSong == null) {
			this.queue.unshift();
		} else {
			this.currentSong = null;
		}
	};

	public clearQueue = () => {
		this.queue = [];
		this.currentSong = null;
		this.player.stop();
	};

	public pause = () => {
		this.player.pause();
	};

	public unpause = () => {
		this.player.unpause();
	};
}

export { AudioPlayerWrapper };
