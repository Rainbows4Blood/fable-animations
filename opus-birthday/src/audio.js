// The soundtrack, synthesised from scratch: a music box playing "Happy Birthday
// to You", plus a handful of sound effects (light switch, breath, confetti).
// Pure JavaScript and deterministic — the same code feeds the MP4 (Node) and
// the live preview (Web Audio).

import { TAU, rng, clamp } from './util.js';
import { T, DURATION, NOTES, ACCOMP, REPRISE } from './timeline.js';

const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);

/**
 * @returns {{sampleRate: number, channels: [Float32Array, Float32Array]}}
 */
export function renderAudio({ sampleRate = 48000 } = {}) {
  const sr = sampleRate;
  const n = Math.ceil(DURATION * sr);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const sendL = new Float32Array(n); // what goes into the reverb
  const sendR = new Float32Array(n);
  const rand = rng(4242);
  const white = () => rand() * 2 - 1;

  const put = (i, s, gl, gr, rev) => {
    if (i < 0 || i >= n) return;
    L[i] += s * gl;
    R[i] += s * gr;
    sendL[i] += s * gl * rev;
    sendR[i] += s * gr * rev;
  };
  const panGains = (gain, pan) => [gain * Math.cos(((pan + 1) * Math.PI) / 4), gain * Math.sin(((pan + 1) * Math.PI) / 4)];

  // ------------------------------------------------------------ music box
  // One steel tine: a pure fundamental that rings, a touch of octave from the
  // soundboard, and the short inharmonic "ting" of a struck bar (~6.27x).
  function tine(t0, midi, gain, pan = 0, { decay = 1, bright = 1, rev = 0.45 } = {}) {
    const f = midiHz(midi);
    const tau1 = (0.36 + 0.5 * Math.min(1.7, 660 / f)) * decay;
    const i0 = Math.round(t0 * sr);
    const len = Math.min(n - i0, Math.ceil(tau1 * 7.5 * sr));
    const [gl, gr] = panGains(gain / 1.55, pan);
    const w = (TAU * f) / sr;
    const hasTing = 6.27 * f < sr * 0.42;
    const hasAir = 12.4 * f < sr * 0.42;
    const ph = rand() * TAU;
    for (let i = 0; i < len; i++) {
      const tt = i / sr;
      let s = Math.sin(w * i) * Math.exp(-tt / tau1);
      s += 0.22 * Math.sin(w * 1.0009 * i + ph) * Math.exp(-tt / (tau1 * 0.9)); // slow shimmer
      s += 0.2 * Math.sin(w * 2 * i) * Math.exp(-tt / (tau1 * 0.5));
      s += 0.07 * Math.sin(w * 3.01 * i) * Math.exp(-tt / (tau1 * 0.3));
      if (hasTing) s += 0.3 * bright * Math.sin(w * 6.27 * i + 0.6) * Math.exp(-tt / 0.085);
      if (hasAir) s += 0.08 * bright * Math.sin(w * 12.4 * i) * Math.exp(-tt / 0.028);
      if (tt < 0.012) s += 0.07 * white() * Math.exp(-tt / 0.002); // the pluck
      put(i0 + i, s * Math.min(1, tt / 0.0015), gl, gr, rev);
    }
  }

  // ------------------------------------------------------------- effects
  /** Noise through a swept band-pass filter. `env(u)` shapes loudness over u = 0..1. */
  function swish(t0, dur, gain, { from, to, q = 1.5, pan = 0, rev = 0.25, env }) {
    const i0 = Math.round(t0 * sr);
    const len = Math.ceil(dur * sr);
    const [gl, gr] = panGains(gain, pan);
    let low = 0;
    let band = 0;
    for (let i = 0; i < len; i++) {
      const u = i / len;
      const fc = from * (to / from) ** u;
      const f = 2 * Math.sin((Math.PI * Math.min(fc, sr / 6.5)) / sr);
      const high = white() - low - band / q;
      band += f * high;
      low += f * band;
      put(i0 + i, band * env(u), gl, gr, rev);
    }
  }

  /** A sine whose pitch glides from f0 to f1 — plops, bloops and thumps. */
  function glide(t0, dur, gain, f0, f1, { tau = dur / 3, curve = 1, pan = 0, rev = 0.2, attack = 0.003 } = {}) {
    const i0 = Math.round(t0 * sr);
    const len = Math.ceil(dur * sr);
    const [gl, gr] = panGains(gain, pan);
    let phase = 0;
    for (let i = 0; i < len; i++) {
      const tt = i / sr;
      const u = i / len;
      phase += (TAU * (f0 + (f1 - f0) * u ** curve)) / sr;
      const fadeOut = Math.min(1, (len - i) / (0.004 * sr));
      put(i0 + i, Math.sin(phase) * Math.exp(-tt / tau) * Math.min(1, tt / attack) * fadeOut, gl, gr, rev);
    }
  }

  function click(t0, gain, pan = 0) {
    const i0 = Math.round(t0 * sr);
    const [gl, gr] = panGains(gain, pan);
    for (let i = 0; i < 0.06 * sr; i++) {
      const tt = i / sr;
      const s =
        0.6 * Math.sin(TAU * 1900 * tt) * Math.exp(-tt / 0.004) +
        0.8 * Math.sin(TAU * 310 * tt) * Math.exp(-tt / 0.014) +
        0.5 * white() * Math.exp(-tt / 0.0012);
      put(i0 + i, s, gl, gr, 0.15);
    }
  }

  function confettiPop(t0, gain, pan) {
    swish(t0, 0.3, gain, { from: 5200, to: 420, q: 0.8, pan, rev: 0.35, env: (u) => Math.exp(-u * 6) * Math.min(1, u * 150) });
    glide(t0, 0.3, gain * 0.9, 150, 52, { tau: 0.09, curve: 0.5, pan, rev: 0.2 });
    // paper fluttering down
    swish(t0 + 0.03, 1.6, gain * 0.1, { from: 6500, to: 4200, q: 0.7, pan, rev: 0.3, env: (u) => Math.min(1, u * 25) * Math.exp(-u * 4.5) });
  }

  // --------------------------------------------------------------- score
  // hat lands
  glide(T.hatLand, 0.16, 0.5, 290, 120, { tau: 0.045, curve: 0.5 });
  tine(T.hatLand + 0.02, 100, 0.1, 0.2, { rev: 0.7 });
  // guests pop in
  glide(T.haikuIn, 0.12, 0.09, 620, 1250, { tau: 0.07, curve: 0.6, pan: -0.5 });
  glide(T.sonnetIn, 0.13, 0.09, 460, 930, { tau: 0.07, curve: 0.6, pan: 0.5 });

  // the verse
  for (const note of NOTES) tine(note.t, note.midi, 0.44, clamp((note.midi - 84) / 40, -0.2, 0.2));
  for (const note of ACCOMP) tine(note.t, note.midi, note.midi < 58 ? 0.26 : 0.19, -0.18, { decay: 1.15, bright: 0.6 });

  click(T.lightsOff, 0.3);
  // Haiku dashes off into the dark
  swish(T.lightsOff + 0.1, 0.5, 0.2, { from: 700, to: 3800, q: 2.2, pan: 0.5, env: (u) => Math.sin(u * Math.PI) ** 1.5 });
  // the cake arrives: three little chimes
  [100, 103, 108].forEach((m, i) => tine(T.cartStop + 0.02 + i * 0.07, m, 0.075, 0.3, { rev: 0.8 }));

  // the wish: scattered twinkles, then a soft "done"
  const twinkle = [96, 98, 100, 103, 105, 108];
  for (let i = 0; i < 11; i++) {
    const t0 = T.wish + 0.55 + (i / 11) * (T.wishDone - T.wish - 0.8) + rand() * 0.12;
    tine(t0, twinkle[Math.floor(rand() * twinkle.length)], 0.05 + rand() * 0.05, rand() * 1.4 - 0.7, { decay: 0.8, rev: 0.9 });
  }
  tine(T.wishDone, 88, 0.14, 0.1, { rev: 0.7 });
  tine(T.wishDone + 0.09, 91, 0.12, 0.1, { rev: 0.7 });

  // deep breath in... and blow
  swish(T.inhale, T.blow - T.inhale, 0.22, { from: 480, to: 2000, q: 2.4, env: (u) => u ** 1.6 * Math.min(1, (1 - u) * 18) });
  const blowLen = T.flameOut - T.blow + 0.14;
  swish(T.blow, blowLen, 1.0, { from: 1700, to: 560, q: 1.1, pan: 0.15, env: (u) => Math.min(1, u * 9) * (1 - u) ** 0.8 });
  swish(T.blow, blowLen, 0.5, { from: 320, to: 180, q: 0.8, pan: 0.15, env: (u) => Math.min(1, u * 9) * (1 - u) });

  // lights on!
  click(T.lightsOn - 0.015, 0.3);
  confettiPop(T.lightsOn + 0.03, 0.5, -0.6);
  confettiPop(T.lightsOn + 0.085, 0.46, 0.6);
  [72, 76, 79].forEach((m) => tine(T.lightsOn + 0.04, m, 0.2, -0.1, { decay: 1.2 }));
  [84, 86, 88, 91, 93, 96].forEach((m, i) => tine(T.lightsOn + 0.06 + i * 0.05, m, 0.2 + i * 0.02, -0.3 + i * 0.12, { rev: 0.6 }));

  // the party tag: last line once more, in harmony
  const harmony = [[81, 65], [81], [79, 72, 60], [79, 76], [83, 77, 55], [79, 76, 72, 60, 48]];
  REPRISE.forEach((note, i) => {
    tine(note.t, note.midi, 0.44, 0.08);
    for (const m of harmony[i]) tine(note.t, m, m < 66 ? 0.24 : 0.2, -0.15, { decay: 1.15, bright: 0.6 });
  });
  const last = REPRISE[REPRISE.length - 1].t;
  [76, 79, 84, 88, 91, 96].forEach((m, i) => tine(last + 0.09 + i * 0.075, m, 0.2, -0.25 + i * 0.1, { rev: 0.6 }));
  [96, 100, 103, 108].forEach((m, i) => tine(last + 1.05 + i * 0.035, m, 0.09, 0.2, { decay: 1.1, rev: 0.9 }));

  // -------------------------------------------------------------- reverb
  reverb(sendL, sendR, L, R, sr, { room: 0.62, damp: 0.32, wet: 0.5 });

  // ------------------------------------------------------------- master
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const norm = 0.84 / (peak || 1);
  const fade = 0.4 * sr;
  for (let i = 0; i < n; i++) {
    const g = norm * Math.min(1, (n - 1 - i) / fade);
    L[i] *= g;
    R[i] *= g;
  }
  return { sampleRate: sr, channels: [L, R] };
}

/** A compact Freeverb (8 damped combs + 4 all-passes per side); adds the wet signal to outL/outR. */
function reverb(inL, inR, outL, outR, sr, { room, damp, wet }) {
  const k = sr / 44100;
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const alls = [556, 441, 341, 225];
  const feedback = room * 0.28 + 0.7;
  const d1 = damp * 0.4;
  const d2 = 1 - d1;
  const n = inL.length;
  for (const [input, out, spread] of [[inL, outL, 0], [inR, outR, 23]]) {
    const cb = combs.map((c) => ({ buf: new Float32Array(Math.round((c + spread) * k)), i: 0, store: 0 }));
    const ab = alls.map((a) => ({ buf: new Float32Array(Math.round((a + spread) * k)), i: 0 }));
    for (let s = 0; s < n; s++) {
      const x = input[s] * 0.015;
      let y = 0;
      for (const c of cb) {
        const o = c.buf[c.i];
        c.store = o * d2 + c.store * d1;
        c.buf[c.i] = x + c.store * feedback;
        if (++c.i >= c.buf.length) c.i = 0;
        y += o;
      }
      for (const a of ab) {
        const o = a.buf[a.i];
        a.buf[a.i] = y + o * 0.5;
        if (++a.i >= a.buf.length) a.i = 0;
        y = o - y;
      }
      out[s] += y * wet * 6;
    }
  }
}
