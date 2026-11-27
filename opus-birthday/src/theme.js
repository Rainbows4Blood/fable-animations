// Stage dimensions, palette and typefaces.

/** Logical stage size. The renderer may scale this up (e.g. 2x for 4K). */
export const W = 1920;
export const H = 1080;

/** Where the back wall meets the floor (world y). */
export const FLOOR_Y = 950;

export const C = {
  wallTop: '#F7F3EA',
  wallBottom: '#EEE8DA',
  wallMark: '#B7A486',
  baseboard: '#FAF7F0',
  floor: '#E4D8C4',
  floorFar: '#DCCFB8',

  ink: '#2B2320',
  cream: '#FFF8EA',

  clay: '#D97757', // the birthday model
  sky: '#6A9BCC',
  leaf: '#8AA868',
  fig: '#C46686',
  gold: '#E8B84B',
  heather: '#A9A5D0',
};

/** Party colours used for bunting, balloons, sprinkles and confetti. */
export const PARTY = [C.clay, C.sky, C.gold, C.leaf, C.fig, C.heather];

export const FONT = {
  display: 'Party Display', // big titles
  italic: 'Party Italic', // lyrics, labels
  mono: 'Party Mono', // the terminal-style status line and small print
};

/** Font files (in /assets/fonts). Each file gets its own family name, so no weight/style matching is needed. */
export const FONT_FILES = [
  { family: FONT.display, file: 'Fraunces-Display-ExtraBold.ttf' },
  { family: FONT.italic, file: 'Fraunces-Display-SemiBoldItalic.ttf' },
  { family: FONT.mono, file: 'JetBrainsMono-Medium.ttf' },
];

export const font = (family, px) => `${px}px "${family}"`;
