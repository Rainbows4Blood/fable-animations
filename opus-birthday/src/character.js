// The cast: little "spark" creatures — a burst of chunky rays around a face.
// One drawing routine, three personalities (see CAST in scene.js).
//
// A character is drawn in a local space where its radius is 1, so every number
// below is a fraction of the body size.

import { TAU, lerp, rng, css, darken } from './util.js';

/** Build a character description. Ray lengths/angles are randomised once, from the seed. */
export function makeSpark({ rays = 12, seed = 1, body, eye, mouth, blush, hat }) {
  const r = rng(seed);
  const list = [];
  for (let i = 0; i < rays; i++) {
    list.push({
      a: ((i + 0.5) / rays) * TAU - Math.PI / 2 + (r() - 0.5) * 0.15,
      len: 0.83 + r() * 0.17,
      w: 0.1 + r() * 0.022,
      p1: r() * TAU,
      p2: r() * TAU,
    });
  }
  return { rays: list, core: 0.5, body, shade: darken(body, 0.45), eye, mouth, blush, hat };
}

export const POSE = {
  x: 0, y: 0, r: 100, // position and radius, in world px
  scale: 1, // pop-in scale
  rot: 0, sx: 1, sy: 1, // lean and squash & stretch
  look: [0, 0], // where the face points, -1..1
  eyes: 'open', // open | wide | happy | serene | squeeze
  blink: 0, // 0 open .. 1 shut
  wink: 0, // shuts the right eye only
  mouth: 'smile', // smile | sing | grin | o | tiny
  mouthOpen: 0, // for 'sing'
  blush: 0, // extra cheek colour
  puff: 0, // puffed cheeks
  excite: 0, // jittery rays
  rayScale: 1,
  pulse: 0, // rays flare on the beat
  hat: true, hatDy: 0, hatRot: 0,
};

const HAT_BASE_Y = -0.45;
const HAT_H = 0.76;
const HAT_W = 0.29;

function traceBody(ctx, spec, p, time) {
  ctx.beginPath();
  ctx.moveTo(spec.core, 0);
  ctx.arc(0, 0, spec.core, 0, TAU);
  ctx.closePath();
  for (const ray of spec.rays) {
    const idle = 0.035 * Math.sin(time * TAU * 0.55 + ray.p1) + p.excite * 0.05 * Math.sin(time * TAU * 2.6 + ray.p2);
    const L = ray.len * p.rayScale * (1 + idle + p.pulse * 0.09);
    const a = ray.a + 0.035 * Math.sin(time * TAU * 0.4 + ray.p2) + p.excite * 0.04 * Math.sin(time * TAU * 3.1 + ray.p1);
    const w = ray.w;
    const dx = Math.cos(a), dy = Math.sin(a);
    const nx = -dy, ny = dx;
    const tx = dx * (L - w), ty = dy * (L - w);
    // a capsule from the centre out to the tip, wound the same way as the core disc
    ctx.moveTo(-nx * w, -ny * w);
    ctx.lineTo(tx - nx * w, ty - ny * w);
    ctx.arc(tx, ty, w, a - Math.PI / 2, a + Math.PI / 2);
    ctx.lineTo(nx * w, ny * w);
    ctx.closePath();
  }
}

/** Adds the cone to the current path (wound like the body, so overlaps union rather than cancel). */
function hatOutline(ctx) {
  ctx.moveTo(-HAT_W, 0);
  ctx.lineTo(0.02, -HAT_H);
  ctx.lineTo(HAT_W, 0);
  ctx.quadraticCurveTo(0, 0.1, -HAT_W, 0);
  ctx.closePath();
}

function traceHat(ctx) {
  ctx.beginPath();
  hatOutline(ctx);
}

function enter(ctx, p) {
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.scale(p.r * p.sx * p.scale, p.r * p.sy * p.scale);
}

function enterHat(ctx, spec, p) {
  ctx.translate(0, HAT_BASE_Y + p.hatDy);
  ctx.rotate((spec.hat.tilt ?? 0) + p.hatRot);
}

/** Map a point in the character's local (radius = 1) space to world space. */
export function toWorld(pose, lx, ly) {
  const p = { ...POSE, ...pose };
  const x = lx * p.r * p.sx * p.scale;
  const y = ly * p.r * p.sy * p.scale;
  const c = Math.cos(p.rot), s = Math.sin(p.rot);
  return [p.x + x * c - y * s, p.y + x * s + y * c];
}

const faceOffset = (p) => [p.look[0] * 0.085, p.look[1] * 0.06];

export const mouthWorld = (pose) => {
  const p = { ...POSE, ...pose };
  const [fx, fy] = faceOffset(p);
  return toWorld(p, fx, 0.17 + fy);
};

export const hatTipWorld = (pose, spec) => {
  const p = { ...POSE, ...pose };
  const tilt = (spec.hat?.tilt ?? 0) + p.hatRot;
  return toWorld(p, Math.sin(tilt) * HAT_H, HAT_BASE_Y + p.hatDy - Math.cos(tilt) * HAT_H);
};

// ------------------------------------------------------------------- eyes

function eyeShape(ctx, cx, cy, style, closed, side) {
  // Returns true if the shape should be stroked instead of filled.
  ctx.beginPath();
  if (style === 'happy') {
    ctx.arc(cx, cy + 0.035, 0.062, Math.PI * 1.14, Math.PI * 1.86);
    return true;
  }
  if (style === 'serene') {
    ctx.arc(cx, cy - 0.04, 0.062, Math.PI * 0.14, Math.PI * 0.86);
    return true;
  }
  if (style === 'squeeze') {
    const d = -side * 0.045; // > <
    ctx.moveTo(cx - d, cy - 0.045);
    ctx.lineTo(cx + d * 0.8, cy);
    ctx.lineTo(cx - d, cy + 0.045);
    return true;
  }
  const wide = style === 'wide';
  const rx = wide ? 0.064 : 0.053;
  const ry = (wide ? 0.097 : 0.083) * Math.max(0.09, 1 - closed);
  ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  return false;
}

function drawEyes(ctx, spec, p, colour, withHighlights) {
  const [fx, fy] = faceOffset(p);
  ctx.lineWidth = 0.036;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const side of [-1, 1]) {
    const cx = side * 0.2 + fx;
    const cy = -0.06 + fy;
    const closed = Math.max(p.blink, side === 1 ? p.wink : 0);
    // a hard blink turns any eye into a little closed line
    const style = closed > 0.6 && (p.eyes === 'open' || p.eyes === 'wide') ? 'open' : p.eyes;
    const stroked = eyeShape(ctx, cx, cy, style, closed, side);
    if (stroked) {
      ctx.strokeStyle = colour;
      ctx.stroke();
    } else {
      ctx.fillStyle = colour;
      ctx.fill();
      if (withHighlights && closed < 0.45) {
        const wide = p.eyes === 'wide';
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.beginPath();
        ctx.arc(cx - 0.016, cy - 0.034, wide ? 0.027 : 0.02, 0, TAU);
        ctx.fill();
        if (wide) {
          ctx.beginPath();
          ctx.arc(cx + 0.02, cy + 0.035, 0.012, 0, TAU);
          ctx.fill();
        }
      }
    }
  }
}

// ------------------------------------------------------------------ mouth

function drawMouth(ctx, spec, p) {
  const [fx, fy] = faceOffset(p);
  const mx = fx;
  const my = 0.17 + fy;
  let kind = p.mouth;
  if (kind === 'sing' && p.mouthOpen < 0.07) kind = 'tiny';

  if (kind === 'smile' || kind === 'tiny') {
    const w = kind === 'tiny' ? 0.055 : 0.09;
    const d = kind === 'tiny' ? 0.045 : 0.085;
    ctx.beginPath();
    ctx.moveTo(mx - w, my - 0.015);
    ctx.quadraticCurveTo(mx, my + d, mx + w, my - 0.015);
    ctx.strokeStyle = spec.eye;
    ctx.lineWidth = 0.036;
    ctx.lineCap = 'round';
    ctx.stroke();
    return;
  }
  if (kind === 'o') {
    ctx.beginPath();
    ctx.ellipse(mx, my + 0.01, 0.038, 0.048, 0, 0, TAU);
    ctx.fillStyle = spec.mouth;
    ctx.fill();
    return;
  }
  // open mouth: a soft "D" with a tongue
  const o = kind === 'grin' ? 1 : p.mouthOpen;
  const w = kind === 'grin' ? 0.118 : lerp(0.06, 0.088, o);
  const h = kind === 'grin' ? 0.13 : lerp(0.03, 0.11, o);
  const top = my - 0.02;
  ctx.beginPath();
  ctx.moveTo(mx - w, top);
  ctx.bezierCurveTo(mx - w, top + h * 1.45, mx + w, top + h * 1.45, mx + w, top);
  ctx.quadraticCurveTo(mx, top + h * 0.16, mx - w, top);
  ctx.closePath();
  ctx.fillStyle = spec.mouth;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.beginPath();
  ctx.ellipse(mx, top + h * 1.12, w * 0.62, h * 0.5, 0, 0, TAU);
  ctx.fillStyle = '#F29A8E';
  ctx.fill();
  ctx.restore();
}

// -------------------------------------------------------------------- hat

function drawHat(ctx, spec, p) {
  const hat = spec.hat;
  ctx.save();
  enterHat(ctx, spec, p);

  traceHat(ctx);
  ctx.fillStyle = hat.color;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // stripes wrap the cone: arcs centred on the tip
  ctx.strokeStyle = hat.stripe;
  ctx.lineWidth = 0.085;
  for (const rr of [0.27, 0.5, 0.73]) {
    ctx.beginPath();
    ctx.arc(0.02, -HAT_H, rr, 0, Math.PI);
    ctx.stroke();
  }
  const g = ctx.createLinearGradient(-HAT_W, 0, HAT_W, 0);
  g.addColorStop(0, 'rgba(255,255,255,0.2)');
  g.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(40,20,10,0.18)');
  ctx.fillStyle = g;
  ctx.fillRect(-0.4, -0.9, 0.8, 1.1);
  ctx.restore();

  // fluffy brim
  ctx.fillStyle = hat.brim ?? '#FFF8EA';
  for (let i = 0; i <= 6; i++) {
    const u = i / 6;
    const bx = lerp(-HAT_W, HAT_W, u);
    const by = 0.1 * 2 * u * (1 - u) + 0.004; // follows the curved base
    ctx.beginPath();
    ctx.arc(bx, by, 0.058, 0, TAU);
    ctx.fill();
  }
  // pom-pom
  ctx.fillStyle = hat.pom;
  ctx.beginPath();
  ctx.arc(0.02, -HAT_H - 0.03, 0.092, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.arc(-0.005, -HAT_H - 0.055, 0.035, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- drawing

export function drawSpark(ctx, spec, pose, time) {
  const p = { ...POSE, ...pose };
  if (p.scale <= 0.002) return;
  ctx.save();
  enter(ctx, p);

  // body
  traceBody(ctx, spec, p, time);
  ctx.fillStyle = css(spec.body);
  ctx.fill();
  ctx.save();
  ctx.clip();
  let g = ctx.createRadialGradient(-0.35, -0.45, 0.05, -0.35, -0.45, 1.5);
  g.addColorStop(0, 'rgba(255,255,255,0.28)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.05)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-1.4, -1.4, 2.8, 2.8);
  g = ctx.createLinearGradient(0, 0.05, 0, 1.1);
  g.addColorStop(0, css(spec.shade, 0));
  g.addColorStop(1, css(spec.shade, 0.34));
  ctx.fillStyle = g;
  ctx.fillRect(-1.4, -1.4, 2.8, 2.8);
  ctx.restore();

  // cheeks
  const [fx, fy] = faceOffset(p);
  const puff = 1 + p.puff * 0.55;
  ctx.fillStyle = css(spec.blush, Math.min(1, 0.5 + p.blush * 0.42));
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * (0.325 + p.puff * 0.02) + fx, 0.115 + fy, 0.078 * puff, 0.052 * puff, 0, 0, TAU);
    ctx.fill();
  }

  drawEyes(ctx, spec, p, spec.eye, true);
  drawMouth(ctx, spec, p);
  if (p.hat && spec.hat) drawHat(ctx, spec, p);
  ctx.restore();
}

/** Just the eyes, in a glowing colour — for when the lights are out. */
export function drawSparkEyes(ctx, spec, pose, colour) {
  const p = { ...POSE, ...pose };
  if (p.scale <= 0.002) return;
  ctx.save();
  enter(ctx, p);
  drawEyes(ctx, spec, p, colour, false);
  ctx.restore();
}

/** Traces body + hat outline (in world space) as the current path, for shadows. */
export function traceSparkSilhouette(ctx, spec, pose, time) {
  const p = { ...POSE, ...pose };
  ctx.save();
  enter(ctx, p);
  traceBody(ctx, spec, p, time);
  if (p.hat && spec.hat) {
    enterHat(ctx, spec, p);
    hatOutline(ctx);
    ctx.moveTo(0.02 + 0.092, -HAT_H - 0.03);
    ctx.arc(0.02, -HAT_H - 0.03, 0.092, 0, TAU);
    ctx.closePath();
    for (let i = 0; i <= 6; i++) {
      const u = i / 6;
      const bx = lerp(-HAT_W, HAT_W, u);
      const by = 0.2 * u * (1 - u) + 0.004;
      ctx.moveTo(bx + 0.058, by);
      ctx.arc(bx, by, 0.058, 0, TAU);
      ctx.closePath();
    }
  }
  ctx.restore();
}
