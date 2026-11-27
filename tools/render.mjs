#!/usr/bin/env node
// Renders an animation folder to MP4 (or to PNG stills / a contact sheet).
//
//   node tools/render.mjs <animation-dir> [options]
//
//   --out <file>            output file (default: renders/<id>.mp4)
//   --suffix <text>         appended to the default file name, e.g. --suffix -4k
//   --scale <n>             resolution multiplier: 1 = 1920x1080 (default), 2 = 4K
//   --fps <n>               frames per second (default: the animation's own)
//   --from <s> --to <s>     render only part of the timeline
//   --crf <n>               x264 quality: lower = better and bigger (default 20)
//   --preset <name>         x264 preset (default slow)
//   --no-audio              skip the soundtrack
//   --audio-only            write just the soundtrack (WAV) and stop
//   --no-credit             leave out the "animated by" line
//   --grain <0..1>          strength of the paper-grain overlay (default 1; --no-grain = 0)
//   --still <t[,t,...]>     write PNG stills at these times instead of a video
//   --sheet <from:to:step>  write a contact sheet PNG of a time range (or of a list: --sheet 1,2.5,8)
//   --out-dir <dir>         where stills / sheets go (default: .cache/stills)
//
// Needs ffmpeg on the PATH for video output.

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) args._.push(a);
    else if (a.startsWith('--no-')) args[a.slice(5)] = false;
    else if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) args[a.slice(2)] = true;
    else args[a.slice(2)] = argv[++i];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args._[0]) {
  console.error('usage: node tools/render.mjs <animation-dir> [--out file.mp4] [--scale 2] [--still 1.5,12] [--sheet 0:24:1]');
  process.exit(1);
}

const dir = path.resolve(ROOT, args._[0]);
const entry = path.join(dir, 'animation.js');
if (!existsSync(entry)) {
  console.error(`No animation.js in ${dir}`);
  process.exit(1);
}
const mod = await import(pathToFileURL(entry).href);
const { meta } = mod;

for (const f of mod.fonts ?? []) {
  if (!GlobalFonts.registerFromPath(fileURLToPath(f.url), f.family)) {
    console.error(`Could not load font ${f.url}`);
    process.exit(1);
  }
}

const scale = Number(args.scale ?? 1);
const fps = Number(args.fps ?? meta.fps);
const options = { credit: args.credit !== false, grain: args.grain === false ? 0 : Number(args.grain ?? 1) };

function makeStage(s) {
  const canvas = createCanvas(Math.round(meta.width * s), Math.round(meta.height * s));
  const ctx = canvas.getContext('2d');
  const anim = mod.createAnimation({ createCanvas, scale: s }, options);
  return {
    canvas,
    ctx,
    draw(t) {
      ctx.setTransform(s, 0, 0, s, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      anim.draw(ctx, t);
    },
  };
}

const stamp = (t) => t.toFixed(2).padStart(5, '0');

// ------------------------------------------------------------------ stills
if (args.still !== undefined) {
  const outDir = path.resolve(ROOT, args['out-dir'] ?? '.cache/stills');
  mkdirSync(outDir, { recursive: true });
  const stage = makeStage(scale);
  for (const t of String(args.still).split(',').map(Number)) {
    stage.draw(t);
    const file = path.join(outDir, `${meta.id}-${stamp(t)}.png`);
    writeFileSync(file, stage.canvas.toBuffer('image/png'));
    console.log(file);
  }
  process.exit(0);
}

// ----------------------------------------------------------- contact sheet
if (args.sheet !== undefined) {
  // either from:to:step or an explicit list of times: 1,2.5,8
  const spec = String(args.sheet);
  const times = [];
  if (spec.includes(':')) {
    const [a, b, step] = spec.split(':').map(Number);
    for (let t = a; t <= b + 1e-9; t += step) times.push(Math.round(t * 1000) / 1000);
  } else {
    times.push(...spec.split(',').map(Number));
  }
  const from = times[0];
  const to = times[times.length - 1];
  const cols = Number(args.cols ?? 4);
  const s = Number(args['sheet-scale'] ?? 0.25);
  const cw = Math.round(meta.width * s);
  const ch = Math.round(meta.height * s);
  const rows = Math.ceil(times.length / cols);
  const stage = makeStage(s);
  const sheet = createCanvas(cols * cw, rows * ch);
  const sctx = sheet.getContext('2d');
  sctx.fillStyle = '#111';
  sctx.fillRect(0, 0, sheet.width, sheet.height);
  sctx.font = '15px sans-serif';
  times.forEach((t, i) => {
    stage.draw(t);
    const x = (i % cols) * cw;
    const y = Math.floor(i / cols) * ch;
    sctx.drawImage(stage.canvas, x, y);
    sctx.fillStyle = 'rgba(0,0,0,0.65)';
    sctx.fillRect(x, y, 58, 22);
    sctx.fillStyle = '#fff';
    sctx.fillText(`${t.toFixed(2)}s`, x + 6, y + 16);
  });
  const outDir = path.resolve(ROOT, args['out-dir'] ?? '.cache/stills');
  mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${meta.id}-sheet-${stamp(from)}-${stamp(to)}.png`);
  writeFileSync(file, sheet.toBuffer('image/png'));
  console.log(file);
  process.exit(0);
}

// ------------------------------------------------------------------- audio
if (args['audio-only']) {
  const file = path.resolve(ROOT, args.out ?? `renders/${meta.id}.wav`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, encodeWav(mod.renderAudio({ sampleRate: 48000 }), 0, meta.duration));
  console.log(file);
  process.exit(0);
}

// ------------------------------------------------------------------- video
const from = Number(args.from ?? 0);
const to = Number(args.to ?? meta.duration);
const firstFrame = Math.round(from * fps);
const frameCount = Math.round((to - from) * fps);
const out = path.resolve(ROOT, args.out ?? `renders/${meta.id}${args.suffix ?? ''}.mp4`);
mkdirSync(path.dirname(out), { recursive: true });
mkdirSync(path.join(ROOT, '.cache'), { recursive: true });

// soundtrack → WAV
let wavFile = null;
if (args.audio !== false && typeof mod.renderAudio === 'function') {
  const t0 = performance.now();
  const audio = mod.renderAudio({ sampleRate: 48000 });
  wavFile = path.join(ROOT, '.cache', `${meta.id}.wav`);
  writeFileSync(wavFile, encodeWav(audio, from, to));
  console.log(`audio   ${path.relative(ROOT, wavFile)}  (${((performance.now() - t0) / 1000).toFixed(1)}s)`);
}

const crf = Number(args.crf ?? 20);
const stage = makeStage(scale);
const size = `${stage.canvas.width}x${stage.canvas.height}`;
const fitsLevel42 = crf > 0 && stage.canvas.width * stage.canvas.height <= 1920 * 1088 && fps <= 60;
const ff = [
  '-y', '-hide_banner', '-loglevel', 'error',
  '-f', 'rawvideo', '-pixel_format', 'rgba', '-video_size', size, '-framerate', String(fps), '-i', 'pipe:0',
  ...(wavFile ? ['-i', wavFile] : []),
  // RGB → BT.709 limited-range YUV, tagged as such, so colours match everywhere
  '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv',
  '-c:v', 'libx264', '-preset', String(args.preset ?? 'slow'), '-crf', String(crf), ...(crf > 0 ? ['-profile:v', 'high'] : []),
  '-x264-params', 'aq-mode=3', '-g', String(Math.round(fps * 2)), // aq-mode 3 protects dark gradients from banding
  ...(fitsLevel42 ? ['-level:v', '4.2'] : []), // the level every phone, TV and browser can decode
  '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
  ...(wavFile ? ['-c:a', 'aac', '-b:a', '160k'] : []),
  '-movflags', '+faststart', '-shortest', out,
];
const ffmpeg = spawn('ffmpeg', ff, { stdio: ['pipe', 'inherit', 'inherit'] });
ffmpeg.on('error', (err) => {
  console.error(`Could not start ffmpeg (${err.message}). Is it installed and on the PATH?`);
  process.exit(1);
});
let ffmpegGone = false;
const done = once(ffmpeg, 'close').then((result) => {
  ffmpegGone = true;
  return result;
});
ffmpeg.stdin.on('error', () => {}); // if ffmpeg quits early, its exit code (below) tells the story

console.log(`video   ${size} @ ${fps}fps, ${frameCount} frames`);
const started = performance.now();
for (let i = 0; i < frameCount && !ffmpegGone; i++) {
  stage.draw((firstFrame + i) / fps);
  if (!ffmpeg.stdin.write(stage.canvas.data())) await Promise.race([once(ffmpeg.stdin, 'drain'), done]);
  if (i % 60 === 59 || i === frameCount - 1) {
    const el = (performance.now() - started) / 1000;
    process.stdout.write(`\rframes  ${i + 1}/${frameCount}  ${((i + 1) / el).toFixed(1)} fps   `);
  }
}
ffmpeg.stdin.end();
const [code] = await done;
process.stdout.write('\n');
if (code !== 0) {
  console.error(`ffmpeg exited with code ${code}`);
  process.exit(code ?? 1);
}
console.log(`done    ${path.relative(ROOT, out)}  (${((performance.now() - started) / 1000).toFixed(1)}s)`);

/** 16-bit PCM WAV of the [from, to] slice. */
function encodeWav({ sampleRate, channels }, fromSec, toSec) {
  const a = Math.round(fromSec * sampleRate);
  const b = Math.min(channels[0].length, Math.round(toSec * sampleRate));
  const frames = Math.max(0, b - a);
  const buf = Buffer.alloc(44 + frames * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + frames * 4, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(2, 22); // stereo
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(frames * 4, 40);
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < 2; c++) {
      const v = Math.max(-1, Math.min(1, channels[c][a + i]));
      buf.writeInt16LE(Math.round(v * 32767), 44 + i * 4 + c * 2);
    }
  }
  return buf;
}
