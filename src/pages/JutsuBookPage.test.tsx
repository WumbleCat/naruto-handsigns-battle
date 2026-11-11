// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../content/balance.config';
import { CONTENT } from '../content/content.config';
import { JUTSU_IDS, ROSTER_BY_ID } from '../content/roster';
import { SIGN_IDS } from '../engine/types';
import { JutsuBookPage } from './JutsuBookPage';

describe('JutsuBookPage', () => {
  it('lists every jutsu with its damage and every sign with its key', () => {
    render(
      <MemoryRouter>
        <JutsuBookPage />
      </MemoryRouter>,
    );
    for (const id of JUTSU_IDS) {
      expect(
        screen.getAllByRole('heading', { name: CONTENT.jutsus[id].name }).length,
      ).toBeGreaterThan(0);
    }
    for (const sign of SIGN_IDS) {
      expect(
        screen.getAllByRole('heading', { name: CONTENT.signs[sign].name }).length,
      ).toBeGreaterThan(0);
    }
    const fireball = screen.getByRole('list', {
      name: `${CONTENT.jutsus.fire_short.name} sequence`,
    });
    expect(fireball.querySelectorAll('li')).toHaveLength(ROSTER_BY_ID.fire_short.sequence.length);
    const damage = BALANCE.damageBySignCount[ROSTER_BY_ID.water_long.sequence.length];
    expect(screen.getAllByText(String(damage)).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Practice')).toHaveLength(JUTSU_IDS.length);
  });
});
