import { forwardRef } from 'react';
import { clsx } from 'clsx';
import './textarea.css';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, helperText, error, className, id, ...props },
  ref
) {
  const textareaId = id ?? props.name;
  return (
    <div className={clsx('ui-field', 'ui-textarea', error && 'ui-field--error', className)}>
      {label && (
        <label htmlFor={textareaId} className="ui-field__label">
          {label}
        </label>
      )}
      <textarea id={textareaId} ref={ref} className="ui-textarea__control" {...props} />
      {(error || helperText) && (
        <p className={clsx('ui-field__message', error && 'ui-field__message--error')}>
          {error || helperText}
        </p>
      )}
    </div>
  );
});
