// Every themed, Naruto-flavoured name or string lives here so the game can be rebranded by
// editing one file. Code refers to neutral IDs (`fire`, `tiger`, `fire_short`) only.
// Jutsu names arrive with the roster in src/content/roster.ts (milestone v0.2.0).
import type { ContentConfig } from './types';

export const CONTENT: ContentConfig = {
  game: {
    title: 'Jutsu Duel',
    tagline: 'Your hands are the controller.',
    description:
      'Perform hand signs on your webcam to cast jutsu in real-time duels. Play the bot now. Fight friends live soon.',
  },

  elements: {
    fire: { name: 'Fire', blurb: 'Beats Wind. Loses to Water.' },
    wind: { name: 'Wind', blurb: 'Beats Lightning. Loses to Fire.' },
    lightning: { name: 'Lightning', blurb: 'Beats Earth. Loses to Wind.' },
    earth: { name: 'Earth', blurb: 'Beats Water. Loses to Lightning.' },
    water: { name: 'Water', blurb: 'Beats Fire. Loses to Earth.' },
    substitution: {
      name: 'Substitution',
      blurb: 'Negates a jutsu in flight, then needs a moment to recharge.',
    },
  },

  signs: {
    rat: {
      name: 'Rat',
      pose: 'One hand points its index and middle fingers up; the other hand wraps around them.',
    },
    ox: {
      name: 'Ox',
      pose: 'One hand upright, the other horizontal, fingers interlocked at the knuckles.',
    },
    tiger: {
      name: 'Tiger',
      pose: 'Palms together, both index and middle fingers pointing up, the rest interlaced.',
    },
    hare: {
      name: 'Hare',
      pose: 'One hand makes a fist with the little finger raised; the other rests two fingers on top.',
    },
    dragon: {
      name: 'Dragon',
      pose: 'Fingers interlaced and curled, both thumbs raised, little fingers extended.',
    },
    snake: {
      name: 'Snake',
      pose: 'Palms together with all fingers interlaced and pointing down.',
    },
    horse: {
      name: 'Horse',
      pose: 'Index fingers pressed together pointing up; the other fingers interlace below them.',
    },
    ram: {
      name: 'Ram',
      pose: 'Both index and middle fingers up and pressed together, one hand higher than the other.',
    },
    monkey: {
      name: 'Monkey',
      pose: 'Both hands flat and horizontal, stacked with the little fingers touching, thumbs out.',
    },
    bird: {
      name: 'Bird',
      pose: 'Thumbs and little fingers touch at the tips; the middle fingers interlace between.',
    },
    dog: {
      name: 'Dog',
      pose: 'One hand flat, palm down, resting on top of the other hand held in a fist.',
    },
    boar: {
      name: 'Boar',
      pose: 'Two loose fists pressed together knuckle to knuckle, palms facing you.',
    },
  },

  difficulties: {
    easy: { name: 'Genin', blurb: 'Weaves slowly and never reads you.' },
    medium: { name: 'Chunin', blurb: 'Reads your trail after two signs.' },
    hard: { name: 'Jonin', blurb: 'Counters your element and times the clash.' },
  },

  bot: { name: 'The Mask' },

  callouts: {
    fight: 'Fight',
    victory: 'Victory',
    defeat: 'Defeat',
    draw: 'Draw',
    ko: 'KO',
    timeUp: 'Time',
  },

  terms: {
    jutsu: 'jutsu',
    jutsuPlural: 'jutsu',
    sign: 'hand sign',
    signPlural: 'hand signs',
    clash: 'clash',
    substitution: 'Substitution',
  },
};
