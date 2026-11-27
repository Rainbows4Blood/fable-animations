// Synthesises the soundtrack off the main thread for the live preview.
import { renderAudio } from './src/audio.js';

self.onmessage = (e) => {
  const audio = renderAudio({ sampleRate: e.data.sampleRate });
  self.postMessage(audio, audio.channels.map((c) => c.buffer));
};
