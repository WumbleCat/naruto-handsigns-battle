// Two independent browser contexts play a whole mock-sign duel: create, join by code, ready,
// countdown, walk, cast through the sign keys, dodge, knockout, shared result.
import { expect, test, type Page } from '@playwright/test';

const SIGN_GAP_MS = 220;

async function pressSigns(page: Page, keys: string[]): Promise<void> {
  for (const key of keys) {
    await page.keyboard.press(key);
    await page.waitForTimeout(SIGN_GAP_MS);
  }
}

async function hp(page: Page, side: 'local' | 'remote'): Promise<number> {
  const text = await page.getByTestId(`hp-${side}`).innerText();
  return Number(text.split('/')[0]);
}

test('two players complete a mock-sign duel with a shared result', async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const a = await contextA.newPage();
  const b = await contextB.newPage();

  // Alpha creates the duel.
  await a.goto('/duel');
  await a.getByTestId('nickname').fill('Alpha');
  await a.getByTestId('create-duel').click();
  await a.waitForURL(/\/duel\/[^/]+$/);
  const roomId = a.url().split('/').pop() ?? '';
  expect(roomId.length).toBeGreaterThan(3);
  await expect(a.getByTestId('invite-code')).toHaveText(roomId);

  // Beta joins by link, with a fresh identity.
  await b.goto(`/duel/${roomId}`);
  await b.getByTestId('nickname').fill('Beta');
  await b.getByTestId('join-duel').click();
  await expect(b.getByTestId('seats')).toContainText('Alpha');
  await expect(a.getByTestId('seats')).toContainText('Beta');

  // A third seat does not exist.
  const contextC = await browser.newContext();
  const c = await contextC.newPage();
  await c.goto(`/duel/${roomId}`);
  await c.getByTestId('nickname').fill('Gamma');
  await c.getByTestId('join-duel').click();
  await expect(c.getByRole('heading', { name: 'Could not join' })).toBeVisible();
  await expect(c.getByText('That duel is full.')).toBeVisible();
  await contextC.close();

  // Both ready: countdown, then play.
  await a.getByTestId('ready').click();
  await b.getByTestId('ready').click();
  await expect(a.getByTestId('countdown')).toBeVisible();
  await expect(a.getByTestId('phase')).toHaveText('PLAYING', { timeout: 10_000 });
  await expect(b.getByTestId('phase')).toHaveText('PLAYING');

  // Alpha walks closer so the projectiles can reach.
  await a.keyboard.down('KeyD');
  await a.waitForTimeout(2000);
  await a.keyboard.up('KeyD');

  // Beta dodges once: stamina drops by 35.
  await b.keyboard.press('Space');
  await expect(b.getByTestId('stamina-local')).toContainText('65', { timeout: 3000 });

  // Alpha weaves Fireball (Tiger, Boar, Horse) and lands it.
  await pressSigns(a, ['KeyQ', 'KeyE', 'KeyR']);
  await expect(b.getByTestId('hp-local')).toContainText('72', { timeout: 5000 });
  expect(await hp(a, 'remote')).toBe(72);

  // Keep casting until the knockout: alternate Lightning Spear (Rat, Bird, Tiger) and Fireball.
  const deadline = Date.now() + 60_000;
  let turn = 0;
  while (Date.now() < deadline) {
    const phase = await a.getByTestId('phase').innerText();
    if (phase === 'FINISHED') break;
    if (turn % 2 === 0) {
      await a.keyboard.press('Digit2');
      await pressSigns(a, ['KeyT', 'KeyY', 'KeyQ']);
    } else {
      await a.keyboard.press('Digit1');
      await pressSigns(a, ['KeyQ', 'KeyE', 'KeyR']);
    }
    turn += 1;
    await a.waitForTimeout(1200);
  }

  await expect(a.getByTestId('result-word')).toHaveText('Victory', { timeout: 15_000 });
  await expect(b.getByTestId('result-word')).toHaveText('Defeat');
  expect(await hp(b, 'local')).toBe(0);

  // Both accept a rematch: a fresh countdown with full bars.
  await a.getByTestId('rematch').click();
  await b.getByTestId('rematch').click();
  await expect(a.getByTestId('countdown')).toBeVisible({ timeout: 5000 });
  await expect(b.getByTestId('hp-local')).toContainText('100');

  await contextA.close();
  await contextB.close();
});
