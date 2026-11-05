// Sound for Kielipukki: Finnish speech through the browser's text-to-speech,
// and short sound effects generated with the Web Audio API (no audio files).
//
//   const sound = new KielipukkiSound();
//   const goat = await createKielipukki(stage, { sound });
//
// Browsers only play sound after the viewer has clicked or tapped the page,
// so the first sound must come from a click handler.

export class KielipukkiSound {
  constructor({ effects = true, speech = true, volume = 0.6, lang = 'fi-FI', rate = 0.9 } = {}) {
    this.effects = effects;   // play sound effects
    this.speech = speech;     // read say() text aloud
    this.volume = volume;
    this.lang = lang;
    this.rate = rate;
    this.voice = null;        // a SpeechSynthesisVoice; null picks the first one for lang
    this._ctx = null;
    this._voices = [];
    const synth = globalThis.speechSynthesis;
    if (synth) {
      const load = () => { this._voices = synth.getVoices(); this.onvoiceschanged?.(this.voices()); };
      load();
      synth.addEventListener?.('voiceschanged', load);
    }
  }

  /** Voices installed for this language (Finnish by default). */
  voices() {
    const base = this.lang.slice(0, 2).toLowerCase();
    return this._voices.filter(v => v.lang.toLowerCase().replace('_', '-').startsWith(base));
  }

  get canSpeak() {
    return !!globalThis.speechSynthesis && this.voices().length > 0;
  }

  /**
   * Speak text. Returns an object with `done` (a Promise that resolves when
   * speech ends) and `onboundary` (set it to get word positions as they are
   * spoken), or null when speech is off or no voice is installed.
   */
  speak(text) {
    if (!this.speech || !this.canSpeak) return null;
    const synth = globalThis.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = this.lang;
    u.voice = this.voice || this.voices().find(v => v.localService) || this.voices()[0];
    u.rate = this.rate;
    u.volume = Math.min(1, this.volume * 1.6);
    const handle = { onboundary: null, started: false };
    handle.done = new Promise(resolve => {
      u.onend = resolve;
      u.onerror = resolve;
      // If the browser never starts speaking, do not wait forever.
      setTimeout(() => { if (!handle.started) resolve(); }, 2500);
    });
    u.onstart = () => { handle.started = true; };
    u.onboundary = e => handle.onboundary?.(e.charIndex);
    synth.speak(u);
    return handle;
  }

  stopSpeaking() {
    globalThis.speechSynthesis?.cancel();
  }

  /** Play a sound effect: pop, whoosh, grab, drop, boing, ding, chomp, munch, gulp. strength 0-1 scales it. */
  play(name, strength = 1) {
    if (!this.effects || this.volume <= 0) return;
    const ctx = this._audio();
    if (!ctx) return;
    const fx = EFFECTS[name];
    if (fx) fx(ctx, ctx.currentTime, this.volume * Math.max(0, Math.min(1, strength)));
  }

  _audio() {
    if (!this._ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return null;
      this._ctx = new AC();
    }
    if (this._ctx.state === 'suspended') this._ctx.resume();
    return this._ctx;
  }
}

// --- effects -------------------------------------------------------------

function env(ctx, t, peak, attack, release) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
  g.connect(ctx.destination);
  return g;
}

function tone(ctx, t, { type = 'sine', from, to, dur, peak, attack = 0.005 }) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(from, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  o.connect(env(ctx, t, peak, attack, dur));
  o.start(t);
  o.stop(t + attack + dur + 0.05);
}

let noiseBuffer = null;
function noise(ctx, t, { dur, peak, filter = 'bandpass', from, to, q = 1, attack = 0.02 }) {
  if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  src.connect(f);
  f.connect(env(ctx, t, peak, attack, dur));
  src.start(t);
  src.stop(t + attack + dur + 0.05);
}

const EFFECTS = {
  // Speech bubble appears.
  pop: (ctx, t, v) => tone(ctx, t, { from: 420, to: 900, dur: 0.08, peak: 0.35 * v }),
  // A hand moves.
  whoosh: (ctx, t, v) => noise(ctx, t, { from: 500, to: 1800, dur: 0.22, peak: 0.22 * v, q: 0.8, attack: 0.06 }),
  // A hand grips a prop.
  grab: (ctx, t, v) => {
    tone(ctx, t, { type: 'triangle', from: 260, to: 150, dur: 0.07, peak: 0.4 * v });
    noise(ctx, t, { from: 2500, dur: 0.04, peak: 0.12 * v, filter: 'highpass', attack: 0.003 });
  },
  // A prop is set down.
  drop: (ctx, t, v) => {
    tone(ctx, t, { type: 'sine', from: 150, to: 70, dur: 0.14, peak: 0.55 * v });
    noise(ctx, t, { from: 900, dur: 0.06, peak: 0.12 * v, filter: 'lowpass', attack: 0.003 });
  },
  // A hop.
  boing: (ctx, t, v) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(520, t + 0.12);
    o.frequency.exponentialRampToValueAtTime(300, t + 0.35);
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.frequency.value = 18;
    depth.gain.value = 25;
    lfo.connect(depth);
    depth.connect(o.frequency);
    o.connect(env(ctx, t, 0.3 * v, 0.01, 0.4));
    o.start(t); lfo.start(t);
    o.stop(t + 0.5); lfo.stop(t + 0.5);
  },
  // A bite: a sharp crunch with a low thump of the jaw.
  chomp: (ctx, t, v) => {
    noise(ctx, t, { from: 2400, to: 900, dur: 0.1, peak: 0.5 * v, q: 1.2, attack: 0.002 });
    noise(ctx, t + 0.03, { from: 3500, dur: 0.05, peak: 0.25 * v, filter: 'highpass', attack: 0.002 });
    tone(ctx, t, { type: 'triangle', from: 150, to: 70, dur: 0.09, peak: 0.4 * v, attack: 0.002 });
  },
  // Chewing: soft, wet and low.
  munch: (ctx, t, v) => {
    noise(ctx, t, { from: 800, to: 380, dur: 0.12, peak: 0.32 * v, q: 2, attack: 0.012 });
    noise(ctx, t + 0.05, { from: 2800, dur: 0.03, peak: 0.07 * v, filter: 'highpass', attack: 0.003 });
  },
  // Swallowing: two quick falling blips.
  gulp: (ctx, t, v) => {
    tone(ctx, t, { from: 440, to: 150, dur: 0.13, peak: 0.45 * v, attack: 0.004 });
    tone(ctx, t + 0.11, { from: 300, to: 110, dur: 0.12, peak: 0.3 * v, attack: 0.004 });
  },
  // Praise (thumbs up).
  ding: (ctx, t, v) => {
    tone(ctx, t, { type: 'triangle', from: 880, dur: 0.5, peak: 0.25 * v });
    tone(ctx, t + 0.09, { type: 'triangle', from: 1320, dur: 0.6, peak: 0.2 * v });
  },
};
