// Things that fly: confetti, music notes, sparkles and loose balloons.
// Every particle's position is a closed-form function of time (no simulation
// state), so frames can be rendered in any order.

import { TAU, clamp, rng, css, darken, lighten, ease, smoothstep } from './util.js';
import { PARTY, C } from './theme.js';
import { balloonBody } from './room.js';

// --------------------------------------------------------------- confetti

function confettiX(c, tau) {
  const e = Math.exp(-c.k * tau);
  return c.x0 + (c.vx / c.k) * (1 - e) + c.swayA * Math.sin(TAU * c.swayF * tau + c.swayP) * (1 - e);
}

function confettiY(c, tau) {
  const e = Math.exp(-c.k * tau);
  return c.y0 + (c.vy / c.k) * (1 - e) + (c.g / c.k) * (tau - (1 - e) / c.k);
}

/** Time at which a piece reaches the height restY, on its way down. */
function landingTime(c, restY) {
  const apex = c.vy < 0 ? Math.log(1 - (c.vy * c.k) / c.g) / c.k : 0;
  let lo = apex;
  let hi = apex + 12;
  if (confettiY(c, hi) < restY) return Infinity;
  for (let i = 0; i < 34; i++) {
    const mid = (lo + hi) / 2;
    if (confettiY(c, mid) < restY) lo = mid;
    else hi = mid;
  }
  return hi;
}

/** Floor space taken up by the presents and the cake trolley: [x0, x1]. */
const OCCUPIED = [[100, 336], [950, 1370], [1548, 1846]];

/**
 * Two cannons in the bottom corners plus a slow shower from above.
 * Pieces follow a launch arc with air drag, flutter on the way down and come
 * to rest on the floor.
 */
export function makeConfetti(seed, t0, endTime) {
  const r = rng(seed);
  const list = [];
  const piece = (o) => {
    const shapeRoll = r();
    const c = {
      k: 1.6 + r() * 0.8, // drag
      g: 470 + r() * 170, // gravity
      size: 10 + r() * 9,
      aspect: 1.3 + r() * 0.7,
      colour: PARTY[Math.floor(r() * PARTY.length)],
      rot0: r() * TAU,
      rotV: (r() - 0.5) * 8,
      flipP: r() * TAU,
      flipV: 4 + r() * 8,
      swayA: 14 + r() * 36,
      swayF: 0.45 + r() * 0.8,
      swayP: r() * TAU,
      shape: shapeRoll < 0.68 ? 'rect' : shapeRoll < 0.86 ? 'dot' : 'strip',
      restY: 968 + r() * 104, // where on the floor it settles
      restRot: (r() - 0.5) * 1.2,
      ...o,
    };
    c.land = landingTime(c, c.restY);
    // nothing comes to rest halfway up a present: there, it lands on the floor in front
    const lx = confettiX(c, c.land);
    if (Number.isFinite(c.land) && OCCUPIED.some(([a, b]) => lx > a && lx < b)) {
      c.restY = 1050 + r() * 26;
      c.land = landingTime(c, c.restY);
    }
    list.push(c);
  };

  const cannon = (cx, cy, dir, n) => {
    for (let i = 0; i < n; i++) {
      const ang = ((35 + r() * 47) * Math.PI) / 180; // above horizontal
      const speed = 1350 + r() ** 0.75 * 1800;
      piece({ t0: t0 + r() * 0.09, x0: cx + (r() - 0.5) * 50, y0: cy, vx: dir * Math.cos(ang) * speed, vy: -Math.sin(ang) * speed });
    }
  };
  cannon(-30, 1040, 1, 105);
  cannon(1950, 1040, -1, 105);
  for (let i = 0; i < 150; i++) {
    piece({ t0: t0 + 0.35 + r() * (endTime - t0 - 1.4), x0: -80 + r() * 2080, y0: -40 - r() * 140, vx: (r() - 0.5) * 90, vy: 30 + r() * 150 });
  }
  return list;
}

export function drawConfetti(ctx, list, t, scale = 1) {
  for (const c of list) {
    const life = t - c.t0;
    if (life <= 0) continue;
    const landed = life >= c.land;
    const tau = landed ? c.land : life;
    const x = confettiX(c, tau);
    const y = landed ? c.restY : confettiY(c, tau);
    if (y > 1180 || x < -160 || x > 2080) continue;
    const flip = landed ? 0.42 : Math.cos(c.flipP + c.flipV * tau);
    const w = c.size * scale;
    const h = c.size * c.aspect * scale;
    ctx.save();
    ctx.translate(x, y);
    if (landed) {
      ctx.scale(1, 0.42); // lying flat on the floor, seen from the side
      ctx.rotate(c.restRot);
    } else {
      ctx.rotate(c.rot0 + c.rotV * tau);
      ctx.scale(1, Math.sign(flip) * Math.max(0.12, Math.abs(flip)));
    }
    ctx.fillStyle = flip >= 0 ? c.colour : css(darken(c.colour, 0.2));
    if (c.shape === 'dot') {
      ctx.beginPath();
      ctx.arc(0, 0, w * 0.55, 0, TAU);
      ctx.fill();
    } else if (c.shape === 'strip') {
      ctx.fillRect(-w * 0.22, -h * 0.9, w * 0.44, h * 1.8);
    } else {
      ctx.fillRect(-w / 2, -h / 2, w, h);
    }
    ctx.restore();
  }
}

/**
 * A few big, out-of-focus pieces close to the lens. Each one is blurred once,
 * into a small sprite, instead of on every frame.
 * @param env {createCanvas, scale}
 */
export function makeForegroundConfetti(seed, t0, env) {
  const r = rng(seed);
  const list = [];
  const blur = 5;
  const pad = blur * 3;
  const sprite = (w, h, colour) => {
    const s = env.scale;
    const canvas = env.createCanvas(Math.ceil((w + pad * 2) * s), Math.ceil((h + pad * 2) * s));
    const c = canvas.getContext('2d');
    c.filter = `blur(${blur * s}px)`; // browsers without canvas filters simply get sharp pieces
    c.fillStyle = colour;
    c.fillRect(pad * s, pad * s, w * s, h * s);
    return canvas;
  };
  for (let i = 0; i < 16; i++) {
    const size = 30 + r() * 26;
    const aspect = 1.2 + r() * 0.6;
    const colour = PARTY[Math.floor(r() * PARTY.length)];
    list.push({
      t0: t0 + 0.15 + r() * 3.6,
      x0: r() * 1920,
      vy: 420 + r() * 260,
      w: size + pad * 2,
      h: size * aspect + pad * 2,
      front: sprite(size, size * aspect, colour),
      back: sprite(size, size * aspect, css(darken(colour, 0.2))),
      rot0: r() * TAU,
      rotV: (r() - 0.5) * 5,
      flipP: r() * TAU,
      flipV: 3 + r() * 4,
      swayA: 40 + r() * 60,
      swayF: 0.3 + r() * 0.4,
      swayP: r() * TAU,
    });
  }
  return list;
}

export function drawForegroundConfetti(ctx, list, t) {
  for (const c of list) {
    const tau = t - c.t0;
    if (tau <= 0) continue;
    const y = -80 + c.vy * tau;
    if (y > 1200) continue;
    const x = c.x0 + c.swayA * Math.sin(TAU * c.swayF * tau + c.swayP);
    const flip = Math.cos(c.flipP + c.flipV * tau);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(c.rot0 + c.rotV * tau);
    ctx.scale(1, Math.max(0.15, Math.abs(flip)));
    ctx.globalAlpha = 0.85;
    ctx.drawImage(flip >= 0 ? c.front : c.back, -c.w / 2, -c.h / 2, c.w, c.h);
    ctx.restore();
  }
}

// ------------------------------------------------------------ music notes

function noteGlyph(ctx, beamed) {
  ctx.lineWidth = 3.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.ellipse(0, 0, 10.5, 7.6, -0.38, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(8.8, -2.5);
  ctx.lineTo(8.8, -42);
  ctx.stroke();
  if (beamed) {
    ctx.beginPath();
    ctx.ellipse(31, -7, 10.5, 7.6, -0.38, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(39.8, -9.5);
    ctx.lineTo(39.8, -49);
    ctx.stroke();
    ctx.lineWidth = 7.5;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(8.8, -40);
    ctx.lineTo(39.8, -47);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(8.8, -42);
    ctx.bezierCurveTo(12, -30, 25, -31, 20.5, -15);
    ctx.stroke();
  }
}

/**
 * One floating note per sung note, alternating between the singers.
 * @param sung    melody notes [{t, dur}]
 * @param singers functions (t) => {x, y, r, dir}: where that singer is at time t, and which way its notes drift
 */
export function makeNotes(seed, sung, singers) {
  const r = rng(seed);
  return sung.map((n, i) => {
    const s = singers[i % singers.length](n.t);
    return {
      t0: n.t + 0.03,
      who: i % singers.length,
      x0: s.x + Math.sign(s.dir) * s.r * (0.9 + r() * 0.35),
      y0: s.y - s.r * (0.85 + r() * 0.45),
      dir: s.dir,
      beamed: n.dur >= 0.5 && r() < 0.4,
      size: (0.82 + r() * 0.3) * (0.75 + s.r / 380),
      phase: r() * TAU,
      life: 1.5 + r() * 0.6,
    };
  });
}

/**
 * @param colours per-singer fill colour
 * @param glow    0..1 warm halo (for the dark scenes)
 * @param ds      device pixels per unit (blur radii are in device pixels)
 */
export function drawNotes(ctx, list, t, colours, glow, ds = 1) {
  for (const n of list) {
    const tau = t - n.t0;
    if (tau <= 0 || tau >= n.life) continue;
    const u = tau / n.life;
    const x = n.x0 + n.dir * 34 * tau + 13 * Math.sin(tau * 3.1 + n.phase);
    const y = n.y0 - 78 * tau - 16 * tau * tau;
    const s = n.size * ease.outBack(clamp(tau / 0.22));
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(0.22 * Math.sin(tau * 2.6 + n.phase));
    ctx.scale(s, s);
    ctx.globalAlpha = 1 - smoothstep(0.55, 1, u);
    if (glow > 0.01) {
      ctx.shadowColor = `rgba(255,190,90,${(0.85 * glow).toFixed(3)})`;
      ctx.shadowBlur = 16 * ds;
    }
    ctx.fillStyle = ctx.strokeStyle = colours[n.who];
    noteGlyph(ctx, n.beamed);
    ctx.restore();
  }
}

// --------------------------------------------------------------- sparkles

export function sparkleShape(ctx, size) {
  ctx.beginPath();
  ctx.moveTo(0, -size);
  for (let k = 1; k <= 4; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 2;
    ctx.quadraticCurveTo(0, 0, Math.cos(a) * size, Math.sin(a) * size);
  }
  ctx.closePath();
}

/** Twinkles: [{t0, x, y, size, dur, colour}] — each scales up, turns and vanishes. */
export function drawSparkles(ctx, list, t, ds = 1) {
  for (const s of list) {
    const u = (t - s.t0) / s.dur;
    if (u <= 0 || u >= 1) continue;
    const k = Math.sin(u * Math.PI) ** 0.7;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(u * 0.9 + (s.rot ?? 0));
    sparkleShape(ctx, s.size * k);
    ctx.fillStyle = s.colour;
    if (s.glow) {
      ctx.shadowColor = s.glow;
      ctx.shadowBlur = 14 * ds;
    }
    ctx.fill();
    ctx.restore();
  }
}

/** A ring of twinkles around a point. */
export function sparkleBurst(seed, t0, x, y, { n = 6, radius = 70, size = 16, dur = 0.55, colours = [C.gold], glow = null, spread = 0.25 } = {}) {
  const r = rng(seed);
  const list = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + r() * 0.8;
    const d = radius * (0.6 + r() * 0.6);
    list.push({
      t0: t0 + r() * spread,
      x: x + Math.cos(a) * d,
      y: y + Math.sin(a) * d * 0.8,
      size: size * (0.6 + r() * 0.7),
      dur: dur * (0.8 + r() * 0.5),
      colour: colours[i % colours.length],
      rot: r() * 1.5,
      glow,
    });
  }
  return list;
}

// ---------------------------------------------------------- loose balloons

export function makeLooseBalloons(seed, t0) {
  const r = rng(seed);
  const xs = [60, 190, 296, 1775, 1862, 1905, 120, 1832]; // lanes at the sides, clear of the cast and the big "1"
  return xs.map((x, i) => ({
    t0: t0 + 0.25 + i * 0.36 + r() * 0.3,
    x: x + (r() - 0.5) * 40,
    r: 62 + r() * 34,
    speed: 235 + r() * 110,
    colour: PARTY[(i * 2 + 1) % PARTY.length],
    phase: r() * TAU,
  }));
}

export function drawLooseBalloons(ctx, list, t) {
  for (const b of list) {
    const tau = t - b.t0;
    if (tau <= 0) continue;
    const y = 1080 + b.r * 1.4 - b.speed * tau;
    if (y < -b.r * 4) continue;
    const x = b.x + 24 * Math.sin(tau * 1.25 + b.phase);
    const tilt = 0.1 * Math.cos(tau * 1.25 + b.phase);
    // trailing string
    ctx.beginPath();
    ctx.moveTo(x, y + b.r * 1.15);
    for (let i = 1; i <= 12; i++) {
      const s = i / 12;
      ctx.lineTo(x + 10 * Math.sin(tau * 3 + s * 6 + b.phase) * s - 26 * s * Math.sin(tau * 1.25 + b.phase), y + b.r * 1.15 + s * 190);
    }
    ctx.strokeStyle = 'rgba(110,95,80,0.55)';
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    balloonBody(ctx, b.r, lighten(b.colour, 0.04));
    ctx.restore();
  }
}
