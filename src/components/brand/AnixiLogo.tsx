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
  linkTo = '/ayah',
  onClick,
}) => {
  const isSidebar = variant === 'sidebar';
  const isAuth = variant === 'auth';

  if (isAuth && !showWordmark) {
    const img = (
      <img
        src="/anixi.png"
        alt="Anixi Health"
        className="mx-auto mb-1.5 h-14 w-14 object-contain sm:h-16 sm:w-16"
      />
    );
    return linkTo ? <Link to={linkTo} onClick={onClick}>{img}</Link> : img;
  }

  const content = (
    <div className={clsx('flex items-center gap-3.5', className)}>
      {/* White mark on black: screen blend drops the black so only the emblem shows on green */}
      <img
        src={isSidebar ? '/anixi-logo-white.png' : '/anixi.png'}
        alt=""
        className={clsx(
          'shrink-0 object-contain',
          isSidebar && 'h-14 w-14 mix-blend-screen',
          isAuth && 'h-16 w-16',
          variant === 'header' && 'h-8 w-8'
        )}
        aria-hidden
      />
      <div className="min-w-0">
        <p
          className={clsx(
            'font-sans font-semibold leading-tight tracking-tight',
            isSidebar && 'text-[1.15rem] text-white',
            isAuth && 'text-2xl text-anixi-green',
            variant === 'header' && 'text-sm text-anixi-green'
          )}
        >
          Anixi Health
        </p>
        {showTagline && (
          <p
            className={clsx(
              'font-sans font-medium tracking-[0.04em]',
              isSidebar && 'mt-0.5 text-xs text-white/90',
              (isAuth || variant === 'header') && 'text-[11px] text-gray-500'
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
