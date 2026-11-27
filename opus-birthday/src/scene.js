// The film itself: who does what, when — and the order things are painted in.
//
//   0.0  the party room; the birthday model gets its hat, guests pop in, the song starts
//   3.7  lights off; Haiku zips away and wheels the cake in by candlelight
//   7.0  "...dear Opus..." — the camera leans in
//  13.4  eyes shut: making a wish
//  16.3  deep breath, blow, darkness (and three pairs of eyes)
//  18.5  lights on: confetti, balloons, title
//
// draw(ctx, t) is a pure function of time.

import { TAU, clamp, lerp, invLerp, smoothstep, ease, kf, bump, envelope, hop, wobble, noise, rng, css, mix } from './util.js';
import { W, H, C, FLOOR_Y } from './theme.js';
import { T, BEAT, BAR1, DURATION, LINES, NOTES, REPRISE, REPRISE_BEAT, barPos, currentNote } from './timeline.js';
import { makeSpark, drawSpark, drawSparkEyes, traceSparkSilhouette, mouthWorld, hatTipWorld } from './character.js';
import { drawWallAndFloor, drawBunting, drawGifts, drawTetheredBalloons, buntingShake } from './room.js';
import { TABLE_Y, drawCart, wickWorld, drawFlame, drawEmber, drawSmoke, drawBreath } from './cake.js';
import {
  makeConfetti, drawConfetti, makeForegroundConfetti, drawForegroundConfetti,
  makeNotes, drawNotes, drawSparkles, sparkleBurst, makeLooseBalloons, drawLooseBalloons,
} from './particles.js';
import { drawIntroTitle, drawGuestLabels, drawKaraoke, drawWishPill, drawEndTitle } from './ui.js';
import { createLighting } from './lighting.js';

// ------------------------------------------------------------------- cast

const OPUS_R = 148;
const OPUS_X = 806; // where the birthday model stands once the cake is in
const SONNET = { x: 1556, y: 700, r: 108 };
const HAIKU_R = 80;
const HAIKU_START = { x: 440, y: 762 };
const HAIKU_HOME = { x: 1404, y: 780 };
const CART_X = 1160; // where the cake parks
const PUSH_DX = 268; // Haiku pushes the cart from this far right of its centre
const PUSH_Y = 806;
const ZIP = [T.lightsOff + 0.08, T.lightsOff + 0.62]; // Haiku dashes off to fetch the cake

const CAST = {
  opus: makeSpark({
    rays: 12, seed: 46, body: C.clay, eye: '#2E1A14', mouth: '#4A1D14', blush: '#C4453A',
    hat: { color: C.sky, stripe: '#FFF8EA', pom: C.gold, tilt: 0.2 },
  }),
  sonnet: makeSpark({
    rays: 10, seed: 7, body: C.sky, eye: '#1B2A3D', mouth: '#1E3350', blush: '#E07C93',
    hat: { color: C.fig, stripe: '#FFF8EA', pom: C.gold, tilt: -0.18 },
  }),
  haiku: makeSpark({
    rays: 8, seed: 21, body: C.leaf, eye: '#243018', mouth: '#2C3D1C', blush: '#E28A7A',
    hat: { color: C.gold, stripe: C.clay, pom: C.clay, tilt: 0.22 },
  }),
};

// [start, duration, height] of every hop
const OPUS_JUMPS = [
  [0.74, 0.34, 26], [T.cartStop + 0.08, 0.3, 30], [T.cartStop + 0.42, 0.28, 20],
  [T.lightsOn + 0.06, 0.52, 100], [T.lightsOn + 0.62, 0.36, 40],
  [19.4, 0.34, 34], [19.8, 0.34, 30], [20.2, 0.34, 34], [20.6, 0.44, 58], [21.3, 0.32, 18],
];
const SONNET_JUMPS = [
  [T.sonnetIn + 0.42, 0.3, 14], [T.cartStop + 0.25, 0.28, 16],
  [T.lightsOn + 0.13, 0.48, 72], [19.3, 0.34, 30], [19.8, 0.34, 26], [20.4, 0.36, 34], [21.0, 0.34, 20],
];
const HAIKU_JUMPS = [
  [T.haikuIn + 0.42, 0.28, 16], [T.cartStop + 0.04, 0.34, 34],
  [T.lightsOn + 0.19, 0.44, 86], [19.15, 0.3, 40], [19.55, 0.3, 36], [19.95, 0.3, 40], [20.35, 0.3, 36],
  [20.75, 0.34, 46], [21.3, 0.3, 20],
];

function jumps(t, list) {
  let dy = 0;
  let sy = 1;
  for (const [t0, dur, h] of list) {
    dy -= hop(t, t0, dur, h);
    const k = Math.min(1.2, h / 80);
    sy -= 0.07 * k * bump(t, t0 - 0.1, 0.11); // crouch
    sy += 0.1 * k * bump(t, t0 - 0.01, dur * 0.45); // stretch on the way up
    sy -= 0.15 * k * bump(t, t0 + dur - 0.03, 0.17); // squash on landing
  }
  return { dy, sy };
}

/** 1 for a moment at each of the given times — a blink. */
function blinkAt(t, times) {
  for (const tb of times) if (bump(t, tb, 0.13) > 0.25) return 1;
  return 0;
}

// ------------------------------------------------------------ music helpers

const SUNG = [...NOTES, ...REPRISE];
const VERSE_END = LINES[LINES.length - 1].end;

/** 0..1 while the verse is being sung. */
const songAmt = (t) => smoothstep(T.song, T.song + 0.6, t) * (1 - smoothstep(VERSE_END - 0.5, VERSE_END + 0.1, t));

/** How wide a singer's mouth is right now. */
function singAmount(t) {
  const n = currentNote(t, SUNG);
  if (!n) return 0;
  const hold = Math.max(0.09, n.dur * 0.78);
  return envelope(t, n.t, 0.05, hold - 0.05, 0.1);
}

/** A kick on every beat of the verse (strongest on the downbeat) and of the reprise. */
function beatPulse(t) {
  if (t >= BAR1 - 0.01 && t < VERSE_END) {
    const b = (t - BAR1) / BEAT;
    const ph = b - Math.floor(b);
    return (1 - ph) ** 3 * (Math.floor(b) % 3 === 0 ? 1 : 0.4);
  }
  if (t >= T.reprise + REPRISE_BEAT && t < T.reprise + REPRISE_BEAT * 6) {
    const b = (t - T.reprise) / REPRISE_BEAT;
    return (1 - (b - Math.floor(b))) ** 3;
  }
  return 0;
}

// ------------------------------------------------------------------- stage

function camera(t) {
  const on = T.lightsOn;
  const x = kf(t, [[0, 960], [3.6, 960, 'inOutSine'], [6.6, 1080], [9.7, 1010], [13.2, 1160, 'inOutSine'], [16.2, 1070], [on, 1072, 'linear'], [on + 0.85, 960, 'softBack'], [DURATION, 960, 'inOutSine']]);
  const y = kf(t, [[0, 540], [3.6, 546, 'inOutSine'], [6.6, 610], [9.7, 662], [13.2, 660, 'inOutSine'], [16.2, 650], [on, 650, 'linear'], [on + 0.85, 540, 'softBack'], [DURATION, 536, 'inOutSine']]);
  const lz = kf(t, [[0, 0], [3.6, Math.log(1.04), 'inOutSine'], [6.6, Math.log(1.14)], [9.7, Math.log(1.6)], [13.2, Math.log(1.38), 'inOutSine'], [16.2, Math.log(1.52)], [on, Math.log(1.56), 'linear'], [on + 0.85, 0, 'softBack'], [DURATION, Math.log(1.035), 'inOutSine']]);
  // a jolt when the confetti goes off
  const k = t > on ? Math.exp(-(t - on) * 5) * 9 : 0;
  return { x: x + k * noise(t * 31, 11), y: y + k * noise(t * 29, 12), z: Math.exp(lz) };
}

const cartX = (t) => kf(t, [[T.cartIn, 2300], [T.cartStop, CART_X, 'outSine']]);

function cartState(t) {
  const x = cartX(t);
  const v = (cartX(t + 1 / 240) - cartX(t - 1 / 240)) * 120;
  const tilt = 0.032 * wobble(t, T.cartStop - 0.14, 2.4, 4.2) + 0.007 * noise(t * 15, 21) * clamp(Math.abs(v) / 700);
  return { x, v, tilt, visible: t >= T.cartIn, wheel: (x - CART_X) / 21 };
}

function flameState(t, cart) {
  const b = invLerp(T.blow + 0.04, T.flameOut, t); // 0..1 while being blown out
  const sputter = b > 0 && b < 1 ? 0.13 * noise(t * 24, 9) * b * (1 - b) * 2 : 0;
  return {
    size: clamp(1 - 0.95 * b ** 1.4 + sputter, 0, 1.2) * (1 - 0.14 * clamp(Math.abs(cart.v) / 1400)),
    lean: clamp(-cart.v / 2600, -0.8, 0.8) + 1.35 * ease.outCubic(b),
    stretch: 1 + 0.45 * b,
    alpha: cart.visible && t < T.flameOut ? 1 : 0,
  };
}

// ----------------------------------------------------------------- acting

function opusPose(t) {
  const sway = Math.sin(Math.PI * barPos(t)) * songAmt(t);
  const fin = t - T.lightsOn;
  const inh = kf(t, [[T.inhale, 0], [T.blow, 1, 'outCubic'], [T.blow + 0.14, 0, 'outCubic']]);
  const bl = kf(t, [[T.blow, 0], [T.blow + 0.1, 1, 'outCubic'], [T.flameOut, 1], [T.flameOut + 0.4, 0, 'inOutCubic']]);
  const wish = smoothstep(T.wish, T.wish + 0.4, t) * (1 - smoothstep(T.wishDone + 0.1, T.wishDone + 0.3, t));

  let x = kf(t, [[4.2, 960], [5.7, OPUS_X], [T.inhale, OPUS_X], [T.blow, OPUS_X - 26, 'outCubic'], [T.blow + 0.16, OPUS_X + 56, 'outQuart'], [T.flameOut + 0.55, OPUS_X]]);
  let y = kf(t, [[4.2, 690], [5.7, 684], [T.inhale, 684], [T.blow, 642, 'outCubic'], [T.blow + 0.16, 664, 'outQuart'], [T.flameOut + 0.55, 684]]);
  x += 10 * sway;
  y += 6 * Math.sin(TAU * 0.5 * t + 1) * (1 - 0.6 * wish);
  const j = jumps(t, OPUS_JUMPS);
  y += j.dy;

  const sy = j.sy - 0.2 * bump(t, T.hatLand, 0.16) + 0.07 * bump(t, T.hatLand + 0.14, 0.22) - 0.08 * bl + 0.05 * inh;
  const sx = 1 + (1 - sy) * 0.8 + 0.06 * bl;
  let rot = 0.06 * sway - 0.12 * inh + 0.17 * bl;
  if (fin > 0) rot += 0.08 * Math.sin(TAU * 1.25 * fin) * clamp(1 - fin / 3.4);

  const lx = kf(t, [
    [0.25, 0], [0.4, 0.12], [0.85, 0.12], [0.98, -0.75], [1.2, -0.75, 'hold'], [1.32, 0.75], [1.75, 0.75, 'hold'], [2.0, 0],
    [3.6, 0], [3.85, 0.85], [9.9, 0.9, 'linear'], [10.3, 0], [11.1, 0, 'hold'], [11.5, 0.9], [T.wish, 0.9, 'hold'],
    [T.wish + 0.3, 0.35], [T.wishDone + 0.1, 0.35, 'hold'], [T.inhale, 1], [17.72, 1, 'hold'], [17.88, 0], [18.18, 0, 'hold'], [18.32, 0.8],
    [T.lightsOn, 0.8, 'hold'], [T.lightsOn + 0.15, 0], [21.9, 0, 'hold'], [22.2, 0.55], [22.6, 0.55, 'hold'], [22.85, 0],
  ]);
  const ly = kf(t, [
    [0.25, 0], [0.38, -0.95], [T.hatLand, -0.95, 'hold'], [0.9, -0.3], [1.1, 0], [3.85, 0], [5.6, 0.22], [9.9, 0.2, 'linear'], [10.3, 0], [11.1, 0, 'hold'], [11.5, 0.2],
    [T.wish, 0.18, 'linear'], [T.wish + 0.35, -0.3], [T.wishDone + 0.1, -0.3, 'hold'], [T.inhale, 0.1], [T.blow, -0.35], [T.blow + 0.12, 0.05], [T.lightsOn, 0, 'linear'],
  ]);

  let eyes = 'open';
  let mouth = 'smile';
  let mouthOpen = 0;
  if (t >= 0.26 && t < T.hatLand) { eyes = 'wide'; mouth = 'o'; }
  else if (t >= T.hatLand && t < 0.96) { eyes = 'happy'; mouth = 'grin'; }
  else if (t >= T.lightsOff && t < 4.7) { eyes = 'wide'; mouth = 'o'; }
  else if (t >= 4.7 && t < T.cartStop) { eyes = 'wide'; mouth = 'sing'; mouthOpen = 0.85; }
  else if (t >= T.cartStop && t < 7.05) { eyes = 'happy'; mouth = 'grin'; }
  else if (t >= 8.95 && t < 10.15) { eyes = 'happy'; }
  else if (t >= T.wish && t < T.wishDone + 0.2) { eyes = 'serene'; mouth = 'tiny'; }
  else if (t >= T.wishDone + 0.2 && t < T.blow) { mouth = 'tiny'; }
  else if (t >= T.blow && t < T.flameOut + 0.12) { eyes = 'squeeze'; mouth = 'o'; }
  else if (t >= T.lightsOn && t < 21.7) { eyes = 'happy'; mouth = 'grin'; }

  const wink = bump(t, 23.0, 0.42) > 0.2 ? 1 : 0;
  if (wink) mouth = 'grin';

  const hat = t >= T.hatDrop;
  let hatDy = 0;
  let hatRot = 0;
  if (t < T.hatLand) {
    const u = invLerp(T.hatDrop, T.hatLand, t);
    hatDy = -6.4 * (1 - ease.inQuad(u));
    hatRot = -0.5 * (1 - u);
  } else {
    hatDy = -0.1 * Math.abs(wobble(t, T.hatLand, 2.8, 7));
    hatRot = 0.2 * wobble(t, T.hatLand, 2.6, 5);
  }
  for (const [t0, dur, h] of OPUS_JUMPS) if (h > 30) hatDy -= (h / 100) * 0.2 * bump(t, t0 + dur * 0.35, dur * 0.9);
  hatRot += -0.14 * bl + 0.05 * sway;

  return {
    x, y, r: OPUS_R * (1 + 0.13 * inh), rot, sx, sy,
    look: [lx, ly], eyes, blink: blinkAt(t, [2.25, 3.05, 7.7, 11.0, 12.5, 17.5, 18.08, 22.1]), wink, mouth, mouthOpen,
    blush: kf(t, [[8.8, 0], [9.2, 1], [10.3, 1], [11.2, 0.2], [T.lightsOn, 0.2, 'hold'], [T.lightsOn + 0.3, 0.7]]),
    puff: inh,
    excite: kf(t, [[T.cartStop - 0.1, 0.15], [T.cartStop + 0.1, 1], [7.0, 1], [7.6, 0.15], [T.wish, 0.15], [T.wish + 0.4, 0], [T.inhale, 0.1], [T.lightsOn, 0.2, 'hold'], [T.lightsOn + 0.1, 1], [21.2, 1], [22.4, 0.25]]),
    rayScale: 1 - 0.13 * inh + 0.14 * bl - 0.05 * wish,
    pulse: beatPulse(t) * 0.8,
    hat, hatDy, hatRot,
  };
}

function sonnetPose(t, cart) {
  const sway = Math.sin(Math.PI * barPos(t)) * songAmt(t);
  const u = clamp((t - T.sonnetIn) / 0.45);
  const fin = t - T.lightsOn;
  const flinch = bump(t, T.blow + 0.17, 0.5); // the breath reaches the guests too
  const j = jumps(t, SONNET_JUMPS);

  const x = SONNET.x + 9 * sway + 13 * flinch;
  const y = SONNET.y + 46 * (1 - ease.outCubic(u)) + 5 * Math.sin(TAU * 0.62 * t + 2) + j.dy;
  let rot = 0.085 * sway + 0.12 * flinch;
  if (fin > 0) rot += 0.09 * Math.sin(TAU * 1.4 * fin + 1) * clamp(1 - fin / 3.4);

  // eyes: follow Haiku's dash, then the cake rolling past, then settle on the birthday model
  const follow = clamp((cart.x - SONNET.x) / 300, -1, 1) * 0.95;
  let lx = kf(t, [
    [T.lightsOff, -0.7], [ZIP[0] + 0.3, -0.7, 'hold'], [ZIP[1] - 0.08, 0.95, 'inOutSine'], [T.wish - 0.01, 0.95, 'hold'], [T.wish, -0.85, 'hold'],
    [T.wish + 0.3, -0.95], [17.45, -0.95, 'hold'], [17.6, 0], [18.05, 0, 'hold'], [18.2, -0.6], [T.lightsOn, -0.6, 'hold'], [T.lightsOn + 0.2, -0.3], [21.6, -0.3, 'hold'], [22, 0],
  ]);
  if (t >= T.cartIn + 0.3 && t < T.wish) lx = lerp(0.95, t < T.cartStop ? follow : -0.85, smoothstep(T.cartIn + 0.3, T.cartIn + 0.6, t));
  const ly = kf(t, [[T.cartIn, 0], [T.cartStop, 0.1], [T.lightsOn, 0.05, 'hold'], [T.lightsOn + 0.2, 0]]);

  let eyes = 'open';
  let mouth = 'sing';
  let mouthOpen = singAmount(t);
  if (t < T.song) mouth = 'smile';
  if (flinch > 0.15) eyes = 'squeeze';
  if (t >= T.flameOut && t < T.lightsOn) mouth = 'tiny';
  if (t >= T.lightsOn && t < 21.7) { eyes = 'happy'; mouth = 'grin'; }
  if (t >= 21.7) { mouth = 'smile'; mouthOpen = 0; }

  return {
    x, y, r: SONNET.r, scale: u <= 0 ? 0 : ease.outBack(u), rot, sx: 1 + (1 - j.sy) * 0.8, sy: j.sy,
    look: [lx, ly], eyes, blink: blinkAt(t, [2.6, 5.9, 8.3, 11.6, 14.6, 17.85, 18.36, 22.6]), mouth, mouthOpen,
    blush: fin > 0 ? 0.5 : 0.1,
    excite: kf(t, [[T.lightsOn, 0.2], [T.lightsOn + 0.1, 1], [21.2, 1], [22.4, 0.25]]),
    pulse: beatPulse(t),
    hatRot: 0.06 * sway - 0.16 * flinch,
    hatDy: -0.12 * bump(t, T.lightsOn + 0.28, 0.45),
  };
}

function haikuPose(t, cart) {
  const song = songAmt(t);
  const u = clamp((t - T.haikuIn) / 0.45);
  const fin = t - T.lightsOn;
  const flinch = bump(t, T.blow + 0.1, 0.5);
  const j = jumps(t, HAIKU_JUMPS);
  const bob = 4 * Math.sin(TAU * 0.85 * t + 4);

  let x;
  let y;
  let rot;
  let sx = 1 + (1 - j.sy) * 0.8;
  let sy = j.sy;
  if (t < ZIP[1]) {
    // at the left of the room... until the lights go out: crouch, then dash off to the right
    const z = ease.inCubic(invLerp(ZIP[0], ZIP[1], t));
    const sway = Math.sin(Math.PI * barPos(t) + 0.6) * song;
    x = lerp(HAIKU_START.x, 2600, z) - 9 * sway;
    y = lerp(HAIKU_START.y, PUSH_Y, z) + 46 * (1 - ease.outCubic(u)) + bob * (1 - z);
    rot = -0.085 * sway + 0.4 * Math.sin(Math.min(1, z * 3) * Math.PI * 0.5);
    const stretch = bump(t, ZIP[0] + 0.1, ZIP[1] - ZIP[0]);
    sy -= 0.16 * bump(t, ZIP[0] - 0.1, 0.16) + 0.14 * stretch;
    sx += 0.3 * stretch;
  } else if (t < T.cartStop) {
    // ...and back, leaning into the cake trolley
    x = cart.x + PUSH_DX;
    y = PUSH_Y + 3 * Math.sin(t * 19);
    rot = -0.22;
  } else {
    // parked: pop up next to the cake
    const k = clamp((t - T.cartStop) / 0.5);
    const sway = Math.sin(Math.PI * barPos(t) + 0.6) * song;
    x = lerp(cart.x + PUSH_DX, HAIKU_HOME.x, ease.outBack(k)) - 8 * sway + 11 * flinch;
    y = lerp(PUSH_Y, HAIKU_HOME.y, ease.outCubic(k)) + bob * k;
    rot = lerp(-0.22, 0, ease.outCubic(k)) - 0.09 * sway + 0.14 * flinch;
  }
  y += j.dy;
  if (fin > 0) rot += 0.1 * Math.sin(TAU * 1.5 * fin + 2.5) * clamp(1 - fin / 3.4);

  const lx = kf(t, [
    [T.lightsOff, 0.7], [ZIP[0], 1], [ZIP[1], 1, 'hold'], [ZIP[1] + 0.01, -0.9], [17.4, -0.95, 'hold'], [17.55, 0], [17.95, 0, 'hold'], [18.1, 0.7],
    [T.lightsOn, 0.7, 'hold'], [T.lightsOn + 0.2, -0.4], [21.6, -0.4, 'hold'], [22, 0],
  ]);
  const ly = kf(t, [[ZIP[1], -0.05], [T.cartStop + 0.4, -0.2], [T.lightsOn, -0.2, 'hold'], [T.lightsOn + 0.2, 0]]);

  let eyes = 'open';
  let mouth = 'sing';
  let mouthOpen = singAmount(t);
  if (t < T.song) mouth = 'smile';
  if (t >= T.cartStop && t < T.cartStop + 0.7) eyes = 'happy';
  if (flinch > 0.15) eyes = 'squeeze';
  if (t >= T.flameOut && t < T.lightsOn) mouth = 'tiny';
  if (t >= T.lightsOn && t < 21.7) { eyes = 'happy'; mouth = 'grin'; }
  if (t >= 21.7) { mouth = 'smile'; mouthOpen = 0; }

  return {
    x, y, r: HAIKU_R, scale: u <= 0 ? 0 : ease.outBack(u), rot, sx, sy,
    look: [lx, ly], eyes, blink: blinkAt(t, [2.0, 3.3, 7.4, 9.6, 12.2, 14.1, 15.4, 17.68, 17.9, 18.3, 22.3]), mouth, mouthOpen,
    blush: fin > 0 ? 0.5 : 0.1,
    excite: kf(t, [[T.lightsOn, 0.2], [T.lightsOn + 0.1, 1], [21.2, 1], [22.4, 0.25]]),
    pulse: beatPulse(t),
    hatRot: -0.2 * bump(t, ZIP[0], 0.5) - 0.16 * flinch,
    hatDy: -0.12 * bump(t, T.lightsOn + 0.34, 0.45),
  };
}

// ------------------------------------------------------------------ scene

function softEllipse(ctx, x, y, rx, ry, colour, alpha) {
  if (alpha <= 0.003 || rx <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, css(colour, alpha));
  g.addColorStop(0.6, css(colour, alpha * 0.55));
  g.addColorStop(1, css(colour, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/**
 * Fill the path produced by trace() as a soft blurred shape. The shape itself
 * is drawn far off-canvas; only its (offset) shadow lands in view.
 * `ds` = device pixels per unit of the current transform (blur is in device px).
 */
function softFill(ctx, ds, blur, colour, trace) {
  const OFF = 8000;
  ctx.save();
  ctx.shadowColor = colour;
  ctx.shadowBlur = blur * ds;
  ctx.shadowOffsetX = OFF;
  ctx.shadowOffsetY = 0;
  ctx.translate(-OFF / ds, 0);
  ctx.beginPath();
  trace();
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.restore();
}

/** World units covered by one grain tile. */
const GRAIN_TILE = 256;

/**
 * A tile of fine noise: paper texture, and dithering that keeps the dark
 * candle-lit gradients from banding once the video is compressed.
 */
function makeGrain(env, strength) {
  const size = Math.min(1024, Math.round(GRAIN_TILE * 1.5 * env.scale));
  const tile = env.createCanvas(size, size);
  const g = tile.getContext('2d');
  const img = g.createImageData(size, size);
  const r = rng(1234);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(r() * 256);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = Math.round(8 * strength);
  }
  g.putImageData(img, 0, 0);
  return tile;
}

export function createScene(env, options = {}) {
  const { credit = true, grain: grainStrength = 1 } = options;
  const lighting = createLighting(env);
  const grain = grainStrength > 0 ? makeGrain(env, grainStrength) : null;

  const confetti = makeConfetti(2026, T.lightsOn, DURATION);
  const closeConfetti = makeForegroundConfetti(46, T.lightsOn, env);
  const looseBalloons = makeLooseBalloons(5, T.lightsOn);
  const notes = makeNotes(11, SUNG, [
    (t) => {
      const p = sonnetPose(t, cartState(t));
      return { x: p.x, y: p.y, r: p.r, dir: 1 };
    },
    (t) => {
      const p = haikuPose(t, cartState(t));
      return { x: p.x, y: p.y, r: p.r, dir: t < T.lightsOff ? -1 : -0.3 };
    },
  ]);

  const warm = 'rgba(255,190,90,0.9)';
  const r = rng(99);
  const worldSparkles = [
    ...sparkleBurst(1, T.hatLand, 984, 514, { n: 6, radius: 84, size: 18, colours: [C.gold, '#F6CF7A', C.clay] }),
    ...sparkleBurst(2, T.cartStop + 0.02, CART_X, 720, { n: 9, radius: 200, size: 21, dur: 0.75, colours: ['#FFE9B0', '#FFD27A'], glow: warm, spread: 0.5 }),
    ...sparkleBurst(3, 9.0, OPUS_X, 640, { n: 8, radius: 235, size: 17, dur: 0.75, colours: ['#FFD27A', '#FFC7D6'], glow: warm, spread: 1.0 }),
    ...Array.from({ length: 13 }, (_, i) => {
      const a = r() * TAU;
      return {
        t0: T.wish + 0.45 + i * 0.17 + r() * 0.1, x: OPUS_X + Math.cos(a) * (195 + r() * 95), y: 610 + Math.sin(a) * (170 + r() * 60),
        size: 9 + r() * 10, dur: 0.6 + r() * 0.3, colour: i % 3 ? '#FFE9B0' : '#FFC7D6', glow: warm, rot: r(),
      };
    }),
  ];
  const titleSparkles = Array.from({ length: 22 }, (_, i) => {
    const side = i % 4;
    const u = r();
    const pos = side === 0 ? [430 + u * 80, 240 + r() * 190] : side === 1 ? [1410 + u * 80, 240 + r() * 190] : side === 2 ? [520 + u * 880, 176 + r() * 30] : [520 + u * 880, 448 + r() * 26];
    return { t0: T.lightsOn + 0.75 + i * 0.21 + r() * 0.12, x: pos[0], y: pos[1], size: 12 + r() * 14, dur: 0.6 + r() * 0.35, colour: [C.gold, C.clay, C.sky, C.fig][i % 4], rot: r() };
  });

  function draw(ctx, t) {
    // ---------------------------------------------------------- state
    const cam = camera(t);
    const ds = env.scale * cam.z; // device px per world px
    const project = (wx, wy) => [(wx - cam.x) * cam.z + W / 2, (wy - cam.y) * cam.z + H / 2];
    const enterWorld = () => {
      ctx.translate(W / 2, H / 2);
      ctx.scale(cam.z, cam.z);
      ctx.translate(-cam.x, -cam.y);
    };

    const cart = cartState(t);
    const flame = flameState(t, cart);
    const wick = wickWorld(cart.x, cart.tilt);
    const candle = flame.alpha ? clamp(flame.size) * (0.93 + 0.07 * noise(t * 8, 2)) * smoothstep(T.cartIn, T.cartIn + 0.5, t) : 0;

    const dark = smoothstep(T.lightsOff, T.lightsOff + 0.1, t) * (1 - smoothstep(T.lightsOn, T.lightsOn + 0.07, t));
    const pitch = smoothstep(T.flameOut - 0.03, T.flameOut + 0.22, t);
    const ambient = mix([255, 255, 255], mix([34, 34, 66], [10, 9, 17], pitch), dark);
    const fin = t - T.lightsOn;
    const party = fin > 0 ? 1 : 0;

    const opus = opusPose(t);
    const sonnet = sonnetPose(t, cart);
    const haiku = haikuPose(t, cart);
    const actors = [[CAST.sonnet, sonnet], [CAST.haiku, haiku], [CAST.opus, opus]]; // back to front

    // how much candlelight reaches a point (0..1)
    const lit = (x, y) => candle * clamp(1 - Math.hypot(x - wick[0], y - wick[1]) / 760) ** 1.3;
    const thrown = candle * dark;

    // ---------------------------------------------------------- world
    ctx.save();
    enterWorld();
    drawWallAndFloor(ctx);

    // shadows on the wall: soft and close by day, long and leaping by candlelight
    ctx.save();
    ctx.beginPath();
    ctx.rect(-700, -700, W + 1400, FLOOR_Y - 30 + 700);
    ctx.clip();
    const day = 1 - dark;
    const lx = wick[0] + 5 * noise(t * 9, 31);
    const ly = wick[1] - 26 + 4 * noise(t * 11, 32);
    for (const [spec, pose] of actors) {
      if ((pose.scale ?? 1) < 0.05) continue;
      if (day > 0.01) {
        softFill(ctx, ds, 30, css([96, 66, 34], 0.17 * day), () => {
          ctx.translate(12, 24);
          traceSparkSilhouette(ctx, spec, pose, t);
        });
      }
      if (thrown > 0.01) {
        softFill(ctx, ds, 22, css([16, 9, 30], 0.5 * thrown), () => {
          ctx.translate(lx, ly);
          ctx.scale(1.42, 1.42);
          ctx.translate(-lx, -ly);
          traceSparkSilhouette(ctx, spec, pose, t);
        });
      }
    }
    ctx.restore();

    drawBunting(ctx, t, party ? buntingShake(t, T.lightsOn) : 0);
    // contact shadows on the floor
    for (const [pose, fy] of [[sonnet, 994], [haiku, 1004], [opus, 988]]) {
      const s = pose.scale ?? 1;
      const lift = clamp((fy - pose.y - pose.r) / 300);
      const slide = thrown * Math.sign(pose.x - wick[0]) * pose.r * 0.4;
      softEllipse(ctx, pose.x + slide, fy, pose.r * s * (0.86 - 0.3 * lift), pose.r * s * 0.13, [70, 45, 20], (0.3 - 0.14 * lift) * s);
    }
    if (cart.visible) softEllipse(ctx, cart.x, TABLE_Y + 160, 235, 17, [70, 45, 20], 0.32);

    drawGifts(ctx);
    drawTetheredBalloons(ctx, t, party ? clamp(1 - fin / 4) : 0);

    for (const [spec, pose] of actors) drawSpark(ctx, spec, pose, t);
    if (cart.visible) drawCart(ctx, cart.x, cart.wheel, cart.tilt);
    if (party) {
      drawConfetti(ctx, confetti, t);
      drawLooseBalloons(ctx, looseBalloons, t);
    }
    ctx.restore();

    // ------------------------------------------------------- lighting
    if (dark > 0.002) {
      const [fx, fy] = project(wick[0], wick[1] - 30);
      const [tx, ty] = project(cart.x, TABLE_Y - 40);
      lighting.apply(ctx, ambient, [
        { x: fx, y: fy, radius: 720 * cam.z * (1 + 0.035 * noise(t * 10, 5)), intensity: candle },
        { x: tx, y: ty, radius: 400 * cam.z, intensity: candle * 0.28 }, // light pooling on the table
      ]);
    }

    // ------------------------------------- things that glow in the dark
    ctx.save();
    enterWorld();
    // candlelight catching the side of everyone who faces the flame
    if (thrown > 0.01) {
      for (const [spec, pose] of actors) {
        const dx = wick[0] - pose.x;
        const dy = wick[1] - 30 - pose.y;
        const d = Math.hypot(dx, dy) || 1;
        const k = thrown * clamp(1.3 - d / 820);
        const R = pose.r * (pose.scale ?? 1);
        if (k <= 0.01 || R < 2) continue;
        const cx = pose.x + (dx / d) * R * 1.05;
        const cy = pose.y + (dy / d) * R * 1.05;
        ctx.save();
        ctx.beginPath();
        traceSparkSilhouette(ctx, spec, pose, t);
        ctx.clip();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.55);
        g.addColorStop(0, css([255, 178, 98], 0.48 * k));
        g.addColorStop(0.45, css([255, 150, 70], 0.2 * k));
        g.addColorStop(1, 'rgba(255,140,60,0)');
        ctx.fillStyle = g;
        ctx.fillRect(pose.x - R * 1.7, pose.y - R * 2.5, R * 3.4, R * 4.2);
        ctx.restore();
      }
    }
    // eyes shining out of the dark
    if (dark > 0.01) {
      for (const [spec, pose] of actors) {
        const glow = dark * clamp(1 - lit(pose.x, pose.y) * 3.2);
        if (glow <= 0.01) continue;
        ctx.save();
        ctx.shadowColor = css('#FFE9C0', 0.55 * glow);
        ctx.shadowBlur = 12 * ds;
        drawSparkEyes(ctx, spec, pose, css('#FFF4DC', glow));
        if (spec === CAST.haiku && t > ZIP[0] && t < ZIP[1]) {
          // streaks behind Haiku's dash
          for (let i = 1; i <= 10; i++) drawSparkEyes(ctx, spec, haikuPose(t - i * 0.005, cart), css('#FFF4DC', glow * 0.34 * (1 - i / 11)));
        }
        ctx.restore();
      }
    }
    if (cart.visible) {
      const since = t - T.flameOut;
      drawSmoke(ctx, wick[0], wick[1] - 4, since, mix([150, 146, 160], [206, 200, 222], dark), lerp(0.75, 0.5, dark));
      drawEmber(ctx, wick[0], wick[1], since);
      drawFlame(ctx, wick[0], wick[1], flame, t);
      drawBreath(ctx, mouthWorld(opus), [wick[0], wick[1] - 26], invLerp(T.blow, T.flameOut + 0.12, t));
    }
    drawNotes(ctx, notes, t, [css(mix('#3E6E9F', '#CFE4FF', dark)), css(mix('#5E7F3C', '#DDF2C0', dark))], dark, ds);
    drawSparkles(ctx, worldSparkles, t, ds);
    if (grain) {
      // grain lives in the world (it moves with the camera), which video codecs handle far better than a fixed overlay
      const hw = W / 2 / cam.z + 4;
      const hh = H / 2 / cam.z + 4;
      const x0 = Math.floor((cam.x - hw) / GRAIN_TILE) * GRAIN_TILE;
      const y0 = Math.floor((cam.y - hh) / GRAIN_TILE) * GRAIN_TILE;
      for (let gy = y0; gy < cam.y + hh; gy += GRAIN_TILE) for (let gx = x0; gx < cam.x + hw; gx += GRAIN_TILE) ctx.drawImage(grain, gx, gy, GRAIN_TILE, GRAIN_TILE);
    }
    ctx.restore();

    // the lights snapping back on
    if (fin > 0 && fin < 0.7) {
      ctx.fillStyle = css('#FFF8EC', 0.6 * Math.exp(-fin / 0.11));
      ctx.fillRect(0, 0, W, H);
    }

    // -------------------------------------------------------------- UI
    drawIntroTitle(ctx, t);
    const guests = [
      { name: 'Haiku', t0: T.haikuIn, pose: haiku, side: 1 },
      { name: 'Sonnet', t0: T.sonnetIn, pose: sonnet, side: -1 },
    ].map((g) => {
      const [x, y] = project(g.pose.x, g.pose.y);
      return { name: g.name, t0: g.t0, x, y, r: g.pose.r * cam.z, side: g.side };
    });
    drawGuestLabels(ctx, t, guests);
    drawKaraoke(ctx, t, dark, env.scale);
    const tip = hatTipWorld(opus, CAST.opus);
    const [ax, ay] = project(tip[0], tip[1]);
    drawWishPill(ctx, t, ax + 6, ay - 26);
    if (party) {
      drawEndTitle(ctx, t, credit);
      drawSparkles(ctx, titleSparkles, t, env.scale);
      drawForegroundConfetti(ctx, closeConfetti, t);
    }

    // ------------------------------------------------------------ post
    const v = ctx.createRadialGradient(W / 2, H / 2, 560, W / 2, H / 2, 1180);
    v.addColorStop(0, 'rgba(30,15,5,0)');
    v.addColorStop(1, 'rgba(30,15,5,0.2)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);


  }

  return { draw };
}
