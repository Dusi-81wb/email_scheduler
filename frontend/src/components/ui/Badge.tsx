import React from 'react';

export type BadgeVariant = 'success' | 'warning' | 'info' | 'danger' | 'neutral' | 'outline';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
  warning: 'bg-amber-50 text-amber-800 border-amber-200/80',
  info: 'bg-blue-50 text-blue-800 border-blue-200/80',
  danger: 'bg-rose-50 text-rose-800 border-rose-200/80',
  neutral: 'bg-gray-100 text-gray-700 border-gray-200',
  outline: 'bg-white text-emerald-700 border-emerald-500',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  icon,
  children,
  className = '',
  ...props
}) => {
  return (
    <span
      className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full border text-[11px] font-medium transition-colors ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
