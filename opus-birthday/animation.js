// Entry point of the animation. Both the MP4 renderer (tools/render.mjs, Node)
// and the live preview (index.html, browser) load this same module.

import { W, H, FONT_FILES } from './src/theme.js';
import { FPS, DURATION } from './src/timeline.js';
import { createScene } from './src/scene.js';
import { BIRTHDAY, SLUG } from './src/config.js';

export { renderAudio } from './src/audio.js';

export const meta = {
  id: SLUG, // names the output file: renders/<id>.mp4
  title: `${BIRTHDAY.model} turns one`,
  width: W,
  height: H,
  fps: FPS,
  duration: DURATION,
};

/** Typefaces the scene needs: [{family, url}]. */
export const fonts = FONT_FILES.map((f) => ({
  family: f.family,
  url: new URL(`../assets/fonts/${f.file}`, import.meta.url).href,
}));

/**
 * @param env {createCanvas(w, h), scale} — a canvas factory for off-screen
 *            buffers, and how many device pixels one stage pixel covers.
 * @param options {credit: boolean, grain: number} — show the "animated by" line at the end;
 *                strength of the paper-grain overlay (0 = none, 1 = default).
 * @returns {draw(ctx, t)} — paints the frame for time t (seconds) onto ctx,
 *          which must already be scaled so the stage is 1920x1080 units.
 */
export function createAnimation(env, options) {
  return createScene(env, options);
}
