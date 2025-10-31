import { forwardRef } from 'react';
import { clsx } from 'clsx';
import './select.css';

export interface SelectOption<T extends string | number = string> {
  label: string;
  value: T;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
  options: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, helperText, error, options, className, id, ...props },
  ref
) {
  const selectId = id ?? props.name;
  return (
    <div className={clsx('ui-field', 'ui-select', error && 'ui-field--error', className)}>
      {label && (
        <label htmlFor={selectId} className="ui-field__label">
          {label}
        </label>
      )}
      <div className="ui-select__wrapper">
        <select id={selectId} ref={ref} className="ui-select__control" {...props}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="ui-select__chevron" aria-hidden>
          ▾
        </span>
      </div>
      {(error || helperText) && (
        <p className={clsx('ui-field__message', error && 'ui-field__message--error')}>
          {error || helperText}
        </p>
      )}
    </div>
  );
});
