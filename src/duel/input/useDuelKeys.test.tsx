// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDuelKeys, type DuelKeyHandlers, type DuelKeysHandle } from './useDuelKeys';

function key(
  type: 'keydown' | 'keyup',
  code: string,
  init: KeyboardEventInit = {},
  target: EventTarget = window,
) {
  target.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true, ...init }));
}

function mount(enabled = true, mockSigns = true) {
  const handlers: DuelKeyHandlers = {
    onDodge: vi.fn(),
    onSelect: vi.fn(),
    onMockSign: vi.fn(),
    onCancelSigns: vi.fn(),
    onToggleHelp: vi.fn(),
  };
  let handle: DuelKeysHandle | null = null;
  function Probe() {
    handle = useDuelKeys(enabled, mockSigns, handlers);
    return null;
  }
  render(<Probe />);
  if (!handle) throw new Error('hook did not run');
  return { handlers, handle: handle as DuelKeysHandle };
}

describe('useDuelKeys', () => {
  it('reports a clamped movement direction from held keys', () => {
    const { handle } = mount();
    key('keydown', 'KeyW');
    key('keydown', 'KeyD');
    expect(handle.direction()).toEqual({ moveX: 1, moveY: -1 });
    key('keyup', 'KeyW');
    expect(handle.direction()).toEqual({ moveX: 1, moveY: 0 });
    window.dispatchEvent(new Event('blur'));
    expect(handle.direction()).toEqual({ moveX: 0, moveY: 0 });
  });

  it('fires dodge once per press, selects slots and mock signs', () => {
    const { handlers } = mount();
    key('keydown', 'Space');
    key('keydown', 'Space', { repeat: true });
    expect(handlers.onDodge).toHaveBeenCalledTimes(1);
    key('keydown', 'Digit3');
    expect(handlers.onSelect).toHaveBeenCalledWith('water_shield');
    key('keydown', 'KeyQ');
    key('keydown', 'KeyI');
    expect(handlers.onMockSign).toHaveBeenNthCalledWith(1, 'tiger');
    expect(handlers.onMockSign).toHaveBeenNthCalledWith(2, 'ram');
    key('keydown', 'Backspace');
    key('keydown', 'Escape');
    expect(handlers.onCancelSigns).toHaveBeenCalledTimes(1);
    expect(handlers.onToggleHelp).toHaveBeenCalledTimes(1);
  });

  it('ignores mock sign keys in webcam mode and all keys while typing (U-30)', () => {
    const { handlers, handle } = mount(true, false);
    key('keydown', 'KeyQ');
    expect(handlers.onMockSign).not.toHaveBeenCalled();
    const input = document.createElement('input');
    document.body.append(input);
    key('keydown', 'Space', {}, input);
    key('keydown', 'KeyD', {}, input);
    expect(handlers.onDodge).not.toHaveBeenCalled();
    expect(handle.direction()).toEqual({ moveX: 0, moveY: 0 });
    input.remove();
  });

  it('does nothing while disabled', () => {
    const { handlers, handle } = mount(false);
    key('keydown', 'Space');
    key('keydown', 'KeyD');
    expect(handlers.onDodge).not.toHaveBeenCalled();
    expect(handle.direction()).toEqual({ moveX: 0, moveY: 0 });
  });
});
