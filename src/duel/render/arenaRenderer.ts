// Draws one FrameModel onto a 2D canvas in world units. Original shapes only: ninja as a ring
// with a facing mark, projectiles as glowing discs, the shield as a ring, dashes as fading
// afterimages. Colours come from the page's design tokens so both themes work.
import { DUEL_CONFIG, JUTSUS, type JutsuId } from '@jutsu-duel/duel-shared';
import type { FrameModel, PlayerView, ProjectileView } from './DuelPresenter';

export interface ArenaTheme {
  stage: string;
  grid: string;
  border: string;
  text: string;
  text2: string;
  local: string;
  remote: string;
  fire: string;
  lightning: string;
  water: string;
  danger: string;
  ok: string;
}

const TOKEN_FOR: Record<keyof ArenaTheme, string> = {
  stage: '--bg-stage',
  grid: '--border',
  border: '--border-strong',
  text: '--text',
  text2: '--text-2',
  local: '--paper-100',
  remote: '--ink-400',
  fire: '--fire',
  lightning: '--lightning',
  water: '--water',
  danger: '--danger',
  ok: '--ok',
};

export function readTheme(element: Element): ArenaTheme {
  const style = getComputedStyle(element);
  const theme = {} as ArenaTheme;
  for (const [key, token] of Object.entries(TOKEN_FOR) as Array<[keyof ArenaTheme, string]>) {
    theme[key] = style.getPropertyValue(token).trim() || '#888';
  }
  return theme;
}

function jutsuColour(theme: ArenaTheme, jutsuId: JutsuId): string {
  return jutsuId === 'fireball'
    ? theme.fire
    : jutsuId === 'lightning_spear'
      ? theme.lightning
      : theme.water;
}

export function drawArena(
  ctx: CanvasRenderingContext2D,
  model: FrameModel,
  theme: ArenaTheme,
): void {
  const { width, height } = DUEL_CONFIG.arena;
  ctx.save();
  ctx.fillStyle = theme.stage;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  for (let x = 100; x < width; x += 100) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 100; y < height; y += 100) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, width - 3, height - 3);

  for (const player of model.players) drawTrail(ctx, player, theme);
  for (const projectile of model.projectiles) drawProjectile(ctx, projectile, theme);
  for (const player of model.players) drawPlayer(ctx, player, theme);
  for (const effect of model.effects) {
    const colour =
      effect.kind === 'damage'
        ? theme.danger
        : effect.kind === 'dodge'
          ? theme.ok
          : effect.kind === 'shield'
            ? theme.water
            : effect.kind === 'cast' && effect.jutsuId
              ? jutsuColour(theme, effect.jutsuId)
              : theme.text;
    if (effect.kind === 'hit') {
      ctx.globalAlpha = 1 - effect.age;
      ctx.strokeStyle = theme.text;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, 12 + effect.age * 40, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      continue;
    }
    if (effect.kind === 'cast') {
      ctx.globalAlpha = (1 - effect.age) * 0.6;
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, 30 + effect.age * 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      continue;
    }
    if (effect.text) {
      ctx.globalAlpha = 1 - Math.max(0, effect.age - 0.5) * 2;
      ctx.fillStyle = colour;
      ctx.font = `${effect.kind === 'ko' ? 48 : 26}px "Zen Kaku Gothic New", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(effect.text, effect.x, effect.y - effect.age * 40);
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}

function drawTrail(ctx: CanvasRenderingContext2D, player: PlayerView, theme: ArenaTheme): void {
  const colour = player.isLocal ? theme.local : theme.remote;
  for (const point of player.trail) {
    ctx.globalAlpha = (1 - point.age) * 0.35;
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(point.x, point.y, DUEL_CONFIG.player.radius * (1 - point.age * 0.4), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPlayer(ctx: CanvasRenderingContext2D, player: PlayerView, theme: ArenaTheme): void {
  const r = DUEL_CONFIG.player.radius;
  const colour = player.isLocal ? theme.local : theme.remote;
  ctx.globalAlpha = player.alive ? (player.connected ? 1 : 0.4) : 0.3;

  if (player.shieldHp > 0) {
    ctx.strokeStyle = theme.water;
    ctx.lineWidth = 4;
    ctx.globalAlpha *= 0.9;
    ctx.beginPath();
    ctx.arc(player.x, player.y, r + 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = player.alive ? 1 : 0.3;
  }

  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(player.x, player.y, r, 0, Math.PI * 2);
  ctx.fill();

  if (player.invulnerable) {
    ctx.strokeStyle = theme.ok;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(player.x, player.y, r + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Facing mark: a small wedge on the rim, in the stage colour so it reads on both themes.
  ctx.fillStyle = theme.stage;
  ctx.beginPath();
  ctx.moveTo(
    player.x + Math.cos(player.facing) * (r - 2),
    player.y + Math.sin(player.facing) * (r - 2),
  );
  ctx.lineTo(
    player.x + Math.cos(player.facing + 2.4) * (r * 0.45),
    player.y + Math.sin(player.facing + 2.4) * (r * 0.45),
  );
  ctx.lineTo(
    player.x + Math.cos(player.facing - 2.4) * (r * 0.45),
    player.y + Math.sin(player.facing - 2.4) * (r * 0.45),
  );
  ctx.closePath();
  ctx.fill();

  if (player.castJutsuId) {
    ctx.strokeStyle = jutsuColour(theme, player.castJutsuId);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(
      player.x,
      player.y,
      r + 8,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * player.castFraction,
    );
    ctx.stroke();
  }

  ctx.fillStyle = theme.text;
  ctx.font = '15px "Zen Kaku Gothic New", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(player.nickname, player.x, player.y - r - 14);
  if (!player.connected) {
    ctx.fillStyle = theme.text2;
    ctx.fillText('reconnecting', player.x, player.y + r + 20);
  }
  ctx.globalAlpha = 1;
}

function drawProjectile(
  ctx: CanvasRenderingContext2D,
  projectile: ProjectileView,
  theme: ArenaTheme,
): void {
  const colour = jutsuColour(theme, projectile.jutsuId);
  const def = JUTSUS[projectile.jutsuId];
  ctx.save();
  ctx.translate(projectile.x, projectile.y);
  ctx.rotate(projectile.angle);
  ctx.fillStyle = colour;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.ellipse(
    -projectile.radius * 1.2,
    0,
    projectile.radius * 2.4,
    projectile.radius * 0.9,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  if (def.kind === 'projectile' && projectile.jutsuId === 'lightning_spear') {
    ctx.ellipse(0, 0, projectile.radius * 2.2, projectile.radius, 0, 0, Math.PI * 2);
  } else {
    ctx.arc(0, 0, projectile.radius, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();
}
