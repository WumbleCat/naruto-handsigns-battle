import { useEffect, useId, useRef, type ReactNode, type SyntheticEvent } from 'react';
import styles from './Dialog.module.css';

export interface DialogProps {
  open: boolean;
  title: string;
  children?: ReactNode;
  /** Buttons rendered right-aligned under the body. */
  actions?: ReactNode;
  /** Called when the dialog wants to close (Escape, backdrop click, or a cancel action). */
  onClose: () => void;
  /** Destructive confirmations ignore Escape and backdrop clicks; a button must be pressed. */
  destructive?: boolean;
}

/** Native <dialog> modal: focus is trapped and restored by the browser. */
export function Dialog({
  open,
  title,
  children,
  actions,
  onClose,
  destructive = false,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    if (!destructive) onClose();
  };

  const handleBackdrop = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target === ref.current && !destructive) onClose();
  };

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={handleCancel}
      onClick={handleBackdrop}
    >
      <div className={styles.panel}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {children ? <div className={styles.body}>{children}</div> : null}
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
    </dialog>
  );
}
