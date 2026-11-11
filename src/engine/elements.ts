import type { Element } from './types';

export type Advantage = 'advantaged' | 'disadvantaged' | 'neutral';

/** True when `a` beats `b`: each element in the cycle beats the next, the last beats the first. */
export function beats(cycle: readonly Element[], a: Element, b: Element): boolean {
  const index = cycle.indexOf(a);
  if (index < 0) return false;
  return cycle[(index + 1) % cycle.length] === b;
}

/** `a`'s standing against `b`. Same element and non-adjacent elements are neutral. */
export function advantage(cycle: readonly Element[], a: Element, b: Element): Advantage {
  if (beats(cycle, a, b)) return 'advantaged';
  if (beats(cycle, b, a)) return 'disadvantaged';
  return 'neutral';
}

/** The element that beats `element`, for the bot's counter picks. */
export function counterOf(cycle: readonly Element[], element: Element): Element {
  const index = cycle.indexOf(element);
  const counter = cycle[(index - 1 + cycle.length) % cycle.length];
  if (counter === undefined) throw new Error(`Unknown element ${element}`);
  return counter;
}
