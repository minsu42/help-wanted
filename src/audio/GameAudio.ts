export type GameSound = 'click' | 'paper' | 'book' | 'stamp' | 'message' | 'success' | 'warning' | 'day';

export interface GameAudioController {
  readonly muted: boolean;
  toggleMuted(): void;
  startMusic(): void;
  play(sound: GameSound): void;
  destroy(): void;
}

const STORAGE_KEY = 'help-wanted.audio-muted';

export class GameAudio implements GameAudioController {
  private context?: AudioContext;
  private master?: GainNode;
  private music?: GainNode;
  private effects?: GainNode;
  private musicTimer?: number;
  private musicRequested = false;
  private destroyed = false;
  private _muted = readMutedPreference();

  get muted(): boolean { return this._muted; }

  toggleMuted(): void {
    this._muted = !this._muted;
    writeMutedPreference(this._muted);
    if (this._muted) { this.stopMusicTimer(); this.setMasterLevel(0); return; }
    void this.ensureContext().then(() => {
      this.setMasterLevel(0.32);
      this.play('click');
      if (this.musicRequested) this.beginMusic();
    });
  }

  startMusic(): void {
    this.musicRequested = true;
    if (!this._muted) void this.ensureContext().then(() => this.beginMusic());
  }

  play(sound: GameSound): void {
    if (!this._muted && !this.destroyed) void this.ensureContext().then(() => this.synthesise(sound));
  }

  destroy(): void {
    this.destroyed = true;
    this.stopMusicTimer();
    if (this.context) void this.context.close();
    this.context = undefined;
  }

  private async ensureContext(): Promise<AudioContext | undefined> {
    if (this.destroyed) return undefined;
    if (!this.context) {
      const AudioContextClass = window.AudioContext;
      if (!AudioContextClass) return undefined;
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.music = this.context.createGain();
      this.effects = this.context.createGain();
      this.master.gain.value = this._muted ? 0 : 0.32;
      this.music.gain.value = 0.12;
      this.effects.gain.value = 0.5;
      this.music.connect(this.master);
      this.effects.connect(this.master);
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') {
      try { await this.context.resume(); } catch { return undefined; }
    }
    return this.context;
  }

  private setMasterLevel(level: number): void {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(level, now, 0.025);
  }

  private beginMusic(): void {
    if (this.musicTimer !== undefined || this._muted || !this.context || !this.music) return;
    this.scheduleMotif();
    this.musicTimer = window.setInterval(() => this.scheduleMotif(), 8_000);
  }

  private stopMusicTimer(): void {
    if (this.musicTimer === undefined) return;
    window.clearInterval(this.musicTimer);
    this.musicTimer = undefined;
  }

  private scheduleMotif(): void {
    const context = this.context;
    const output = this.music;
    if (!context || !output || this._muted || context.state !== 'running') return;
    const start = context.currentTime + 0.04;
    [146.83, 220, 293.66].forEach((frequency, index) => this.tone(frequency, start + index * 0.12, 4.8, 0.035, 'triangle', output));
    this.tone(440, start + 2.1, 1.2, 0.018, 'sine', output);
    this.tone(392, start + 3.45, 1.35, 0.016, 'sine', output);
  }

  private synthesise(sound: GameSound): void {
    const context = this.context;
    const output = this.effects;
    if (!context || !output || context.state !== 'running') return;
    const now = context.currentTime;
    if (sound === 'click') this.tone(720, now, 0.055, 0.11, 'triangle', output);
    else if (sound === 'paper') this.noise(now, 0.12, 0.1, 1_800, output);
    else if (sound === 'book') { this.noise(now, 0.22, 0.13, 900, output); this.tone(185, now, 0.12, 0.06, 'triangle', output); }
    else if (sound === 'stamp') { this.noise(now, 0.075, 0.22, 520, output); this.tone(92, now, 0.16, 0.22, 'sine', output); }
    else if (sound === 'message') { this.tone(520, now, 0.07, 0.08, 'triangle', output); this.tone(660, now + 0.075, 0.09, 0.07, 'triangle', output); }
    else if (sound === 'success') [392, 493.88, 587.33].forEach((frequency, index) => this.tone(frequency, now + index * 0.11, 0.35, 0.09, 'sine', output));
    else if (sound === 'warning') this.tone(196, now, 0.28, 0.12, 'sawtooth', output, 146.83);
    else [293.66, 392, 587.33].forEach((frequency, index) => this.tone(frequency, now + index * 0.13, 0.55, 0.07, 'sine', output));
  }

  private tone(frequency: number, start: number, duration: number, volume: number, type: OscillatorType, output: AudioNode, endFrequency = frequency): void {
    const context = this.context;
    if (!context) return;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.04, duration / 3));
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope);
    envelope.connect(output);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  private noise(start: number, duration: number, volume: number, frequency: number, output: AudioNode): void {
    const context = this.context;
    if (!context) return;
    const frameCount = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < frameCount; index += 1) channel[index] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 0.7;
    envelope.gain.setValueAtTime(volume, start);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(output);
    source.start(start);
  }
}

function readMutedPreference(): boolean {
  try { return window.localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
}

function writeMutedPreference(muted: boolean): void {
  try { window.localStorage.setItem(STORAGE_KEY, String(muted)); } catch { /* Storage can be unavailable. */ }
}
