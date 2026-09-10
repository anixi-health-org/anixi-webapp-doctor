import clsx from 'clsx';
import React, { type CSSProperties, type ReactNode } from 'react';

type FadeInProps = {
  children: ReactNode;
  delay?: number;
  className?: string;
  variant?: 'up' | 'subtle';
};

export function AyahFadeIn({
  children,
  delay = 0,
  className,
  variant = 'up',
}: FadeInProps) {
  return (
    <div
      className={clsx(
        'motion-reduce:animate-none motion-reduce:opacity-100',
        variant === 'up' ? 'animate-ayah-fade-in-up' : 'animate-ayah-fade-in',
        className,
      )}
      style={
        {
          animationDelay: `${delay}ms`,
          animationFillMode: 'both',
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}

export function ayahMessageClass(className?: string) {
  return clsx(
    'animate-ayah-message-in motion-reduce:animate-none',
    className,
  );
}

export function ayahWidgetClass(index: number, className?: string) {
  return clsx(
    'animate-ayah-fade-in-up motion-reduce:animate-none motion-reduce:opacity-100',
    className,
  );
}

export function ayahWidgetStyle(index: number): CSSProperties {
  return {
    animationDelay: `${Math.min(index * 80, 480)}ms`,
    animationFillMode: 'both',
  };
}
