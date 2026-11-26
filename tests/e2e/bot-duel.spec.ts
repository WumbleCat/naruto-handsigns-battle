// One browser plays an offline duel against the bot: pick a difficulty, countdown, dodge, land
// a Fireball, and see the bot spend chakra on its own casts. The duel server is not involved.
import { expect, test, type Page } from '@playwright/test';

const SIGN_GAP_MS = 220;

async function bar(page: Page, testId: string): Promise<number> {
  const text = await page.getByTestId(testId).innerText();
  return Number(text.split('/')[0]);
}

test('a player fights the bot offline', async ({ page }) => {
  const sockets: string[] = [];
  page.on('websocket', (socket) => {
    if (socket.url().includes(':2567')) sockets.push(socket.url());
  });

  await page.goto('/duel');
  await page.getByTestId('nickname').fill('Solo');
  await page.getByRole('radio', { name: 'Hard' }).click();
  await expect(page.getByTestId('bot-summary')).toContainText('Fast signs');
  await page.getByRole('radio', { name: 'Easy' }).click();
  await page.getByTestId('start-bot-duel').click();

  await page.waitForURL(/\/duel\/bot\/easy$/);
  await expect(page.getByTestId('countdown')).toBeVisible();
  await expect(page.getByTestId('network')).toHaveText('Offline against the easy bot');
  await expect(page.getByTestId('phase')).toHaveText('PLAYING', { timeout: 10_000 });

  // Dodge costs 35 stamina, exactly as online.
  await page.keyboard.press('Space');
  await expect.poll(() => bar(page, 'stamina-local'), { timeout: 3000 }).toBeLessThan(100);

  // Close the distance, then weave Fireball until one lands.
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(2000);
  await page.keyboard.up('KeyD');
  const deadline = Date.now() + 40_000;
  while (Date.now() < deadline && (await bar(page, 'hp-remote')) >= 100) {
    for (const key of ['KeyQ', 'KeyE', 'KeyR']) {
      await page.keyboard.press(key);
      await page.waitForTimeout(SIGN_GAP_MS);
    }
    await page.waitForTimeout(5000);
  }
  expect(await bar(page, 'hp-remote')).toBeLessThan(100);

  // The bot weaves too: its chakra drops when it casts (or the match has already ended).
  await expect
    .poll(
      async () =>
        (await bar(page, 'chakra-remote')) < 80 ||
        (await page.getByTestId('phase').innerText()) === 'FINISHED',
      { timeout: 30_000, intervals: [250] },
    )
    .toBe(true);
  expect(sockets).toEqual([]);
});
