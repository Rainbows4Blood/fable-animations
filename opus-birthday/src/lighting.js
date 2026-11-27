// 2D lighting: a small "light map" (ambient colour + soft radial lights) that is
// multiplied over the finished scene. White = fully lit, dark = night.

import { css } from './util.js';
import { W, H } from './theme.js';

const LM_W = 480;
const LM_H = 270;

export function createLighting(env) {
  const map = env.createCanvas(LM_W, LM_H);
  const l = map.getContext('2d');
  const k = LM_W / W;

  return {
    /**
     * @param ctx     main context, in stage (screen) space
     * @param ambient [r, g, b] colour of unlit areas
     * @param lights  [{x, y, radius, intensity}] in stage coordinates
     */
    apply(ctx, ambient, lights) {
      l.globalCompositeOperation = 'source-over';
      l.fillStyle = css(ambient);
      l.fillRect(0, 0, LM_W, LM_H);
      l.globalCompositeOperation = 'lighter';
      for (const light of lights) {
        const i = light.intensity;
        if (i <= 0.003) continue;
        const x = light.x * k;
        const y = light.y * k;
        const r = light.radius * k;
        const g = l.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(255,240,206,${i})`);
        g.addColorStop(0.13, `rgba(255,222,160,${0.95 * i})`);
        g.addColorStop(0.34, `rgba(255,186,100,${0.68 * i})`);
        g.addColorStop(0.64, `rgba(236,126,54,${0.28 * i})`);
        g.addColorStop(1, 'rgba(180,70,20,0)');
        l.fillStyle = g;
        l.fillRect(0, 0, LM_W, LM_H);
      }
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(map, 0, 0, W, H);
      ctx.restore();
    },
  };
}
