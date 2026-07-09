import clsx from 'clsx';
import React from 'react';
import { Link } from 'react-router-dom';

interface AnixiLogoProps {
  variant?: 'sidebar' | 'header' | 'auth';
  showTagline?: boolean;
  showWordmark?: boolean;
  subtitle?: string;
  className?: string;
  linkTo?: string | null;
  onClick?: () => void;
}

export const AnixiLogo: React.FC<AnixiLogoProps> = ({
  variant = 'sidebar',
  showTagline = true,
  showWordmark = true,
  subtitle = 'Doctor Portal',
  className,
  linkTo = '/dashboard',
  onClick,
}) => {
  const isSidebar = variant === 'sidebar';
  const isAuth = variant === 'auth';

  if (isAuth && !showWordmark) {
    const img = (
      <img
        src="/anixi.png"
        alt="Anixi Health"
        className="mx-auto h-20 w-20 object-contain"
      />
    );
    return linkTo ? <Link to={linkTo} onClick={onClick}>{img}</Link> : img;
  }

  const content = (
    <div className={clsx('flex items-center gap-4', className)}>
      <img
        src="/anixi.png"
        alt=""
        className={clsx(
          'shrink-0 object-contain',
          isSidebar && 'h-16 w-16 rounded-xl bg-white p-2 shadow-lg ring-2 ring-white/40',
          isAuth && 'h-16 w-16',
          variant === 'header' && 'h-8 w-8 rounded-md'
        )}
        aria-hidden
      />
      <div className="min-w-0">
        <p
          className={clsx(
            'font-heading font-semibold leading-tight tracking-tight',
            isSidebar && 'text-xl text-white',
            isAuth && 'text-2xl text-anixi-green',
            variant === 'header' && 'text-sm text-anixi-green'
          )}
        >
          Anixi Health
        </p>
        {showTagline && (
          <p
            className={clsx(
              'font-sans text-xs font-semibold uppercase tracking-[0.14em]',
              isSidebar && 'text-white/90',
              (isAuth || variant === 'header') && 'text-gray-500'
            )}
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );

  if (linkTo) {
    return (
      <Link
        to={linkTo}
        onClick={onClick}
        className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        {content}
      </Link>
    );
  }

  return content;
};
