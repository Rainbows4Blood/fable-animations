// Live preview: plays the animation in the browser, in real time, with sound.
// Open via `npm run preview` (ES modules need http://, not file://).
// Add ?t=12.5 to the URL to open on a particular frame.

import { meta, fonts, createAnimation } from './animation.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const playBtn = document.getElementById('play');
const muteBtn = document.getElementById('mute');
const seek = document.getElementById('seek');
const timeLabel = document.getElementById('time');
const status = document.getElementById('status');

const createCanvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
const clock = () => performance.now() / 1000;

let anim = null;
let scale = 1;
let time = Math.min(meta.duration, Math.max(0, Number(new URLSearchParams(location.search).get('t')) || 0));
let playing = false;
let muted = false;
let startedAt = 0; // wall-clock time at which playback (re)started...
let startOffset = 0; // ...and where in the film that was

// ---------------------------------------------------------------- audio
// The picture follows the wall clock; the soundtrack is started at the matching offset.
let audioCtx = null;
let audioBuffer = null;
let source = null;
let gain = null;
let pcm = null; // {sampleRate, channels} once the worker has synthesised the soundtrack

const worker = new Worker(new URL('./audio-worker.js', import.meta.url), { type: 'module' });
worker.onmessage = (e) => {
  pcm = e.data;
  status.textContent = '';
  if (playing) startAudio(); // soundtrack arrived mid-playback: join in
};
worker.onerror = () => {
  status.textContent = 'soundtrack unavailable — playing silently';
};

/** Must be called from a click / key press, or the browser keeps the audio suspended. */
function unlockAudio() {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    gain = audioCtx.createGain();
    gain.connect(audioCtx.destination);
  }
  audioCtx.resume();
}

function startAudio() {
  stopAudio();
  if (!pcm || !audioCtx) return;
  if (!audioBuffer) {
    audioBuffer = audioCtx.createBuffer(2, pcm.channels[0].length, pcm.sampleRate);
    audioBuffer.copyToChannel(pcm.channels[0], 0);
    audioBuffer.copyToChannel(pcm.channels[1], 1);
  }
  const at = startOffset + (clock() - startedAt);
  if (at >= meta.duration - 0.02) return;
  gain.gain.value = muted ? 0 : 1;
  source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(gain);
  source.start(0, Math.max(0, at));
}

function stopAudio() {
  if (!source) return;
  try {
    source.stop();
  } catch {
    /* already stopped */
  }
  source.disconnect();
  source = null;
}

// -------------------------------------------------------------- playback
function play() {
  if (time >= meta.duration - 0.02) time = 0;
  playing = true;
  playBtn.textContent = 'Pause';
  startOffset = time;
  startedAt = clock();
  unlockAudio();
  startAudio();
  requestAnimationFrame(tick);
}

function pause() {
  playing = false;
  playBtn.textContent = 'Play';
  stopAudio();
}

function seekTo(t) {
  time = Math.min(meta.duration, Math.max(0, t));
  if (playing) {
    startOffset = time;
    startedAt = clock();
    startAudio();
  }
  render();
}

function tick() {
  if (!playing) return;
  time = startOffset + (clock() - startedAt);
  if (time >= meta.duration) {
    time = meta.duration;
    render();
    pause();
    return;
  }
  render();
  requestAnimationFrame(tick);
}

function render() {
  if (!anim) return;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  anim.draw(ctx, time);
  seek.value = String(time);
  timeLabel.textContent = `${time.toFixed(2)} / ${meta.duration.toFixed(2)}`;
}

// --------------------------------------------------------------- sizing
function resize() {
  const cssWidth = canvas.getBoundingClientRect().width || meta.width;
  const next = Math.min(2, Math.max(0.25, (cssWidth * (window.devicePixelRatio || 1)) / meta.width));
  if (anim && Math.abs(next - scale) < 0.01) return;
  scale = next;
  canvas.width = Math.round(meta.width * scale);
  canvas.height = Math.round(meta.height * scale);
  anim = createAnimation({ createCanvas, scale });
  render();
}

// ------------------------------------------------------------------- UI
const toggle = () => (playing ? pause() : play());
playBtn.addEventListener('click', toggle);
canvas.addEventListener('click', toggle);
muteBtn.addEventListener('click', () => {
  muted = !muted;
  muteBtn.textContent = muted ? 'Sound off' : 'Sound on';
  if (gain) gain.gain.value = muted ? 0 : 1;
});
seek.addEventListener('input', () => seekTo(Number(seek.value)));
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    if (e.target instanceof HTMLButtonElement) return; // the focused button handles its own space bar
    e.preventDefault();
    toggle();
    return;
  }
  const step = e.shiftKey ? 1 : 1 / meta.fps;
  if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
    if (e.target === seek) return; // the slider handles its own arrow keys
    pause();
    seekTo(time + (e.code === 'ArrowRight' ? step : -step));
  } else if (e.code === 'Home') {
    seekTo(0);
  }
});
window.addEventListener('resize', resize);

// ----------------------------------------------------------------- boot
seek.max = String(meta.duration);
document.title = `${meta.title} — live preview`;
await Promise.all(
  fonts.map(async (f) => {
    const face = new FontFace(f.family, `url("${f.url}")`);
    document.fonts.add(await face.load());
  }),
);
resize();
status.textContent = 'synthesising the soundtrack…';
worker.postMessage({ sampleRate: 48000 });
// lets automated checks know the first frame is on screen
document.documentElement.dataset.ready = 'true';
