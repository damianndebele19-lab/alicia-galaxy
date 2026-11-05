// Cosmic music engine: a built-in dreamy synth (no files needed) or her own song,
// both feeding one analyser so the scene can react to the beat.

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// Am7 – Fmaj7 – Cmaj7 – G6  (bass root, chord tones)
const CHORDS = [
  { bass: 33, notes: [57, 60, 64, 67] },
  { bass: 29, notes: [53, 57, 60, 64] },
  { bass: 36, notes: [60, 64, 67, 71] },
  { bass: 31, notes: [55, 59, 62, 64] },
];
const ARP = [0, 2, 1, 3, 2, 1, 3, 2];

export class CosmicAudio {
  constructor(src = '') {
    this.playlist = Array.isArray(src) ? src.filter(Boolean) : src ? [src] : [];
    this.src = this.playlist[0] || src || '';
    this.trackIndex = 0;
    this.ctx = null;
    this.playing = false;
    this.mode = this.playlist.length ? 'file' : 'synth';
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.lastKick = -10;
    this.freq = new Uint8Array(32);
    this.onChange = null;
    this.fileName = this._trackName(this.src);
    this.url = '';
  }

  _trackName(src) {
    if (!src) return '';
    const name = decodeURIComponent(src.split('/').pop() || src);
    return name.replace(/\.[^.]+$/, '');
  }

  _ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 128;
    this.analyser.smoothingTimeConstant = 0.78;
    this.freq = new Uint8Array(this.analyser.frequencyBinCount);
    this.master.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    // a soft echo for that spacey tail
    this.echo = this.ctx.createDelay(1);
    this.echo.delayTime.value = 0.39;
    const fb = this.ctx.createGain(); fb.gain.value = 0.38;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    this.echo.connect(lp); lp.connect(fb); fb.connect(this.echo);
    const wet = this.ctx.createGain(); wet.gain.value = 0.5;
    lp.connect(wet); wet.connect(this.master);

    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  async play() {
    this._ensure();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    if (this.mode === 'file') {
      const activeUrl = new URL(this.src, window.location.href).toString();
      if (!this.el || this.el.src !== activeUrl) this._makeElement(this.src);
      try { await this.el.play(); } catch { /* autoplay blocked */ }
    } else {
      this.step = 0;
      this.nextTime = this.ctx.currentTime + 0.08;
      clearInterval(this.timer);
      this.timer = setInterval(() => this._schedule(), 30);
    }
    this.playing = true;
    this.onChange?.(true);
  }

  pause() {
    clearInterval(this.timer);
    this.timer = null;
    this.el?.pause();
    this.playing = false;
    this.onChange?.(false);
  }

  async nextTrack() {
    if (!this.playlist.length) return false;
    const wasPlaying = this.playing;
    this.trackIndex = (this.trackIndex + 1) % this.playlist.length;
    this.src = this.playlist[this.trackIndex];
    this.fileName = this._trackName(this.src);
    this.mode = 'file';
    this.pause();
    this._makeElement(this.src);
    if (wasPlaying) await this.play();
    return this.playing;
  }

  async toggle() { if (this.playing) this.pause(); else await this.play(); return this.playing; }

  // Play any local audio file she picks
  async loadFile(file) {
    this._ensure();
    this.pause();
    this.mode = 'file';
    this.fileName = file.name.replace(/\.[^.]+$/, '');
    this.playlist = [URL.createObjectURL(file)];
    this.src = this.playlist[0];
    this.trackIndex = 0;
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = this.src;
    this._makeElement(this.src);
    await this.play();
  }

  _makeElement(url) {
    if (this.el) { this.el.pause(); }
    if (this.srcNode) { try { this.srcNode.disconnect(); } catch { /* ignore */ } }
    this.el = new Audio(url);
    this.el.loop = false;
    this.el.crossOrigin = 'anonymous';
    this.el.addEventListener('ended', () => {
      if (this.mode === 'file' && this.playlist.length > 1) {
        this.nextTrack();
      }
    }, { once: true });
    this.srcNode = this.ctx.createMediaElementSource(this.el);
    this.srcNode.connect(this.master);
  }

  _schedule() {
    const spb = 60 / 76 / 2; // eighth note @ 76bpm
    while (this.nextTime < this.ctx.currentTime + 0.18) {
      this._step(this.step, this.nextTime);
      this.nextTime += spb;
      this.step++;
    }
  }

  _env(node, t, attack, peak, release) {
    node.gain.cancelScheduledValues(t);
    node.gain.setValueAtTime(0.0001, t);
    node.gain.linearRampToValueAtTime(peak, t + attack);
    node.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
  }

  _tone(type, f, t, attack, peak, release, dest, filterHz) {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f;
    const g = this.ctx.createGain();
    this._env(g, t, attack, peak, release);
    let out = g;
    o.connect(g);
    if (filterHz) {
      const bq = this.ctx.createBiquadFilter(); bq.type = 'lowpass'; bq.frequency.value = filterHz;
      g.connect(bq); out = bq;
    }
    out.connect(dest);
    o.start(t); o.stop(t + attack + release + 0.05);
  }

  _step(n, t) {
    const chord = CHORDS[Math.floor(n / 8) % CHORDS.length];
    const k = n % 8;
    if (k === 0) {
      chord.notes.forEach((m, i) => this._tone('triangle', midi(m) * (i % 2 ? 1.003 : 0.997), t, 0.45, 0.05, 3.1, this.master, 1100));
      this._tone('sine', midi(chord.bass), t, 0.02, 0.28, 2.6, this.master);
    }
    // soft kick on each beat so the visuals can pulse
    if (k % 2 === 0) {
      const o = this.ctx.createOscillator(); o.type = 'sine';
      const g = this.ctx.createGain();
      o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.22);
      this._env(g, t, 0.004, 0.55, 0.28);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.4);
      this.lastKickAt = t;
    }
    // airy hat on off-beats
    if (k % 2 === 1) {
      const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
      const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6500;
      const g = this.ctx.createGain(); this._env(g, t, 0.002, 0.045, 0.06);
      s.connect(hp); hp.connect(g); g.connect(this.master); s.start(t, Math.random() * 0.5, 0.12);
    }
    // gentle arpeggio, sent through the echo
    const note = chord.notes[ARP[k]] + 12;
    this._tone('sine', midi(note), t, 0.008, 0.075, 0.9, this.echo);
    this._tone('triangle', midi(note), t, 0.008, 0.03, 0.5, this.master, 2400);
  }

  // Current analysis for the visuals: bass 0..1, level 0..1, beat pulse 0..1 and raw bins
  levels() {
    if (!this.ctx || !this.analyser || !this.playing) {
      return { bass: 0, level: 0, beat: 0, bins: this.freq.fill(0) };
    }
    this.analyser.getByteFrequencyData(this.freq);
    const f = this.freq;
    let b = 0, all = 0;
    for (let i = 0; i < 4; i++) b += f[i];
    for (let i = 0; i < f.length; i++) all += f[i];
    const bass = b / 4 / 255, level = all / f.length / 255;
    let beat = bass * bass * 1.6;
    if (this.mode === 'synth' && this.lastKickAt !== undefined) {
      const dt = this.ctx.currentTime - this.lastKickAt;
      beat = Math.max(beat, dt >= 0 ? Math.exp(-dt * 7) : 0);
    }
    return { bass, level, beat: Math.min(1, beat), bins: f };
  }
}
