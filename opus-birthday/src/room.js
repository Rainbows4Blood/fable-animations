// The party room: wall, floor, bunting, tethered balloons and a pile of presents.

import { TAU, lerp, css, lighten, darken, wobble } from './util.js';
import { C, PARTY, FLOOR_Y, W } from './theme.js';

/** Overdraw margin, so a camera overshoot never reveals the edge of the world. */
const M = 600;

export function drawWallAndFloor(ctx) {
  // wall
  let g = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
  g.addColorStop(0, C.wallTop);
  g.addColorStop(1, C.wallBottom);
  ctx.fillStyle = g;
  ctx.fillRect(-M, -M, W + 2 * M, FLOOR_Y + M);

  // soft pool of light in the middle of the wall
  g = ctx.createRadialGradient(W / 2, 520, 80, W / 2, 520, 1050);
  g.addColorStop(0, 'rgba(255,254,248,0.6)');
  g.addColorStop(1, 'rgba(255,254,248,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-M, -M, W + 2 * M, FLOOR_Y + M);

  // wallpaper: a quiet scatter of tiny sparks
  ctx.strokeStyle = css(C.wallMark, 0.15);
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const stepX = 136;
  const stepY = 116;
  for (let row = -5; row * stepY + 46 < FLOOR_Y - 70; row++) {
    for (let col = -5; col * stepX < W + M; col++) {
      const x = col * stepX + (row & 1 ? stepX / 2 : 0);
      const y = row * stepY + 46;
      const rot = (((col * 7 + row * 13) % 5) + 5) * 0.21;
      for (let k = 0; k < 3; k++) {
        const a = rot + (k * Math.PI) / 3;
        const dx = Math.cos(a) * 7;
        const dy = Math.sin(a) * 7;
        ctx.moveTo(x - dx, y - dy);
        ctx.lineTo(x + dx, y + dy);
      }
    }
  }
  ctx.stroke();

  // floor
  g = ctx.createLinearGradient(0, FLOOR_Y, 0, 1120);
  g.addColorStop(0, C.floorFar);
  g.addColorStop(1, C.floor);
  ctx.fillStyle = g;
  ctx.fillRect(-M, FLOOR_Y, W + 2 * M, M);
  ctx.fillStyle = 'rgba(120,95,60,0.07)';
  for (const dy of [34, 82, 148]) ctx.fillRect(-M, FLOOR_Y + dy, W + 2 * M, 2.5);

  // baseboard
  ctx.fillStyle = C.baseboard;
  ctx.fillRect(-M, FLOOR_Y - 30, W + 2 * M, 30);
  ctx.fillStyle = 'rgba(120,100,70,0.16)';
  ctx.fillRect(-M, FLOOR_Y - 31.5, W + 2 * M, 2);
  ctx.fillStyle = 'rgba(90,70,40,0.2)';
  ctx.fillRect(-M, FLOOR_Y - 1.5, W + 2 * M, 3);
}

// ---------------------------------------------------------------- bunting

function swag(ctx, time, { x0, y0, x1, y1, sag, n, phase, shake, colorShift }) {
  const at = (u) => {
    const bell = 4 * u * (1 - u);
    const sway = 5 * Math.sin(time * TAU * 0.23 + u * 4 + phase) * bell;
    return [lerp(x0, x1, u), lerp(y0, y1, u) + (sag + shake * 14 * Math.sin(time * TAU * 3.1 + phase)) * bell + sway];
  };
  ctx.beginPath();
  for (let i = 0; i <= 28; i++) {
    const [x, y] = at(i / 28);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = '#BCAE97';
  ctx.lineWidth = 3;
  ctx.stroke();

  const fw = 64;
  const fh = 80;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    const [x, y] = at(u);
    const [xa, ya] = at(u - 0.01);
    const [xb, yb] = at(u + 0.01);
    const swing =
      0.07 * Math.sin(time * TAU * 0.5 + i * 1.3 + phase) + shake * 0.32 * Math.sin(time * TAU * 4.3 + i * 0.9 + phase);
    const colour = PARTY[(i + colorShift) % PARTY.length];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.atan2(yb - ya, xb - xa) + swing);
    ctx.beginPath();
    ctx.moveTo(-fw / 2, -2);
    ctx.lineTo(fw / 2, -2);
    ctx.lineTo(0, fh);
    ctx.closePath();
    ctx.fillStyle = colour;
    ctx.fill();
    ctx.beginPath(); // shaded half
    ctx.moveTo(0, -2);
    ctx.lineTo(fw / 2, -2);
    ctx.lineTo(0, fh);
    ctx.closePath();
    ctx.fillStyle = 'rgba(40,20,0,0.08)';
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.26)'; // fold over the string
    ctx.fillRect(-fw / 2, -2, fw, 8);
    ctx.restore();
  }
}

/** Two swags of flags pinned at the top corners and the middle. `shake` (0..1) rattles them. */
export function drawBunting(ctx, time, shake = 0) {
  swag(ctx, time, { x0: -260, y0: -6, x1: W / 2, y1: 26, sag: 104, n: 10, phase: 0.4, shake, colorShift: 0 });
  swag(ctx, time, { x0: W / 2, y0: 26, x1: W + 260, y1: -6, sag: 104, n: 10, phase: 2.1, shake, colorShift: 3 });
  // the pin in the middle
  ctx.fillStyle = C.gold;
  ctx.beginPath();
  ctx.arc(W / 2, 26, 9, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.arc(W / 2 - 2.5, 23.5, 3.2, 0, TAU);
  ctx.fill();
}

// --------------------------------------------------------------- balloons

/** A single balloon body centred on (0, 0) of the current transform. */
export function balloonBody(ctx, r, colour) {
  ctx.beginPath();
  ctx.moveTo(0, r * 1.05);
  ctx.bezierCurveTo(-0.55 * r, 0.88 * r, -0.9 * r, 0.36 * r, -0.9 * r, -0.12 * r);
  ctx.bezierCurveTo(-0.9 * r, -0.68 * r, -0.52 * r, -r, 0, -r);
  ctx.bezierCurveTo(0.52 * r, -r, 0.9 * r, -0.68 * r, 0.9 * r, -0.12 * r);
  ctx.bezierCurveTo(0.9 * r, 0.36 * r, 0.55 * r, 0.88 * r, 0, r * 1.05);
  ctx.closePath();
  const g = ctx.createRadialGradient(-0.32 * r, -0.4 * r, r * 0.05, -0.2 * r, -0.2 * r, r * 1.5);
  g.addColorStop(0, css(lighten(colour, 0.34)));
  g.addColorStop(0.5, css(colour));
  g.addColorStop(1, css(darken(colour, 0.2)));
  ctx.fillStyle = g;
  ctx.fill();
  // knot
  ctx.beginPath();
  ctx.moveTo(0, r * 1.02);
  ctx.lineTo(-0.1 * r, r * 1.17);
  ctx.lineTo(0.1 * r, r * 1.17);
  ctx.closePath();
  ctx.fillStyle = css(darken(colour, 0.14));
  ctx.fill();
  // shine
  ctx.save();
  ctx.translate(-0.38 * r, -0.46 * r);
  ctx.rotate(0.5);
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.11 * r, 0.24 * r, 0, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fill();
  ctx.restore();
}

const TETHERED = [
  { x: 118, y: 396, r: 60, colour: C.gold, anchor: [236, 772], phase: 0.2 },
  { x: 248, y: 288, r: 68, colour: C.clay, anchor: [236, 772], phase: 0.55 },
  { x: 354, y: 424, r: 56, colour: C.heather, anchor: [236, 772], phase: 0.9 },
  { x: 1812, y: 376, r: 62, colour: C.fig, anchor: [1748, 790], phase: 0.35 },
  { x: 1708, y: 270, r: 68, colour: C.sky, anchor: [1748, 790], phase: 0.75 },
];
const ONE_BALLOON = { x: 1596, y: 352, h: 232, anchor: [1608, 838], phase: 0.6 };

function stringTo(ctx, x, y, ax, ay, time, phase) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo((x + ax) / 2 + 16 * Math.sin(time * TAU * 0.21 + phase * 7), (y + ay) / 2 + 36, ax, ay);
  ctx.strokeStyle = 'rgba(110,95,80,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

/** `joy` (0..1) makes the balloons bob harder, for the finale. */
export function drawTetheredBalloons(ctx, time, joy = 0) {
  const amp = 1 + joy * 1.6;
  for (const b of TETHERED) {
    const bx = b.x + 7 * amp * Math.sin(time * TAU * 0.19 + b.phase * 5);
    const by = b.y + 9 * amp * Math.sin(time * TAU * 0.15 + b.phase * 9);
    const tilt = 0.07 * amp * Math.sin(time * TAU * 0.19 + b.phase * 5 + 1.2);
    stringTo(ctx, bx - Math.sin(tilt) * b.r * 1.17, by + Math.cos(tilt) * b.r * 1.17, b.anchor[0], b.anchor[1], time, b.phase);
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(tilt);
    balloonBody(ctx, b.r, b.colour);
    ctx.restore();
  }

  // the big foil "1"
  const o = ONE_BALLOON;
  const ox = o.x + 6 * amp * Math.sin(time * TAU * 0.17 + 2);
  const oy = o.y + 8 * amp * Math.sin(time * TAU * 0.13 + 1);
  const tilt = -0.07 + 0.05 * amp * Math.sin(time * TAU * 0.17 + 3);
  const h = o.h;
  const bx = ox + 0.04 * h * Math.cos(tilt) - 0.5 * h * Math.sin(tilt);
  const by = oy + 0.04 * h * Math.sin(tilt) + 0.5 * h * Math.cos(tilt);
  stringTo(ctx, bx, by, o.anchor[0], o.anchor[1], time, o.phase);
  ctx.save();
  ctx.translate(ox, oy);
  ctx.rotate(tilt);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const trace = () => {
    ctx.beginPath();
    ctx.moveTo(-0.19 * h, -0.25 * h);
    ctx.lineTo(0.04 * h, -0.37 * h);
    ctx.lineTo(0.04 * h, 0.37 * h);
  };
  trace();
  ctx.strokeStyle = css(darken(C.gold, 0.16));
  ctx.lineWidth = 0.27 * h + 6;
  ctx.stroke();
  const g = ctx.createLinearGradient(-0.32 * h, 0, 0.2 * h, 0);
  g.addColorStop(0, css(lighten(C.gold, 0.42)));
  g.addColorStop(0.55, C.gold);
  g.addColorStop(1, css(darken(C.gold, 0.1)));
  trace();
  ctx.strokeStyle = g;
  ctx.lineWidth = 0.27 * h;
  ctx.stroke();
  ctx.beginPath(); // foil shine
  ctx.moveTo(-0.03 * h, -0.27 * h);
  ctx.lineTo(-0.03 * h, 0.3 * h);
  ctx.strokeStyle = 'rgba(255,255,255,0.42)';
  ctx.lineWidth = 0.035 * h;
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------------ gifts

const GIFTS = [
  { cx: 214, bottom: 1038, w: 196, h: 128, lid: 24, colour: C.sky, ribbon: C.cream, bow: false, dots: true },
  { cx: 236, bottom: 886, w: 124, h: 82, lid: 20, colour: C.fig, ribbon: C.gold, bow: true },
  { cx: 1608, bottom: 1038, w: 92, h: 168, lid: 22, colour: C.gold, ribbon: C.fig, bow: true },
  { cx: 1736, bottom: 1038, w: 178, h: 118, lid: 24, colour: C.leaf, ribbon: C.cream, bow: false, dots: true },
  { cx: 1748, bottom: 896, w: 112, h: 74, lid: 20, colour: C.heather, ribbon: C.clay, bow: true },
];

function bow(ctx, x, y, s, colour) {
  ctx.save();
  ctx.translate(x, y);
  const dark = css(darken(colour, 0.16));
  // tails
  ctx.fillStyle = dark;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(side * 0.85 * s, 0.95 * s);
    ctx.lineTo(side * 0.4 * s, 1.0 * s);
    ctx.closePath();
    ctx.fill();
  }
  // loops
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side, 1);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(0.45 * s, -0.85 * s, 1.35 * s, -0.7 * s, 1.15 * s, -0.08 * s);
    ctx.bezierCurveTo(1.0 * s, 0.3 * s, 0.4 * s, 0.16 * s, 0, 0);
    ctx.closePath();
    ctx.fillStyle = css(colour);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0.66 * s, -0.22 * s, 0.3 * s, 0.17 * s, -0.35, 0, TAU);
    ctx.fillStyle = dark;
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.roundRect(-0.24 * s, -0.3 * s, 0.48 * s, 0.5 * s, 0.14 * s);
  ctx.fillStyle = css(lighten(colour, 0.12));
  ctx.fill();
  ctx.restore();
}

function gift(ctx, g) {
  const x = g.cx - g.w / 2;
  const top = g.bottom - g.h;
  ctx.fillStyle = css(g.colour);
  ctx.beginPath();
  ctx.roundRect(x, top, g.w, g.h, 7);
  ctx.fill();
  ctx.save();
  ctx.clip();
  if (g.dots) {
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 8; c++) {
        ctx.beginPath();
        ctx.arc(x + 16 + c * 30 + (r & 1 ? 15 : 0), top + 20 + r * 26, 5, 0, TAU);
        ctx.fill();
      }
    }
  }
  const sh = ctx.createLinearGradient(x, 0, x + g.w, 0);
  sh.addColorStop(0, 'rgba(255,255,255,0.14)');
  sh.addColorStop(0.4, 'rgba(255,255,255,0)');
  sh.addColorStop(1, 'rgba(40,20,0,0.16)');
  ctx.fillStyle = sh;
  ctx.fillRect(x, top, g.w, g.h);
  ctx.fillStyle = 'rgba(40,20,0,0.16)'; // shadow under the lid
  ctx.fillRect(x, top, g.w, 7);
  ctx.restore();

  // lid
  ctx.fillStyle = css(lighten(g.colour, 0.12));
  ctx.beginPath();
  ctx.roundRect(x - 8, top - g.lid, g.w + 16, g.lid, 6);
  ctx.fill();
  // ribbon
  const rw = Math.max(16, g.w * 0.13);
  ctx.fillStyle = css(g.ribbon);
  ctx.fillRect(g.cx - rw / 2, top - g.lid, rw, g.h + g.lid);
  ctx.fillStyle = 'rgba(40,20,0,0.1)';
  ctx.fillRect(g.cx + rw / 2 - 4, top - g.lid, 4, g.h + g.lid);
  if (g.bow) bow(ctx, g.cx, top - g.lid - 2, g.w * 0.2, g.ribbon);
}

export function drawGifts(ctx) {
  // contact shadows
  ctx.fillStyle = 'rgba(70,45,20,0.16)';
  for (const [cx, rx] of [[220, 150], [1690, 190]]) {
    ctx.beginPath();
    ctx.ellipse(cx, 1040, rx, 13, 0, 0, TAU);
    ctx.fill();
  }
  for (const g of GIFTS) gift(ctx, g);
}

/** Bunting rattle used when the lights come back on. */
export const buntingShake = (t, t0) => Math.abs(wobble(t, t0, 1.6, 2.2));
