import { forwardRef } from 'react';
import { clsx } from 'clsx';
import './button.css';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', isLoading, disabled, leftIcon, rightIcon, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={clsx(
        'ui-button',
        `ui-button--${variant}`,
        `ui-button--${size}`,
        isLoading && 'ui-button--loading',
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <span className="ui-button__spinner" aria-hidden />}
      {!isLoading && leftIcon && <span className="ui-button__icon ui-button__icon--left">{leftIcon}</span>}
      <span className="ui-button__label">{children}</span>
      {!isLoading && rightIcon && <span className="ui-button__icon ui-button__icon--right">{rightIcon}</span>}
    </button>
  );
});
