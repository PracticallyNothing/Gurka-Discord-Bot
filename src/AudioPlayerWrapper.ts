import {
	AudioPlayer,
	AudioPlayerStatus,
	createAudioResource,
	demuxProbe,
} from '@discordjs/voice';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { BaseGuildTextChannel } from 'discord.js';
import { SerializedSong, Song } from './Song.js';
import { log, sendMessage, shuffleArray } from './Util.js';

const YTDL_EXE = 'yt-dlp';

enum PlayerMode {
	PlayOnce,
	//LoopOneSong,
	LoopQueue,
}

type OnNextSongCallback = (song?: Song) => void;

type Range = { begin: number, end: number }
type NumOrRange = number | Range;

/**
 * A wrapper around the discord.js AudioPlayer class.
 * Adds queue and dedicated music channel.
 * @see AudioPlayer
 */
class AudioPlayerWrapper {
	// TODO: Реално работа на този клас ли е да изписва неща в музикален канал?
	private player: AudioPlayer;

	public queue: Song[] = [];
	public musicChannel: BaseGuildTextChannel;
	public currentSong: Song = null;

	private mode: PlayerMode = PlayerMode.PlayOnce;
	private guildName: string;

	private ytdl_process: ChildProcessWithoutNullStreams = null;

	/**
	 * @param player Player to use to play music.
	 * @param musicTextChannel Channel to use for music messages.
	 */
	constructor(player: AudioPlayer, musicTextChannel: BaseGuildTextChannel) {
		this.player = player;
		this.musicChannel = musicTextChannel;
		this.guildName = this.musicChannel.guild.name;

		this.player.on("error", err => {
			log(`[${this.guildName}] AudioPlayerWrapper error: ${err.name}: ${err.message}.`)
		})

		// WARN: Това не бачка когато бота е изритан от някой канал,
		//       само когато сам напусне.
		this.player.on("unsubscribe", _sub => {
			log(`[${this.guildName}] AudioPlayerWrapper just unsubscribed.`)
		})

		this.player.on(AudioPlayerStatus.Idle, () => {
			log(`[${this.guildName}] AudioPlayerWrapper is Idle.`)

			for (let cb of this.callbacks)
				cb(this.queue[0]);

			this.playNextSong();
		});

		this.player.on(AudioPlayerStatus.Paused, () => {
			log(`[${this.guildName}] AudioPlayerWrapper is Paused.`)

			if (this.currentSong != null)
				this.currentSong.onPause();
		});

		this.player.on(AudioPlayerStatus.Playing, (_oldState, newState) => {
			log(`[${this.guildName}] AudioPlayerWrapper is Playing (${newState.playbackDuration}ms).`)

			if (this.currentSong != null)
				this.currentSong.onResume();
		});

		this.player.on(AudioPlayerStatus.AutoPaused, (_oldState, _newState) => {
			log(`[${this.guildName}] AudioPlayerWrapper is AutoPaused.`)

			if (this.currentSong != null)
				this.currentSong.onPause();
		});

		this.player.on(AudioPlayerStatus.Buffering, (_oldState, newState) => {
			const durationMs = newState.resource.playbackDuration
			log(`[${this.guildName}] AudioPlayerWrapper is Buffering (${durationMs}).`)
		});
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
	 * @param str String to pass to the play command.
	 *            Either contains a link or words to search youtube for.
	 */
	// FIXME: Защо песни над 1 час произволно спират да свирят около 50-та минута?
	// FIXME: Защо бота просто понякога изобщо не пуска песен?
	// FIXME: Защо търсенето на песни е толкова ебано?
	public play = async (str: string) => {
		log(`[${this.guildName}] AudioPlayerWrapper.play("${str}")`);

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
				justWordsBuf += word + ' ';
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

			log(`[${this.guildName}] AudioPlayerWrapper.play(): Searching for "${url}".`);

			let buf = '';

			// Print any errors out to the console.
			child.stderr.on('data', (data: Buffer) => {
				log(`[${this.guildName}] YTDL output to stderr follows.`)
				console.error(data.toString());
			});

			child.stdout.on('data', (data: string) => {
				let numSongs = 0;
				let numRemovedSongs = 0;
				let hasLongSong = false;

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
					entries = [{
						title: json['title'],
						duration: json['duration'],
						id: json['id'],
					}];
				}

				for (let e of entries) {
					const song = new Song(e['title'], e['duration'], e['id']);

					if (e['duration'] == 0) {
						numRemovedSongs++;
						continue;
					}

					if (e['duration'] >= 50 * 60)
						hasLongSong = true;

					if (this.queue.length > 0 || this.currentSong != null) {
						this.queue.push(song);
					} else {
						this.currentSong = song;
						this.queue.push(song);
						this.playNextSong();
					}

					numSongs++;
				}

				let removedSongsString = "";
				if (numRemovedSongs > 0)
					removedSongsString = `(Трябваше да махна ${numRemovedSongs} ${numRemovedSongs > 1 ? 'песен' : 'песни'}.)`

				// FIXME: Понякога се стига до тази точка и бота изписва "намерих 0 песен".
				//        Уж не би трябвало да е възможно това.
				this.musicChannel.send(`+ Добавих ${numSongs} ${numSongs > 1 ? 'песни' : 'песен'} ${removedSongsString}.`);

				// FIXME: Оправи грешката свързана с предупреждението.
				if (hasLongSong)
					this.musicChannel.send(':warning: В момента има бъг, поради който песни, дълги над час, спират около 50-тата минута.')
			});
		});
	};

	public initFromQueue = (q: SerializedSong[]) => {
		log(`[${this.guildName}] AudioPlayerWrapper.initFromQueue()`)

		if (this.queue.length != 0) {
			console.error("Attempted to init from queue when queue isn't empty.");
			return;
		}

		this.queue = q.map(s => new Song(s.title, s.duration, s.youtubeId));
		if (this.queue.length > 0)
			this.playNextSong();
	};

	public printCurrentSong = () => {
		log(`[${this.guildName}] AudioPlayerWrapper.printCurrentSong()`)

		if (this.currentSong == null) {
			this.musicChannel.send('Нищо.');
		} else {
			let title = this.currentSong.title;
			let elapsed = this.currentSong.calcTimeElapsedString(),
				duration = this.currentSong.durationString();

			this.musicChannel.send(`Слушаме **${title}** (${elapsed}/${duration}).`);
		}
	};

	public printQueue = () => {
		log(`[${this.guildName}] AudioPlayerWrapper.printQueue()`)

		if (this.queue.length == 0 && this.currentSong == null) {
			this.musicChannel.send('Нема какво да свириме.');
		} else if (this.queue.length == 0 && this.currentSong != null) {
			let title = this.currentSong.title;
			let elapsed = this.currentSong.calcTimeElapsedString(),
				duration = this.currentSong.durationString();

			this.musicChannel.send(`Сега слушаме **${title}** (${elapsed}/${duration}), обаче след туй: нищо.`);
		} else {
			const str = [];

			let title = this.currentSong.title;
			let elapsed = this.currentSong.calcTimeElapsedString(),
				duration = this.currentSong.durationString();

			this.queue.forEach((song, i) => {
				let title = song.title,
					duration = song.durationString();

				str.push(`${i + 1}. **${title}** (${duration})`);
			});

			sendMessage(
				`Сега слушаме **${title}** (${elapsed}/${duration}).\n` +
				`След туй иде:\n  ${str.join('  \n')}`, this.musicChannel,
			);
		}
	};

	// FIXME: Когато започнем от празна опашка от песни, бота изписва "Край на музиката". 
	//        Но няма нужда да го казва, когато е празна опашката, само когато свърши.
	private playNextSong = async () => {
		log(`[${this.guildName}] AudioPlayerWrapper.playNextSong()`)
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

		this.ytdl_process = child;
		log(`[${this.guildName}] AudioPlayerWrapper spawned YTDL ${child.pid}.`)

		// FIXME: ytdl процесите не умират, въпреки този код.
		//        Сигурно ли е, че работи?
		child.on('exit', () => {
			log(`[${this.guildName}] AudioPlayerWrapper YTDL ${child.pid} exited.`)
			this.ytdl_process = null;
		});

		const { stream, type } = await demuxProbe(child.stdout);
		const resource = createAudioResource(stream, { inputType: type });

		const titleContains = (str: string) =>
			this.currentSong.title
				.toLocaleLowerCase()
				.indexOf(str.toLocaleLowerCase()) >= 0;

		if (titleContains('bladee')) {
			await this.musicChannel.send('il be blejd');
		} else if (titleContains('League of Legends') || 
				   titleContains('KD/A') ||
				   titleContains('Pentakill')) {
			await this.musicChannel.send('il be liga');
		} else if (titleContains('Drake')) {
			await this.musicChannel.send('il be drejk');
		}

		this.musicChannel.send(`⏵ Пускаме **${song.title}** (${song.durationString()})!`);
		this.player.play(resource);
	};

	public skip = () => {
		log(`[${this.guildName}] AudioPlayerWrapper.skip()`)
		this.player.stop();

		if (this.ytdl_process)
			this.ytdl_process.kill();

		if (this.currentSong == null) {
			this.queue.unshift();
		} else {
			this.currentSong = null;
		}
	};

	public clearQueue = () => {
		log(`[${this.guildName}] AudioPlayerWrapper.clearQueue()`)
		this.queue = [];
		this.currentSong = null;
		this.player.stop();
	};

	public pause = () => {
		log(`[${this.guildName}] AudioPlayerWrapper.pause()`)
		this.player.pause();
	};

	public unpause = () => {
		log(`[${this.guildName}] AudioPlayerWrapper.unpause()`)
		this.player.unpause();
	};


	/** 
	  * Removes a single song or a range of songs from the queue.
	  * @param numOrRange A single number or a range of numbers which to remove. Must start at 1, not 0.
	  * @returns Whether the removal was successful.
	  */
	public remove = (numOrRange: NumOrRange) => {
		switch (typeof (numOrRange)) {
			case "number":
				if (numOrRange < 1 || numOrRange > this.queue.length)
					return false;
				this.queue.splice(numOrRange - 1, 1);
				return true;
			default:
				if (numOrRange.begin < 1 ||
					numOrRange.end > this.queue.length ||
					numOrRange.begin > numOrRange.end)
					return false;
				this.queue.splice(numOrRange.begin - 1, numOrRange.end - numOrRange.begin)
				return true;
		}
	}

	public shuffle = () => {
		if (this.queue.length < 2) return;
		if (this.queue.length === 2) this.queue.reverse();
		shuffleArray(this.queue)
	}
}

export { AudioPlayerWrapper };

