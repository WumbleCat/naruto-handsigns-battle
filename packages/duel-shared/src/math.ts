// Pure geometry for the simulation. No allocation in the hot paths beyond small result objects.

export interface Vec2 {
  x: number;
  y: number;
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Unit vector, or (0, 0) for a zero input so diagonal moves are never faster than straight ones. */
export function normalise(x: number, y: number): Vec2 {
  const length = Math.hypot(x, y);
  if (length < 1e-9) return { x: 0, y: 0 };
  return { x: x / length, y: y / length };
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Earliest fraction t in [0, 1] at which a point moving from `from` to `to` comes within
 * `radius` of `centre`, or null when it never does. Sweeping the segment instead of testing the
 * end point stops fast projectiles from tunnelling through a player between ticks.
 */
export function sweptCircleHit(from: Vec2, to: Vec2, centre: Vec2, radius: number): number | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const fx = from.x - centre.x;
  const fy = from.y - centre.y;
  const r2 = radius * radius;
  if (fx * fx + fy * fy <= r2) return 0;
  const a = dx * dx + dy * dy;
  if (a < 1e-12) return null;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r2;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

/**
 * Fraction t in (0, 1] at which a point moving from `from` to `to` leaves the rectangle
 * [0, width] x [0, height], or null when it stays inside.
 */
export function exitFraction(from: Vec2, to: Vec2, width: number, height: number): number | null {
  let best: number | null = null;
  const consider = (t: number) => {
    if (t > 0 && t <= 1 && (best === null || t < best)) best = t;
  };
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx < 0) consider(-from.x / dx);
  if (dx > 0) consider((width - from.x) / dx);
  if (dy < 0) consider(-from.y / dy);
  if (dy > 0) consider((height - from.y) / dy);
  if (to.x < 0 || to.x > width || to.y < 0 || to.y > height) return best ?? 1;
  return best;
}
