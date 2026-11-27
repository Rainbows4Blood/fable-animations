// Everything typographic, drawn in stage space on top of the scene:
// titles, sing-along lyrics, the "Wishing…" status line and the credits.

import { TAU, clamp, lerp, smoothstep, ease, css, mix, bump } from './util.js';
import { W, H, C, FONT, font } from './theme.js';
import { T, LINES } from './timeline.js';
import { BIRTHDAY } from './config.js';

/** A tiny spark glyph (the bouncing ball of the sing-along, the spinner of the status line). */
export function miniSpark(ctx, x, y, r, rot, colour, rays = 8, weight = 0.3) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.strokeStyle = colour;
  ctx.lineWidth = r * weight;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let k = 0; k < rays / 2; k++) {
    const a = (k * TAU) / rays;
    ctx.moveTo(-Math.cos(a) * r, -Math.sin(a) * r);
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.stroke();
  ctx.restore();
}

function heart(ctx, x, y, s, colour) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.35, y - s * 0.05, x - s * 0.62, y - s * 1.05, x, y - s * 0.32);
  ctx.bezierCurveTo(x + s * 0.62, y - s * 1.05, x + s * 1.35, y - s * 0.05, x, y + s * 0.9);
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.fill();
}

// ------------------------------------------------------------ intro title

export function drawIntroTitle(ctx, t) {
  const out = smoothstep(T.titleOut, T.titleOut + 0.32, t);
  if (out >= 1) return;
  ctx.save();
  ctx.globalAlpha = 1 - out;
  ctx.translate(0, -16 * ease.inCubic(out));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  ctx.font = font(FONT.mono, 22);
  ctx.letterSpacing = '7px';
  ctx.fillStyle = css(C.ink, 0.56);
  ctx.fillText(`EST. ${BIRTHDAY.born.toUpperCase()}`, W / 2 + 3.5, 236);
  ctx.letterSpacing = '0px';

  ctx.font = font(FONT.display, 110);
  ctx.fillStyle = C.ink;
  ctx.fillText(BIRTHDAY.model, W / 2, 340);

  ctx.font = font(FONT.italic, 64);
  const [before, word, after] = BIRTHDAY.tagline;
  const tag = before + word + after;
  ctx.fillStyle = '#CF6A48';
  ctx.fillText(tag, W / 2, 420);

  // a hand-drawn swash under the key word ("one")
  const u = ease.outCubic(clamp((t - 0.95) / 0.45));
  if (u > 0) {
    const wordW = ctx.measureText(word).width;
    const x0 = W / 2 - ctx.measureText(tag).width / 2 + ctx.measureText(before + word).width - wordW - 6;
    const w = wordW + 12;
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const s = (i / 24) * u;
      const px = x0 + w * s;
      const py = 440 - 5 * Math.sin(s * Math.PI) + 2.2 * Math.sin(s * 9);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 5.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Name tags for the guests.
 * @param guests [{name, t0, x, y, r, side}] — on-screen centre + radius; side: which way the tag sits
 */
export function drawGuestLabels(ctx, t, guests) {
  for (const g of guests) {
    const tIn = g.t0 + 0.34;
    const a = clamp((t - tIn) / 0.2) * (1 - smoothstep(T.titleOut - 0.1, T.titleOut + 0.2, t));
    if (a <= 0) continue;
    const s = ease.outBack(clamp((t - tIn) / 0.32));
    const lx = g.x + g.side * g.r * 1.28;
    const ly = g.y - g.r * 1.62;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(lx, ly);
    ctx.scale(s, s);
    ctx.rotate(g.side * 0.05);
    ctx.font = font(FONT.italic, 40);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = css(C.ink, 0.86);
    ctx.fillText(g.name, 0, 0);
    // little arrow curling back toward the guest
    const ex = -g.side * g.r * 0.62;
    const ey = g.r * 0.5 + 16;
    ctx.beginPath();
    ctx.moveTo(-g.side * 10, 15);
    ctx.quadraticCurveTo(-g.side * 6, ey * 0.75, ex, ey);
    ctx.moveTo(ex + g.side * 15, ey - 3);
    ctx.lineTo(ex, ey);
    ctx.lineTo(ex + g.side * 5, ey - 15);
    ctx.strokeStyle = css(C.ink, 0.7);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
  }
}

// ------------------------------------------------------------- sing-along

const KARAOKE_Y = 1012;
const KARAOKE_SIZE = 56;
const layouts = new Map();

function layoutLine(ctx, li) {
  if (layouts.has(li)) return layouts.get(li);
  const line = LINES[li];
  ctx.font = font(FONT.italic, KARAOKE_SIZE);
  const total = ctx.measureText(line.text).width;
  let idx = 0;
  const syl = line.notes.map((n) => {
    const str = n.syl.trimStart();
    const start = idx + (n.syl.length - str.length);
    idx += n.syl.length;
    return { str, x: ctx.measureText(line.text.slice(0, start)).width, w: ctx.measureText(str).width, t: n.t };
  });
  const layout = { total, syl };
  layouts.set(li, layout);
  return layout;
}

/**
 * Lyrics that light up syllable by syllable, with a spark hopping along.
 * @param dark 0 in the lit room .. 1 in candlelight (switches the colour scheme)
 * @param ds   device pixels per stage pixel (glow radii are in device pixels)
 */
export function drawKaraoke(ctx, t, dark, ds) {
  const endOfSong = LINES[LINES.length - 1].end;
  const presence = smoothstep(T.song - 0.45, T.song - 0.15, t) * (1 - smoothstep(endOfSong - 0.3, endOfSong, t));
  if (presence <= 0) return;

  // a soft band keeps the words readable over whatever is behind them
  ctx.save();
  const g = ctx.createLinearGradient(0, 925, 0, H);
  g.addColorStop(0, 'rgba(12,8,20,0)');
  g.addColorStop(0.4, css([12, 8, 20], 0.62 * dark * presence));
  g.addColorStop(1, css([12, 8, 20], 0.84 * dark * presence));
  ctx.fillStyle = g;
  ctx.fillRect(0, 925, W, H - 925);
  let li = -1;
  for (let i = 0; i < LINES.length; i++) if (t >= LINES[i].start - 0.32) li = i;
  if (li < 0) {
    ctx.restore();
    return;
  }
  const line = LINES[li];
  const next = LINES[li + 1];
  const tOut = next ? next.start - 0.32 : endOfSong - 0.08;
  const a = smoothstep(line.start - 0.32, line.start - 0.1, t) * (1 - smoothstep(tOut - 0.16, tOut, t));
  const L = layoutLine(ctx, li);
  const x0 = W / 2 - L.total / 2;

  const unsung = mix(C.ink, '#FFF3DC', dark);
  const unsungA = lerp(0.36, 0.46, dark);
  const sung = mix('#C6512E', '#FFD27A', dark);

  ctx.font = font(FONT.italic, KARAOKE_SIZE);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  for (const s of L.syl) {
    const p = clamp((t - s.t) / 0.09);
    const b = bump(t, s.t, 0.26);
    ctx.save();
    ctx.translate(x0 + s.x + s.w / 2, KARAOKE_Y - 7 * b);
    ctx.scale(1 + 0.06 * b, 1 + 0.06 * b);
    if (p > 0 && dark > 0.05) {
      ctx.shadowColor = css('#FFB45A', 0.55 * p * dark * a);
      ctx.shadowBlur = 16 * ds;
    }
    ctx.fillStyle = css(mix(unsung, sung, p), lerp(unsungA, 1, p) * a);
    ctx.fillText(s.str, -s.w / 2, 0);
    ctx.restore();
  }

  // the bouncing spark
  const S = L.syl;
  const mid = (s) => x0 + s.x + s.w / 2;
  const restY = KARAOKE_Y - 64;
  let bx;
  let lift = 0;
  let ba = a;
  let squash = 0;
  if (t < S[0].t) {
    const u = clamp((t - (S[0].t - 0.3)) / 0.3);
    bx = mid(S[0]);
    lift = 90 * (1 - ease.inQuad(u));
    ba *= u;
  } else {
    let i = 0;
    while (i + 1 < S.length && S[i + 1].t <= t) i++;
    const cur = S[i];
    const nxt = S[i + 1];
    if (nxt) {
      const dt = nxt.t - cur.t;
      const u = (t - cur.t) / dt;
      bx = lerp(mid(cur), mid(nxt), u);
      lift = clamp(74 * dt ** 0.6, 16, 66) * 4 * u * (1 - u);
    } else {
      const u = t - cur.t;
      bx = mid(cur);
      lift = 18 * Math.abs(Math.sin((u * Math.PI) / 0.5)) * Math.exp(-u * 1.7);
    }
    squash = Math.exp(-(t - cur.t) / 0.05);
  }
  if (ba > 0.01) {
    ctx.save();
    ctx.globalAlpha = ba;
    ctx.translate(bx, restY - lift);
    if (dark > 0.05) {
      // a little pool of shadow so the spark reads against the candle-lit tablecloth
      const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, 34);
      halo.addColorStop(0, css([12, 8, 20], 0.34 * dark));
      halo.addColorStop(1, css([12, 8, 20], 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, 34, 0, TAU);
      ctx.fill();
    }
    ctx.scale(1 + 0.25 * squash, 1 - 0.3 * squash);
    if (dark > 0.05) {
      ctx.shadowColor = css('#FFB45A', 0.8 * dark);
      ctx.shadowBlur = 14 * ds;
    }
    miniSpark(ctx, 0, 0, 14, bx * 0.018, css(mix(C.clay, '#FFD27A', dark)), 8, 0.34);
    ctx.restore();
  }
  ctx.restore();
}

// ------------------------------------------------------- "Wishing…" pill

/**
 * A terminal-style status line above the birthday model while it makes its wish.
 * (ax, ay) is the on-screen point just above the party hat.
 */
export function drawWishPill(ctx, t, ax, ay) {
  const tIn = T.wish + 0.3;
  const tOut = T.wishDone + 0.5;
  if (t < tIn || t > tOut + 0.25) return;
  const done = t >= T.wishDone;
  const secs = Math.floor(Math.min(t, T.wishDone) - tIn);
  const grow = ease.outBack(clamp((t - tIn) / 0.34));
  const leave = clamp((t - tOut) / 0.25);
  const alpha = clamp((t - tIn) / 0.12) * (1 - leave);
  const size = 30;

  ctx.save();
  ctx.font = font(FONT.mono, size);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const cw = ctx.measureText('M').width;
  const main = done ? `Wished for ${secs}s` : 'Wishing…';
  const rest = done ? '' : ` (${secs}s · esc to interrupt)`;
  const padX = 28;
  const sparkW = 42;
  const h = 68;
  const w = padX * 2 + sparkW + (main.length + rest.length) * cw;
  const px = clamp(ax - w * 0.42, 36, W - 36 - w);
  const py = ay - h - 54;

  ctx.globalAlpha = alpha;
  // scale about the point the thought comes from
  ctx.translate(ax, ay);
  ctx.scale(grow * (1 - 0.2 * leave), grow * (1 - 0.2 * leave));
  ctx.translate(-ax, -ay);

  const bg = 'rgba(31,28,26,0.95)';
  // thought-bubble dots
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(ax - 4, ay - 8, 6.5, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ax + 8, ay - 31, 10.5, 0, TAU);
  ctx.fill();
  // pill
  ctx.beginPath();
  ctx.roundRect(px, py, w, h, 22);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // spinner
  const sx = px + padX + 14;
  const sy = py + h / 2;
  const pulse = done ? 0 : 0.5 + 0.5 * Math.sin(t * 9);
  miniSpark(ctx, sx, sy, 12 + 3 * pulse, done ? 0.2 : t * 2.4, done ? '#A8A297' : C.clay, 8, 0.3);

  // text, with a shimmer running through "Wishing…"
  let x = px + padX + sparkW;
  const sweep = ((t * 0.85) % 1.5) * (main.length + 5) - 2.5;
  for (let i = 0; i < main.length; i++) {
    const glint = done ? 0 : Math.exp(-(((i - sweep) / 1.7) ** 2));
    ctx.fillStyle = done ? '#CFC8BB' : css(mix(C.clay, '#FFE1D0', glint));
    ctx.fillText(main[i], x, sy + 1);
    x += cw;
  }
  ctx.fillStyle = '#8F897E';
  ctx.fillText(rest, x, sy + 1);
  ctx.restore();
}

// -------------------------------------------------------------- end title

let endLayout = null;
const END_A = 'Happy 1st Birthday,';
const END_B = BIRTHDAY.model;

function layoutEnd(ctx) {
  if (endLayout) return endLayout;
  ctx.font = font(FONT.italic, 70);
  const aTotal = ctx.measureText(END_A).width;
  const words = [];
  let idx = 0;
  for (const word of END_A.split(' ')) {
    words.push({ str: word, x: ctx.measureText(END_A.slice(0, idx)).width, w: ctx.measureText(word).width });
    idx += word.length + 1;
  }
  ctx.font = font(FONT.display, 144);
  const bTotal = ctx.measureText(END_B).width;
  const letters = [];
  for (let i = 0; i < END_B.length; i++) {
    if (END_B[i] === ' ') continue;
    letters.push({ ch: END_B[i], x: ctx.measureText(END_B.slice(0, i)).width, w: ctx.measureText(END_B[i]).width, i });
  }
  endLayout = { aTotal, words, bTotal, letters };
  return endLayout;
}

export function drawEndTitle(ctx, t, credit = true) {
  const t0 = T.lightsOn + 0.3;
  if (t < t0) return;
  const L = layoutEnd(ctx);
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // "Happy 1st Birthday," — word by word
  ctx.font = font(FONT.italic, 70);
  ctx.fillStyle = C.ink;
  L.words.forEach((word, i) => {
    const u = clamp((t - t0 - i * 0.1) / 0.42);
    if (u <= 0) return;
    ctx.globalAlpha = clamp(u * 3);
    ctx.fillText(word.str, W / 2 - L.aTotal / 2 + word.x, 252 + 30 * (1 - ease.softBack(u)));
  });

  // the name — letter by letter, then a gentle wave
  ctx.font = font(FONT.display, 144);
  const xB = W / 2 - L.bTotal / 2;
  const yB = 388;
  for (const l of L.letters) {
    const tl = t0 + 0.24 + l.i * 0.04;
    const u = clamp((t - tl) / 0.44);
    if (u <= 0) continue;
    const s = lerp(0.3, 1, ease.outBack(u));
    const wave = 5 * Math.sin(TAU * 0.5 * (t - tl) - l.i * 0.55) * smoothstep(0.5, 1.3, t - tl);
    ctx.save();
    ctx.globalAlpha = clamp(u * 4);
    ctx.translate(xB + l.x + l.w / 2, yB + wave);
    ctx.rotate((1 - ease.outCubic(u)) * 0.3 * (l.i % 2 ? 1 : -1));
    ctx.scale(s, s);
    ctx.fillStyle = '#A9492E';
    ctx.fillText(l.ch, -l.w / 2, 7);
    ctx.fillStyle = C.clay;
    ctx.fillText(l.ch, -l.w / 2, 0);
    ctx.restore();
  }

  // small print
  const ac = smoothstep(t0 + 1.2, t0 + 1.7, t);
  if (ac > 0) {
    ctx.globalAlpha = ac;
    ctx.textAlign = 'center';
    ctx.font = font(FONT.mono, 22);
    ctx.letterSpacing = '6px';
    ctx.fillStyle = css(C.ink, 0.6);
    ctx.fillText('365 DAYS  ·  COUNTLESS TOKENS  ·  1 CANDLE', W / 2 + 3, 446 + 8 * (1 - ease.outCubic(ac)));
    ctx.letterSpacing = '0px';
  }

  // credit
  const ad = credit ? smoothstep(t0 + 2.3, t0 + 2.9, t) : 0;
  if (ad > 0) {
    ctx.globalAlpha = ad;
    ctx.font = font(FONT.mono, 17);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const left = 'ANIMATED WITH';
    const right = 'BY CLAUDE FABLE 5.2';
    const sp = 3;
    const cw = ctx.measureText('M').width + sp;
    const heartW = 34;
    const total = (left.length + right.length) * cw + heartW;
    const x = 640 - total / 2; // left of the cake trolley
    const y = 1056;
    ctx.fillStyle = 'rgba(250,246,238,0.86)';
    ctx.beginPath();
    ctx.roundRect(x - 20, y - 16, total + 40 - sp, 32, 16);
    ctx.fill();
    ctx.letterSpacing = `${sp}px`;
    ctx.fillStyle = css(C.ink, 0.7);
    ctx.fillText(left, x, y + 1);
    ctx.fillText(right, x + left.length * cw + heartW, y + 1);
    ctx.letterSpacing = '0px';
    const beat = 1 + 0.16 * Math.max(0, Math.sin(t * 5.2)) ** 6;
    heart(ctx, x + left.length * cw + heartW / 2 - sp / 2, y - 1, 7.5 * beat, C.clay);
  }
  ctx.restore();
}
