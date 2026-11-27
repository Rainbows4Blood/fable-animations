// Small math / easing / colour toolbox. Everything is pure and deterministic,
// so any frame can be rendered on its own, in any order.

export const TAU = Math.PI * 2;

export const clamp = (x, lo = 0, hi = 1) => (x < lo ? lo : x > hi ? hi : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => (a === b ? (x >= b ? 1 : 0) : clamp((x - a) / (b - a)));
export const remap = (x, a, b, c, d) => lerp(c, d, invLerp(a, b, x));
export const smoothstep = (a, b, x) => {
  const t = invLerp(a, b, x);
  return t * t * (3 - 2 * t);
};

export const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  inCubic: (t) => t ** 3,
  outCubic: (t) => 1 - (1 - t) ** 3,
  inOutCubic: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  outQuart: (t) => 1 - (1 - t) ** 4,
  outQuint: (t) => 1 - (1 - t) ** 5,
  inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  outSine: (t) => Math.sin((t * Math.PI) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  inBack: (t) => 2.70158 * t ** 3 - 1.70158 * t ** 2,
  outBack: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
  softBack: (t) => 1 + 1.9 * (t - 1) ** 3 + 0.9 * (t - 1) ** 2,
  outElastic: (t) =>
    t <= 0 ? 0 : t >= 1 ? 1 : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1,
  hold: () => 0,
};

/**
 * Keyframe track. `keys` is [[time, value, ease?], ...]; the ease named on a key
 * shapes the segment that arrives at it. Holds the first/last value outside the range.
 */
export function kf(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  const last = keys[keys.length - 1];
  if (t >= last[0]) return last[1];
  let i = 1;
  while (keys[i][0] < t) i++;
  const [t0, v0] = keys[i - 1];
  const [t1, v1, e = 'inOutCubic'] = keys[i];
  const u = (t - t0) / (t1 - t0);
  return v0 + (v1 - v0) * (typeof e === 'function' ? e(u) : ease[e](u));
}

/** 0 → 1 → 0 bump of the given duration, starting at t0 (sine-shaped). */
export function bump(t, t0, dur) {
  const u = (t - t0) / dur;
  return u <= 0 || u >= 1 ? 0 : Math.sin(u * Math.PI);
}

/** Envelope: rises over `a`, holds for `h`, falls over `r`. */
export function envelope(t, t0, a, h, r) {
  const u = t - t0;
  if (u <= 0) return 0;
  if (u < a) return ease.outCubic(u / a);
  if (u < a + h) return 1;
  if (u < a + h + r) return 1 - ease.inOutQuad((u - a - h) / r);
  return 0;
}

/** Scale-from-zero pop with a little overshoot. */
export function pop(t, t0, dur = 0.35) {
  const u = (t - t0) / dur;
  return u <= 0 ? 0 : u >= 1 ? 1 : ease.outBack(u);
}

/** Damped spring that settles on 1 (starts at 0). */
export function spring(t, t0, freq = 3, damp = 7) {
  const u = t - t0;
  return u <= 0 ? 0 : 1 - Math.exp(-damp * u) * Math.cos(TAU * freq * u);
}

/** Damped wobble around 0, kicked at t0 (starts at 0, swings to ±1, decays). */
export function wobble(t, t0, freq = 3, damp = 5) {
  const u = t - t0;
  return u <= 0 ? 0 : Math.exp(-damp * u) * Math.sin(TAU * freq * u);
}

/** Parabolic hop: 0 at both ends, `h` at the apex. */
export function hop(t, t0, dur, h = 1) {
  const u = (t - t0) / dur;
  return u <= 0 || u >= 1 ? 0 : 4 * h * u * (1 - u);
}

// ---------------------------------------------------------------- randomness

/** Seeded PRNG (mulberry32) → function returning floats in [0, 1). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(n) {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** Smooth 1D value noise in [-1, 1]. */
export function noise(x, seed = 0) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const k = seed * 7919;
  return lerp(hash(i + k), hash(i + 1 + k), u) * 2 - 1;
}

// -------------------------------------------------------------------- colour

export function toRgb(c) {
  if (Array.isArray(c)) return c;
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** CSS colour string from a hex string or [r, g, b] triple, with optional alpha. */
export function css(c, a = 1) {
  const [r, g, b] = toRgb(c);
  const R = Math.round(clamp(r, 0, 255));
  const G = Math.round(clamp(g, 0, 255));
  const B = Math.round(clamp(b, 0, 255));
  return a >= 1 ? `rgb(${R},${G},${B})` : `rgba(${R},${G},${B},${Math.max(0, a).toFixed(4)})`;
}

/** Mix two colours → [r, g, b]. */
export function mix(c1, c2, t) {
  const a = toRgb(c1);
  const b = toRgb(c2);
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

export const lighten = (c, amt) => mix(c, '#ffffff', amt);
export const darken = (c, amt) => mix(c, '#000000', amt);
