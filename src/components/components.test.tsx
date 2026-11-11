// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button/Button';
import { Seal } from './Seal/Seal';
import { SegmentedControl } from './SegmentedControl/SegmentedControl';
import { PasswordField } from './TextField/PasswordField';
import { TextField } from './TextField/TextField';
import { Toggle } from './Toggle/Toggle';

describe('Button', () => {
  it('disables itself and announces busy while loading', () => {
    render(<Button loading>Save</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('defaults to type="button" so it never submits a form by accident', () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});

describe('Seal', () => {
  it('labels itself with the sign name from the content config', () => {
    render(<Seal sign="tiger" />);
    expect(screen.getByRole('img', { name: 'Tiger' })).toBeInTheDocument();
  });

  it('takes the element colour attribute from the tint', () => {
    render(<Seal sign="tiger" tint="fire" />);
    expect(screen.getByRole('img')).toHaveAttribute('data-element', 'fire');
  });

  it('is decorative without a glyph or label', () => {
    render(<Seal variant="empty" />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

describe('SegmentedControl', () => {
  const options = [
    { value: 'system', label: 'System' },
    { value: 'dark', label: 'Dark' },
    { value: 'light', label: 'Light' },
  ] as const;

  it('reports the clicked option', async () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Theme" options={options} value="system" onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Light' }));
    expect(onChange).toHaveBeenCalledWith('light');
  });

  it('moves with arrow keys and wraps around', async () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Theme" options={options} value="light" onChange={onChange} />);
    screen.getByRole('radio', { name: 'Light' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('system');
  });
});

describe('TextField', () => {
  it('links its error message to the input', () => {
    render(<TextField label="Email" error="Enter a valid email." />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a valid email.');
  });

  it('reveals a password on request', async () => {
    render(<PasswordField label="Password" />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(input).toHaveAttribute('type', 'text');
  });
});

describe('Toggle', () => {
  it('is a switch that flips its value', async () => {
    const onChange = vi.fn();
    render(<Toggle label="Mirror video" checked={true} onChange={onChange} />);
    await userEvent.click(screen.getByRole('switch', { name: 'Mirror video' }));
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
