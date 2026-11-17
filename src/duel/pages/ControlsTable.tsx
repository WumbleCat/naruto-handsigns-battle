import {
  JUTSUS,
  MOCK_KEY_FOR_SIGN,
  SIGN_LABELS,
  type DuelSign,
  type InputMode,
} from '@jutsu-duel/duel-shared';
import styles from './duel.module.css';

const SIGN_ORDER: readonly DuelSign[] = ['tiger', 'boar', 'horse', 'rat', 'bird', 'snake', 'ram'];

/** The key map, with the mock sign keys only when they are live. */
export function ControlsTable({ inputMode }: { inputMode: InputMode }) {
  return (
    <table className={styles.controls}>
      <tbody>
        <tr>
          <th scope="row">W A S D</th>
          <td>Move</td>
        </tr>
        <tr>
          <th scope="row">Space</th>
          <td>Dodge: a short dash with a brief invulnerable window. Costs stamina.</td>
        </tr>
        <tr>
          <th scope="row">1 / 2 / 3</th>
          <td>
            Select {JUTSUS.fireball.name}, {JUTSUS.lightning_spear.name}, {JUTSUS.water_shield.name}
          </td>
        </tr>
        {inputMode === 'mock' ? (
          <tr>
            <th scope="row">{SIGN_ORDER.map((sign) => MOCK_KEY_FOR_SIGN[sign]).join(' ')}</th>
            <td>
              Mock hand signs:{' '}
              {SIGN_ORDER.map((sign) => `${MOCK_KEY_FOR_SIGN[sign]} ${SIGN_LABELS[sign]}`).join(
                ', ',
              )}
            </td>
          </tr>
        ) : (
          <tr>
            <th scope="row">Hands</th>
            <td>Hold each sign of the selected jutsu in front of the camera, in order.</td>
          </tr>
        )}
        <tr>
          <th scope="row">Backspace</th>
          <td>Cancel the signs made so far</td>
        </tr>
        <tr>
          <th scope="row">Escape</th>
          <td>Show or hide this help during a match</td>
        </tr>
      </tbody>
    </table>
  );
}
