import { type ReactNode } from 'react';
import { clsx } from 'clsx';
import './modal.css';

interface ModalProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
}

export function Modal({ open, title, onClose, children, footer, size = 'md' }: ModalProps) {
  if (!open) return null;
  return (
    <div className="ui-modal__backdrop" role="dialog" aria-modal="true">
      <div className={clsx('ui-modal', `ui-modal--${size}`)}>
        <header className="ui-modal__header">
          <h3>{title}</h3>
          <button type="button" className="ui-modal__close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="ui-modal__body">{children}</div>
        {footer && <footer className="ui-modal__footer">{footer}</footer>}
      </div>
    </div>
  );
}
