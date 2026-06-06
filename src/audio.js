// ============================================================
// audio.js — Procedural Sound via Web Audio API
// ============================================================
//
// Zero-dependency procedural audio engine. No external sound files —
// all effects are synthesised at runtime using oscillators, noise
// buffers, and gain envelopes.
//
// Design notes:
//   • AudioContext is lazily initialised on first user interaction
//     (browser autoplay policy compliance).
//   • Every public method is fire-and-forget — if the context
//     can't be acquired the call silently returns.
//   • Short sounds (≤ 0.38 s) use node.start()/stop() scheduling
//     so garbage collection cleans them up automatically.

// ============================================================
// AudioManager — Web Audio procedural sound engine
// ============================================================
export class AudioManager {
  /**
   * Create the manager. The underlying AudioContext is NOT created
   * until the first call to `ensure()`, which typically happens on
   * user interaction.
   */
  constructor() {
    /** @type {AudioContext|null} */
    this.ctx = null;
  }

  // ========== LIFECYCLE ==========

  /**
   * Lazily create or resume the AudioContext.
   *
   * @returns {boolean} `true` if the context is ready for playback,
   *                    `false` if the browser blocked autoplay.
   */
  ensure() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        return false;
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  // ========== SOUND PRIMITIVE ==========

  /**
   * Play a shaped white-noise burst (used for roll and bounce).
   *
   * Creates a mono buffer filled with random samples, applies a
   * quadratic fade-out window, runs it through a highpass filter
   * (to remove low-end rumble), and feeds it to a GainNode with
   * an exponential decay envelope.
   *
   * @param {number} duration — length of the burst in seconds.
   * @param {number} volume   — peak gain (0–1).
   * @param {number} highpass — highpass cutoff frequency in Hz.
   */
  noise(duration, volume, highpass) {
    const sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, Math.ceil(sr * duration), sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = highpass;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    src.connect(hp);
    hp.connect(gain);
    gain.connect(this.ctx.destination);
    src.start();
  }

  // ========== GAME EVENT SOUNDS ==========

  /**
   * Dice-roll rattle — short white-noise hiss with moderate highpass.
   * Duration: ~250 ms.
   */
  playRoll() {
    if (!this.ensure()) return;
    this.noise(0.25, 0.07, 400);
  }

  /**
   * Single-die bounce click — very short high-pitched noise burst.
   * Duration: ~60 ms.
   */
  playBounce() {
    if (!this.ensure()) return;
    this.noise(0.06, 0.1, 800);
  }

  /**
   * Settle click — two quick sine-wave pings (600 → 240 Hz, 420 → 168 Hz)
   * that mimic dice coming to rest on felt.
   * Duration: ~70 ms per ping.
   */
  playSettle() {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    for (const freq of [600, 420]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.4, t + 0.05);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.05, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.07);
    }
  }

  /**
   * Win fanfare — ascending three-note triangle-wave arpeggio
   * (C5 → E5 → G5) with a short sustain and quick decay.
   * Duration: ~380 ms.
   */
  playWin() {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523, t); // C5
    osc.frequency.setValueAtTime(659, t + 0.08); // E5
    osc.frequency.setValueAtTime(784, t + 0.16); // G5
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.setValueAtTime(0.06, t + 0.22);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.38);
  }

  /**
   * Lose groan — descending sawtooth-wave sweep (350 → 120 Hz)
   * with a slow decay. Dark, gritty, and brief.
   * Duration: ~350 ms.
   */
  playLose() {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(350, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.3);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.04, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.35);
  }
}
