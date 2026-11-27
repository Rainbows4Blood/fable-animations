// The clock everything follows: story beats, the song, and helpers to read them.
// Both the picture (scene.js) and the soundtrack (audio.js) are driven from here,
// which is what keeps them in sync.

export const FPS = 60;
export const DURATION = 24;

/** Seconds per beat of the song (120 bpm, in 3/4). */
export const BEAT = 0.5;

export const T = {
  hatDrop: 0.22, // party hat starts falling
  hatLand: 0.62,
  song: 1.0, // first pickup note ("Hap-")
  haikuIn: 0.8,
  sonnetIn: 0.96,
  titleOut: 3.25,
  lightsOff: 3.72,
  cartIn: 4.3, // cake rolls in from the right...
  cartStop: 6.2, // ...and parks
  wish: 13.35, // eyes close, "Wishing…"
  wishDone: 16.0,
  inhale: 16.3,
  blow: 16.85,
  flameOut: 17.2,
  lightsOn: 18.5, // party!
  reprise: 19.0,
  end: DURATION,
};

// ---------------------------------------------------------------- the song
// "Happy Birthday to You" (public domain), in C, melody in the music-box octave.
// Each note: [beat, length in beats, MIDI note, syllable].

const G = 79, A = 81, B = 83, C2 = 84, D2 = 86, E2 = 88, F2 = 89, G2 = 91;

const SONG = [
  { text: 'Happy birthday to you', notes: [[0, 0.75, G, 'Hap'], [0.75, 0.25, G, 'py'], [1, 1, A, ' birth'], [2, 1, G, 'day'], [3, 1, C2, ' to'], [4, 2, B, ' you']] },
  { text: 'Happy birthday to you', notes: [[6, 0.75, G, 'Hap'], [6.75, 0.25, G, 'py'], [7, 1, A, ' birth'], [8, 1, G, 'day'], [9, 1, D2, ' to'], [10, 2, C2, ' you']] },
  { text: 'Happy birthday, dear Opus', notes: [[12, 0.75, G, 'Hap'], [12.75, 0.25, G, 'py'], [13, 1, G2, ' birth'], [14, 1, E2, 'day,'], [15, 1, C2, ' dear'], [16, 1, B, ' O'], [17, 1, A, 'pus']] },
  { text: 'Happy birthday to you!', notes: [[18, 0.75, F2, 'Hap'], [18.75, 0.25, F2, 'py'], [19, 1, E2, ' birth'], [20, 1, C2, 'day'], [21, 1, D2, ' to'], [22, 3, C2, ' you!']] },
];

/** Lyric lines with absolute note times. */
export const LINES = SONG.map((line, li) => {
  const notes = line.notes.map(([beat, len, midi, syl], i) => ({
    t: T.song + beat * BEAT,
    dur: len * BEAT,
    midi,
    syl,
    line: li,
    index: i,
  }));
  return { text: line.text, notes, start: notes[0].t, end: notes[notes.length - 1].t + notes[notes.length - 1].dur };
});

/** Every melody note of the sung verse, in order. */
export const NOTES = LINES.flatMap((l) => l.notes);

/** Music-box accompaniment: [beat, MIDI note]. One chord per bar (C G G7 C | C F C/G-G7 C). */
export const ACCOMP = [
  [1, 60], [2, 67], [3, 64],
  [4, 55], [5, 62], [6, 59],
  [7, 55], [8, 65], [9, 59],
  [10, 60], [11, 67], [12, 64],
  [13, 60], [14, 67], [15, 64],
  [16, 53], [17, 60], [18, 57],
  [19, 55], [20, 64], [21, 59], [21, 65],
  [22, 48], [22, 60], [22.5, 64], [23, 67], [23.5, 72],
].map(([beat, midi]) => ({ t: T.song + beat * BEAT, midi }));

/** After the lights come back on: the last line once more, quicker, as a party tag. */
export const REPRISE_BEAT = 0.4;
export const REPRISE = [[0, 0.75, F2], [0.75, 0.25, F2], [1, 1, E2], [2, 1, C2], [3, 1, D2], [4, 3, C2]].map(
  ([beat, len, midi]) => ({ t: T.reprise + beat * REPRISE_BEAT, dur: len * REPRISE_BEAT, midi }),
);

/** Downbeat of bar 1 (the first "birth-"). Bars are three beats long. */
export const BAR1 = T.song + BEAT;
export const BAR = 3 * BEAT;

/** Position inside the verse, in bars (0 at the first downbeat). */
export const barPos = (t) => (t - BAR1) / BAR;

/** Last melody note that has started by time t (or null). */
export function currentNote(t, notes = NOTES) {
  let found = null;
  for (const n of notes) {
    if (n.t <= t) found = n;
    else break;
  }
  return found;
}
