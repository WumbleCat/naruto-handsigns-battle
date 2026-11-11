import { forwardRef, useState } from 'react';
import { TextField, type TextFieldProps } from './TextField';
import styles from './TextField.module.css';

export type PasswordFieldProps = Omit<TextFieldProps, 'type' | 'suffix'>;

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField(props, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <TextField
        ref={ref}
        type={visible ? 'text' : 'password'}
        autoComplete={props.autoComplete ?? 'current-password'}
        suffix={
          <button
            type="button"
            className={styles.suffixButton}
            onClick={() => setVisible((v) => !v)}
            aria-pressed={visible}
          >
            {visible ? 'Hide' : 'Show'}
          </button>
        }
        {...props}
      />
    );
  },
);
