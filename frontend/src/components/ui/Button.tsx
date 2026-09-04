import React from 'react';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'outline' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-[#009E49] hover:bg-[#00873e] text-white border-transparent shadow-xs',
  outline: 'border border-emerald-500 text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100',
  secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-800 border-transparent',
  ghost: 'bg-transparent hover:bg-gray-100 text-gray-600 hover:text-gray-900 border-transparent',
  danger: 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200',
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: 'px-2.5 py-1 text-[11px] rounded-md',
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2 text-xs rounded-xl font-semibold',
  lg: 'px-6 py-2.5 text-sm rounded-xl font-semibold',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`inline-flex items-center justify-center space-x-2 transition-all cursor-pointer select-none font-medium disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Spinner size={size === 'lg' ? 'md' : 'sm'} color={variant === 'primary' ? 'white' : 'emerald'} />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        {children && <span>{children}</span>}
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
