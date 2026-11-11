import type { Element, SignId } from '../engine/types';

export const BOT_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type BotDifficulty = (typeof BOT_DIFFICULTIES)[number];

export type ThemedElement = Element | 'substitution';

export interface ContentConfig {
  game: {
    /** Visible product name. index.html carries the same string for the first paint. */
    title: string;
    tagline: string;
    description: string;
  };
  elements: Record<ThemedElement, { name: string; blurb: string }>;
  signs: Record<SignId, { name: string; pose: string }>;
  difficulties: Record<BotDifficulty, { name: string; blurb: string }>;
  bot: { name: string };
  callouts: {
    fight: string;
    victory: string;
    defeat: string;
    draw: string;
    ko: string;
    timeUp: string;
  };
  terms: {
    jutsu: string;
    jutsuPlural: string;
    sign: string;
    signPlural: string;
    clash: string;
    substitution: string;
  };
}
