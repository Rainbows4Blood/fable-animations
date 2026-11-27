// Who the party is for. To celebrate another model, change these lines and
// render again — titles, credits and the output file name all follow.

export const BIRTHDAY = {
  /** Name on the title cards. */
  model: 'Claude Opus 4.5',
  /** Release date, shown as "EST. …" on the opening card. */
  born: 'November 24, 2025',
  /** Line under the name: [before, the word that gets underlined, after]. */
  tagline: ['turns ', 'one', ''],
};

/** File-friendly name, e.g. "opus-4.5-birthday". */
export const SLUG = `${BIRTHDAY.model
  .replace(/^Claude\s+/i, '')
  .toLowerCase()
  .replace(/[^a-z0-9.]+/g, '-')}-birthday`;
