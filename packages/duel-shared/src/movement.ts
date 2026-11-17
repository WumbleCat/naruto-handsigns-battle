// The one movement step both the server simulation and client prediction run, so a predicted
// position matches the authoritative one when the inputs match.
import { DUEL_CONFIG } from './config.ts';
import { clamp, normalise, type Vec2 } from './math.ts';

export interface MoveCommand {
  moveX: number;
  moveY: number;
}

export interface MovementOptions {
  /** 1 while walking, 0.5 while casting. */
  speedMultiplier: number;
}

/** Sanitised, normalised direction for a raw command. Non-finite or out-of-range values become 0. */
export function commandDirection(command: MoveCommand): Vec2 {
  const x = Number.isFinite(command.moveX) ? clamp(command.moveX, -1, 1) : 0;
  const y = Number.isFinite(command.moveY) ? clamp(command.moveY, -1, 1) : 0;
  return normalise(x, y);
}

/** Position after one fixed step of walking, clamped inside the arena by the player's radius. */
export function stepWalk(
  position: Vec2,
  command: MoveCommand,
  dt: number,
  options: MovementOptions,
): Vec2 {
  const direction = commandDirection(command);
  const speed = DUEL_CONFIG.player.speed * options.speedMultiplier;
  return clampToArena({
    x: position.x + direction.x * speed * dt,
    y: position.y + direction.y * speed * dt,
  });
}

export function clampToArena(position: Vec2): Vec2 {
  const r = DUEL_CONFIG.player.radius;
  return {
    x: clamp(position.x, r, DUEL_CONFIG.arena.width - r),
    y: clamp(position.y, r, DUEL_CONFIG.arena.height - r),
  };
}
