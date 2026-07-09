import React from 'react';
import { AnixiLogo } from '../brand/AnixiLogo';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  titleClassName?: string;
  maxWidth?: 'md' | 'lg' | 'xl';
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  title,
  subtitle,
  titleClassName = 'font-heading',
  maxWidth = 'md',
}) => {
  const widthClass = {
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  }[maxWidth];

  return (
    <div className="flex min-h-screen items-center justify-center bg-anixi-beige px-4 py-12 sm:px-6 lg:px-8">
      <div className={`${widthClass} w-full space-y-8`}>
        <div className="flex flex-col items-center text-center">
          <AnixiLogo variant="auth" linkTo={null} showWordmark={false} />
          <h1 className={`text-3xl font-semibold text-anixi-green ${titleClassName}`}>{title}</h1>
          {subtitle && (
            <p className="mt-3 max-w-sm font-sans text-sm leading-relaxed text-gray-600">{subtitle}</p>
          )}
        </div>
        {children}
      </div>
    </div>
  );
};
