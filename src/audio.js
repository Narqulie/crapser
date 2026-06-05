export class AudioManager {
  constructor() {
    this.ctx = null;
  }

  ensure() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch { return false; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

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

  playRoll() { if (!this.ensure()) return; this.noise(0.25, 0.07, 400); }
  playBounce() { if (!this.ensure()) return; this.noise(0.06, 0.1, 800); }

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

  playWin() {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523, t);
    osc.frequency.setValueAtTime(659, t + 0.08);
    osc.frequency.setValueAtTime(784, t + 0.16);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.setValueAtTime(0.06, t + 0.22);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.38);
  }

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
