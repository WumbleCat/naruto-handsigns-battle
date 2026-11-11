// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { KeyBindingInput } from './KeyBindingInput';

describe('KeyBindingInput', () => {
  it('shows the current key and captures the next key pressed', async () => {
    const onChange = vi.fn();
    render(<KeyBindingInput label="Key for Tiger" code="KeyE" onChange={onChange} />);
    const button = screen.getByRole('button', { name: 'Key for Tiger: E' });
    await userEvent.click(button);
    expect(screen.getByRole('button', { name: 'Key for Tiger: press a key' })).toBeInTheDocument();
    await userEvent.keyboard('{t}');
    expect(onChange).toHaveBeenCalledWith('KeyT');
  });

  it('cancels with Escape and ignores modifier keys', async () => {
    const onChange = vi.fn();
    render(<KeyBindingInput label="Key for Tiger" code="KeyE" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button'));
    await userEvent.keyboard('{Shift}');
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Key for Tiger: E' })).toBeInTheDocument();
  });

  it('names the conflicting sign', () => {
    render(
      <KeyBindingInput
        label="Key for Tiger"
        code="KeyE"
        onChange={() => undefined}
        conflictWith="Horse"
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Already used by Horse.');
  });
});
