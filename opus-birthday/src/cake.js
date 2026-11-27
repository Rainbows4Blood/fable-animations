// The cake trolley: cart, cake, a "1" candle — plus the flame, the smoke after
// it is blown out, and the puff of air that does it.

import { TAU, clamp, lerp, rng, noise, css, ease } from './util.js';
import { C, PARTY } from './theme.js';

/** World y of the table top. The cart is positioned by the x of its centre. */
export const TABLE_Y = 892;

const CAKE_R = 118;
const CAKE_TOP = -130; // relative to the table top
const CAKE_BOTTOM = -24;
const CANDLE_H = 90;
/** Tip of the wick, relative to the cart centre / table top. */
const WICK = [5, CAKE_TOP - 2 - CANDLE_H - 14];

/** World position of the wick tip (follows the cake when it wobbles). */
export function wickWorld(cartX, tilt = 0) {
  const px = WICK[0];
  const py = WICK[1] - CAKE_BOTTOM;
  const c = Math.cos(tilt);
  const s = Math.sin(tilt);
  return [cartX + px * c - py * s, TABLE_Y + CAKE_BOTTOM + px * s + py * c];
}

const sprinkles = (() => {
  const r = rng(77);
  const list = [];
  for (let i = 0; i < 30; i++) {
    const a = r() * TAU;
    const d = Math.sqrt(r()) * 0.82;
    list.push({ x: Math.cos(a) * d * (CAKE_R - 14), y: Math.sin(a) * d * 8.5, rot: r() * Math.PI, colour: PARTY[i % PARTY.length] });
  }
  return list;
})();

const DRIPS = [30, 52, 26, 44, 30, 58, 24, 46, 32];

function wheel(ctx, x, y, r, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#3B312C';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#5B4B43';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.66, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#E7D7B8';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let k = 0; k < 3; k++) {
    const a = (k * TAU) / 3;
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6);
  }
  ctx.stroke();
  ctx.fillStyle = '#E7D7B8';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.26, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function dollop(ctx, x, y, s) {
  ctx.fillStyle = '#E28B6C';
  ctx.beginPath();
  ctx.arc(x, y, 11 * s, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#EDA387';
  ctx.beginPath();
  ctx.arc(x - 1 * s, y - 6.5 * s, 7 * s, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#F6BFA8';
  ctx.beginPath();
  ctx.arc(x - 2 * s, y - 11 * s, 3.4 * s, 0, TAU);
  ctx.fill();
}

function candle(ctx) {
  // a chunky numeral "1", striped like the birthday hat
  const outline = () => {
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(14, -CANDLE_H);
    ctx.lineTo(-4, -CANDLE_H);
    ctx.lineTo(-30, -CANDLE_H + 24);
    ctx.lineTo(-30, -CANDLE_H + 40);
    ctx.lineTo(-10, -CANDLE_H + 28);
    ctx.lineTo(-10, 0);
    ctx.closePath();
  };
  outline();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = C.sky;
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.fillStyle = C.sky;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = '#FFF8EA';
  ctx.lineWidth = 7.5;
  ctx.beginPath();
  for (let k = -3; k < 9; k++) {
    ctx.moveTo(-44, -k * 19 + 12);
    ctx.lineTo(44, -k * 19 - 50);
  }
  ctx.stroke();
  const g = ctx.createLinearGradient(-30, 0, 16, 0);
  g.addColorStop(0, 'rgba(255,255,255,0.3)');
  g.addColorStop(0.6, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(60,30,10,0.16)');
  ctx.fillStyle = g;
  ctx.fillRect(-40, -CANDLE_H - 10, 70, CANDLE_H + 20);
  ctx.restore();
  // wick
  ctx.beginPath();
  ctx.moveTo(4, -CANDLE_H - 2);
  ctx.quadraticCurveTo(7, -CANDLE_H - 8, 5, -CANDLE_H - 13);
  ctx.strokeStyle = '#3D322C';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.stroke();
}

/**
 * @param x          world x of the cart centre
 * @param wheelAngle rotation of the wheels (radians)
 * @param tilt       wobble of the cake when the cart stops (radians)
 */
export function drawCart(ctx, x, wheelAngle = 0, tilt = 0) {
  ctx.save();
  ctx.translate(x, TABLE_Y);

  // frame + wheels
  ctx.fillStyle = '#B99A78';
  for (const side of [-1, 1]) ctx.fillRect(side * 128 - 6, 0, 12, 124);
  ctx.fillRect(-128, 98, 256, 9);
  wheel(ctx, -128, 138, 21, wheelAngle);
  wheel(ctx, 128, 138, 21, wheelAngle);

  // tablecloth with a scalloped hem
  const hem = 86;
  const n = 8;
  const half = 190;
  const sw = (half * 2) / n;
  ctx.beginPath();
  ctx.moveTo(-184, -4);
  ctx.lineTo(184, -4);
  ctx.lineTo(half, hem);
  for (let i = 0; i < n; i++) ctx.arc(half - (i + 0.5) * sw, hem, sw / 2, 0, Math.PI);
  ctx.closePath();
  ctx.fillStyle = '#FFFCF4';
  ctx.fill();
  ctx.save();
  ctx.clip();
  const fold = ctx.createLinearGradient(0, -4, 0, hem + 30);
  fold.addColorStop(0, 'rgba(120,95,60,0.14)');
  fold.addColorStop(0.25, 'rgba(120,95,60,0)');
  fold.addColorStop(1, 'rgba(120,95,60,0.1)');
  ctx.fillStyle = fold;
  ctx.fillRect(-200, -10, 400, 140);
  ctx.strokeStyle = 'rgba(150,125,90,0.13)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 1; i < n; i++) {
    const fx = half - i * sw;
    ctx.moveTo(fx * 0.97, 14);
    ctx.lineTo(fx, hem);
  }
  ctx.stroke();
  ctx.restore();
  // coloured trim along the scallops
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const cx = half - (i + 0.5) * sw;
    ctx.moveTo(cx + sw / 2 - 6, hem - 5);
    ctx.arc(cx, hem - 5, sw / 2 - 6, 0, Math.PI);
  }
  ctx.strokeStyle = css(C.clay, 0.85);
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.stroke();
  // table top
  ctx.fillStyle = '#FFFEFA';
  ctx.beginPath();
  ctx.roundRect(-192, -15, 384, 17, 8.5);
  ctx.fill();

  // plate
  ctx.fillStyle = '#C3D6CD';
  ctx.beginPath();
  ctx.ellipse(0, -11, 152, 12, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#E2EEE8';
  ctx.beginPath();
  ctx.ellipse(0, -14.5, 152, 11, 0, 0, TAU);
  ctx.fill();

  // ---- cake (wobbles around its base)
  ctx.translate(0, CAKE_BOTTOM);
  ctx.rotate(tilt);
  ctx.translate(0, -CAKE_BOTTOM);

  const R = CAKE_R;
  const edge = (px) => 13 * Math.sqrt(Math.max(0, 1 - (px / R) ** 2)); // front rim of the top

  ctx.beginPath();
  ctx.moveTo(-R, CAKE_TOP);
  ctx.lineTo(-R, CAKE_BOTTOM);
  ctx.ellipse(0, CAKE_BOTTOM, R, 12, 0, Math.PI, 0, true);
  ctx.lineTo(R, CAKE_TOP);
  ctx.closePath();
  ctx.fillStyle = '#F2D6AF';
  ctx.fill();
  ctx.save();
  ctx.clip();
  // jam layer
  ctx.beginPath();
  ctx.ellipse(0, -78, R, 12, 0, 0, Math.PI);
  ctx.strokeStyle = '#C9654A';
  ctx.lineWidth = 11;
  ctx.stroke();
  // little piped sparks around the side
  ctx.strokeStyle = C.clay;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const px of [-88, -46, 0, 46, 88]) {
    const squash = Math.max(0.45, Math.sqrt(1 - (px / R) ** 2));
    const py = -49 + 12 * Math.sqrt(1 - (px / R) ** 2);
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 4 + 0.2;
      ctx.moveTo(px - Math.cos(a) * 9 * squash, py - Math.sin(a) * 9);
      ctx.lineTo(px + Math.cos(a) * 9 * squash, py + Math.sin(a) * 9);
    }
  }
  ctx.stroke();
  const round = ctx.createLinearGradient(-R, 0, R, 0);
  round.addColorStop(0, 'rgba(255,255,255,0.2)');
  round.addColorStop(0.35, 'rgba(255,255,255,0)');
  round.addColorStop(1, 'rgba(100,55,20,0.22)');
  ctx.fillStyle = round;
  ctx.fillRect(-R, CAKE_TOP - 20, R * 2, 150);
  ctx.restore();

  // icing: drips down the side...
  ctx.fillStyle = '#FFFAF0';
  const dw = (R * 2) / DRIPS.length;
  for (let i = 0; i < DRIPS.length; i++) {
    const cx = -R + (i + 0.5) * dw;
    ctx.beginPath();
    ctx.roundRect(cx - dw / 2, CAKE_TOP + edge(cx) - 16, dw, DRIPS[i] + 16, dw / 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(0, CAKE_TOP, R, 13, 0, 0, Math.PI);
  ctx.ellipse(0, CAKE_TOP + 14, R, 13, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();
  // ...and the top
  ctx.fillStyle = '#FFFDF7';
  ctx.beginPath();
  ctx.ellipse(0, CAKE_TOP, R, 13, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#FBF2E0';
  ctx.beginPath();
  ctx.ellipse(0, CAKE_TOP + 0.5, R - 13, 9.5, 0, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  for (const s of sprinkles) {
    ctx.strokeStyle = s.colour;
    ctx.beginPath();
    ctx.moveTo(s.x - Math.cos(s.rot) * 4.5, CAKE_TOP + s.y - Math.sin(s.rot) * 2.2);
    ctx.lineTo(s.x + Math.cos(s.rot) * 4.5, CAKE_TOP + s.y + Math.sin(s.rot) * 2.2);
    ctx.stroke();
  }

  // piped dollops round the rim: back row, candle, front row
  for (let k = 0; k < 6; k++) {
    const a = Math.PI + (Math.PI * (k + 0.5)) / 6;
    dollop(ctx, Math.cos(a) * R * 0.86, CAKE_TOP + Math.sin(a) * 11, 0.82);
  }
  ctx.save();
  ctx.translate(0, CAKE_TOP - 2);
  candle(ctx);
  ctx.restore();
  for (let k = 0; k < 7; k++) {
    const a = (Math.PI * (k + 0.5)) / 7;
    dollop(ctx, Math.cos(a) * R * 0.86, CAKE_TOP + Math.sin(a) * 11.5, 1);
  }
  ctx.restore();
}

// ------------------------------------------------------------------ flame

function flameShape(ctx, w, h, tipX, k, baseY = 0) {
  const hw = (w / 2) * k;
  const hh = h * k;
  const tx = tipX * k;
  ctx.beginPath();
  ctx.moveTo(0, baseY);
  ctx.bezierCurveTo(-hw * 1.55, baseY - hh * 0.02, -hw * 1.2 + tx * 0.3, -hh * 0.55, tx, -hh);
  ctx.bezierCurveTo(hw * 1.2 + tx * 0.3, -hh * 0.55, hw * 1.55, baseY - hh * 0.02, 0, baseY);
  ctx.closePath();
}

/**
 * The candle flame, drawn after the lighting pass so it stays bright.
 * @param f {size, lean, stretch, alpha} — lean is sideways bend (in flame heights).
 */
export function drawFlame(ctx, x, y, f, time) {
  if (f.alpha <= 0.01 || f.size <= 0.01) return;
  const flick = 1 + 0.07 * noise(time * 11, 3) + 0.04 * noise(time * 27, 4);
  const h = 64 * f.size * flick * f.stretch;
  const w = (31 * f.size * (1 + 0.05 * noise(time * 13, 5))) / Math.sqrt(f.stretch);
  const tipX = (f.lean + 0.05 * noise(time * 7, 6) + 0.03 * noise(time * 19, 7)) * h;

  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = f.alpha;

  // halo
  ctx.globalCompositeOperation = 'lighter';
  const gx = tipX * 0.35;
  const gy = -h * 0.5;
  let g = ctx.createRadialGradient(gx, gy, 0, gx, gy, h * 2.3);
  g.addColorStop(0, 'rgba(255,176,80,0.27)');
  g.addColorStop(0.3, 'rgba(255,150,56,0.14)');
  g.addColorStop(1, 'rgba(255,130,40,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(gx, gy, h * 2.3, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  g = ctx.createLinearGradient(0, 0, 0, -h);
  g.addColorStop(0, '#FFB23C');
  g.addColorStop(1, '#FF7A2B');
  flameShape(ctx, w, h, tipX, 1, 4);
  ctx.fillStyle = g;
  ctx.fill();
  flameShape(ctx, w, h, tipX, 0.72);
  ctx.fillStyle = '#FFCB4A';
  ctx.fill();
  flameShape(ctx, w, h, tipX, 0.43);
  ctx.fillStyle = '#FFF6D2';
  ctx.fill();
  // cool blue base
  ctx.fillStyle = 'rgba(130,170,255,0.4)';
  ctx.beginPath();
  ctx.ellipse(0, -1, w * 0.2, 4.5, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Glowing wick right after the flame dies. `age` in seconds. */
export function drawEmber(ctx, x, y, age) {
  if (age <= 0 || age > 1.6) return;
  const a = (1 - age / 1.6) ** 1.6;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, 16);
  g.addColorStop(0, css('#FFB060', a));
  g.addColorStop(0.3, css('#FF6A20', a * 0.6));
  g.addColorStop(1, css('#FF4000', 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, 16, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** A ribbon of smoke curling up from the wick. `age` in seconds since the flame died. */
export function drawSmoke(ctx, x, y, age, colour, strength = 1) {
  const LIFE = 3.4;
  if (age <= 0.02 || age >= LIFE) return;
  const fade = clamp(age / 0.2) * (1 - ease.inQuad(clamp((age - 1.2) / (LIFE - 1.2))));
  const rise = 300 * (1 - Math.exp(-age * 1.1));
  const N = 30;
  const centre = (s) => [
    x + 34 * s * Math.sin(s * 5.4 - age * 2.6) + 70 * s * s, // drifts the way it was blown
    y - s * rise,
  ];
  const left = [];
  const right = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    const [cx, cy] = centre(s);
    const [ax, ay] = centre(Math.max(0, s - 0.02));
    const [bx, by] = centre(Math.min(1, s + 0.02));
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const nx = -(by - ay) / len;
    const ny = (bx - ax) / len;
    const half = lerp(2.5, 15, s) * (0.6 + 0.4 * Math.sin(s * Math.PI));
    left.push([cx + nx * half, cy + ny * half]);
    right.push([cx - nx * half, cy - ny * half]);
  }
  ctx.save();
  const g = ctx.createLinearGradient(0, y, 0, y - rise);
  g.addColorStop(0, css(colour, 0.5 * fade * strength));
  g.addColorStop(0.6, css(colour, 0.28 * fade * strength));
  g.addColorStop(1, css(colour, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (const p of left) ctx.lineTo(p[0], p[1]);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Streaks of breath travelling from the mouth to the candle. u: 0..1 through the blow. */
export function drawBreath(ctx, from, to, u) {
  if (u <= 0 || u >= 1) return;
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const uu = clamp((u - i * 0.07) / 0.6);
    if (uu <= 0 || uu >= 1) continue;
    const spread = (i - 2.5) * 13;
    const travel = ease.outCubic(uu) * (len + 70);
    const px = from[0] + ux * (78 + travel) - uy * spread * (0.4 + uu);
    const py = from[1] + uy * (78 + travel) + ux * spread * (0.4 + uu);
    const tail = 18 + 44 * (1 - uu);
    ctx.strokeStyle = css('#FFF6E0', Math.sin(uu * Math.PI) * 0.75);
    ctx.lineWidth = 4.6 - i * 0.3;
    ctx.beginPath();
    ctx.moveTo(px - ux * tail, py - uy * tail);
    ctx.lineTo(px, py);
    ctx.stroke();
  }
  ctx.restore();
}
