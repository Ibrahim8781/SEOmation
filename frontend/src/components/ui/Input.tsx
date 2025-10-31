import { forwardRef } from 'react';
import { clsx } from 'clsx';
import './input.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, helperText, error, leftIcon, rightIcon, className, id, ...props },
  ref
) {
  const inputId = id ?? props.name;
  return (
    <div className={clsx('ui-field', error && 'ui-field--error', className)}>
      {label && (
        <label htmlFor={inputId} className="ui-field__label">
          {label}
        </label>
      )}
      <div className={clsx('ui-field__control', (leftIcon || rightIcon) && 'ui-field__control--with-icon')}>
        {leftIcon && <span className="ui-field__icon ui-field__icon--left">{leftIcon}</span>}
        <input id={inputId} ref={ref} className="ui-field__input" {...props} />
        {rightIcon && <span className="ui-field__icon ui-field__icon--right">{rightIcon}</span>}
      </div>
      {(error || helperText) && (
        <p className={clsx('ui-field__message', error && 'ui-field__message--error')}>
          {error || helperText}
        </p>
      )}
    </div>
  );
});
