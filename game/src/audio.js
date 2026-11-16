// All sound is synthesized with WebAudio: short oscillator envelopes, no audio files,
// so the game stays fully offline and loads nothing. The context is created lazily on
// the first user gesture (browsers forbid audio before one); screenshot scenes never
// create it at all.
export class SoundBank {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = false;
    this.padNodes = null;
  }

  ensure() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.context.destination);
      return true;
    } catch {
      return false;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  tone({ type = 'sine', from = 440, to = null, duration = 0.12, volume = 0.2, delay = 0 }) {
    if (!this.context || this.muted) return;
    try {
      const now = this.context.currentTime + delay;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(from, now);
      if (to !== null) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + duration);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain);
      gain.connect(this.master);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.05);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  noise({ duration = 0.2, volume = 0.2, lowpass = 1200 }) {
    if (!this.context || this.muted) return;
    try {
      const now = this.context.currentTime;
      const length = Math.max(1, Math.floor(this.context.sampleRate * duration));
      const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      const filter = this.context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      const gain = this.context.createGain();
      gain.gain.value = volume;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      source.start(now);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  shoot() {
    this.tone({ type: 'square', from: 880 + Math.random() * 120, to: 320, duration: 0.07, volume: 0.08 });
  }

  enemyPop() {
    this.noise({ duration: 0.14, volume: 0.16, lowpass: 900 });
    this.tone({ type: 'triangle', from: 220, to: 60, duration: 0.14, volume: 0.14 });
  }

  playerHit() {
    this.noise({ duration: 0.25, volume: 0.25, lowpass: 500 });
    this.tone({ type: 'sawtooth', from: 160, to: 40, duration: 0.3, volume: 0.2 });
  }

  pickup() {
    this.tone({ type: 'sine', from: 660, duration: 0.09, volume: 0.14 });
    this.tone({ type: 'sine', from: 990, duration: 0.14, volume: 0.14, delay: 0.07 });
  }

  dash() {
    this.noise({ duration: 0.12, volume: 0.1, lowpass: 2400 });
  }

  waveHorn() {
    this.tone({ type: 'sawtooth', from: 196, to: 392, duration: 0.5, volume: 0.1 });
    this.tone({ type: 'sawtooth', from: 294, to: 588, duration: 0.5, volume: 0.07, delay: 0.05 });
  }

  gameOver() {
    this.tone({ type: 'triangle', from: 392, to: 370, duration: 0.35, volume: 0.16 });
    this.tone({ type: 'triangle', from: 311, to: 294, duration: 0.35, volume: 0.16, delay: 0.3 });
    this.tone({ type: 'triangle', from: 233, to: 110, duration: 0.8, volume: 0.18, delay: 0.6 });
  }

  victory() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((note, i) => this.tone({ type: 'triangle', from: note, duration: 0.3, volume: 0.14, delay: i * 0.12 }));
  }

  // A quiet two-note pad that hums under play, started once per session.
  startPad() {
    if (!this.context || this.padNodes) return;
    try {
      const gain = this.context.createGain();
      gain.gain.value = 0.035;
      gain.connect(this.master);
      const nodes = [];
      for (const frequency of [110, 164.8, 220]) {
        const oscillator = this.context.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        oscillator.connect(gain);
        oscillator.start();
        nodes.push(oscillator);
      }
      this.padNodes = { gain, nodes };
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }
}
