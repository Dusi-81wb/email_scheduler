import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-gray-700 select-none"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 text-gray-400 pointer-events-none">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={`w-full text-xs text-gray-900 bg-[#F1F3F4]/80 placeholder-gray-400 rounded-xl px-3 py-2 border transition-all focus:outline-none focus:bg-white focus:ring-1 ${
              error
                ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500'
                : 'border-transparent focus:border-emerald-500 focus:ring-emerald-500'
            } ${leftIcon ? 'pl-9' : ''} ${rightIcon ? 'pr-9' : ''} ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 text-gray-400 pointer-events-none">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="text-[11px] text-rose-600 font-medium">{error}</p>}
        {!error && helperText && (
          <p className="text-[11px] text-gray-400">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
