import {
	AudioPlayer,
	AudioPlayerStatus,
	createAudioResource,
	demuxProbe,
} from '@discordjs/voice';
import { spawn, spawnSync } from 'child_process';
import { TextBasedChannels } from 'discord.js';
import { Song } from './Song';

/**
 * A wrapper around the discord.js AudioPlayer class.
 * Adds queue and dedicated music channel.
 * @see AudioPlayer
 */
class AudioPlayerWrapper {
	private player: AudioPlayer;
	private queue: Song[];
	private musicChannel: TextBasedChannels;
	public currentSong: Song;

	/**
	 * @param player Player to use to play music.
	 * @param musicTextChannel Channel to use for music messages.
	 */
	constructor(
		player: AudioPlayer,
		musicTextChannel: import('discord.js').TextBasedChannels,
	) {
		this.player = player;
		this.queue = [];
		this.musicChannel = musicTextChannel;
		this.currentSong = null;

		this.player.on(AudioPlayerStatus.Idle, this.playNextSong);
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
	}

	/**
	 * @param str String to pass to the play command. Either contains a link or words to search youtube for.
	 */
	public async play(str: string) {
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
			const child = spawnSync(
				'/bin/youtube-dl',
				[
					'--default-search',
					'ytsearch',
					'--flat-playlist',
					'--dump-json',
					url,
				],
				{
					cwd: process.cwd(),
					env: process.env,
					stdio: 'pipe',
					encoding: 'utf-8',
				},
			);

			let numSongs = 0;
			child.stdout.split('\n').forEach((json) => {
				if (json.trim().length == 0) return;

				const info = JSON.parse(json);
				const song = new Song(
					info['title'],
					info['duration'],
					info['id'],
				);

				if (this.queue.length > 0 || this.currentSong != null) {
					this.queue.push(song);
				} else {
					this.currentSong = song;
					this.queue.push(song);
					this.playNextSong();
				}

				numSongs++;
			});

			this.musicChannel.send(
				`+ Добавих ${numSongs} ${numSongs > 1 ? 'песни' : 'песен'}.`,
			);
		});
	}

	public printCurrentSong() {
		if (this.currentSong == null) {
			this.musicChannel.send('Нищо.');
		} else {
			this.musicChannel.send(
				`Слушаме **${
					this.currentSong.title
				}** (${this.currentSong.calcTimeElapsedString()}/${this.currentSong.durationString()}).`,
			);
		}
	}

	public printQueue() {
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

			this.musicChannel.send(
				`Сега слушаме **${
					this.currentSong.title
				}** (${this.currentSong.durationString()}).\n` +
					`След туй иде:\n  ${str.join('  \n')}`,
			);
		}
	}

	private async playNextSong() {
		const song = this.queue.shift();

		if (song == undefined) {
			this.currentSong = null;
			await this.musicChannel.send('Край на музиката.');
			return;
		}

		this.currentSong = song;

		const child = spawn('/bin/youtube-dl', [
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

		const titleContains = (str) =>
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
	}

	public skip() {
		this.player.stop();
		this.currentSong = null;
	}

	public clearQueue() {
		this.queue = [];
		this.currentSong = null;
		this.player.stop();
	}

	public pause() {
		if (this.player.state.status == AudioPlayerStatus.Playing) {
			this.player.pause();
		}
	}

	public unpause() {
		if (this.player.state.status == AudioPlayerStatus.Paused) {
			this.player.unpause();
		}
	}
}

export { AudioPlayerWrapper };
