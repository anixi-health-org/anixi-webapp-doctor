import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UsersIcon, SparklesIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { AnixiLogo } from '../brand/AnixiLogo';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  titleClassName?: string;
  maxWidth?: 'md' | 'lg' | 'xl' | '2xl';
  /** Denser spacing so join / auth steps fit a single viewport */
  compact?: boolean;
}

const HERO_SLIDES = [
  {
    heading: 'Chronic care, made continuous',
    description:
      'Support your Warriors between visits. Track medication adherence, mood, and vitals in one clinical dashboard.',
    caption: 'Continuous monitoring',
    image: '/hero-care.png',
  },
  {
    heading: 'Every patient, truly connected',
    description:
      'Telemedicine, shared records, and real-time insights link you to patients and their caregivers across Africa.',
    caption: 'Telemedicine ready',
    image: '/hero-insight.png',
  },
  {
    heading: 'Care beyond the clinic',
    description:
      'Coordinate with caregivers and Ayah, our AI companion, to guide and support patients around the clock.',
    caption: 'Connected support',
    image: '/hero-connect.png',
  },
];

const HERO_STATS = [
  { icon: UsersIcon, value: '12+', label: 'Condition communities' },
  { icon: SparklesIcon, value: '24/7', label: 'Ayah AI companion' },
  { icon: ShieldCheckIcon, value: 'POPIA', label: 'Secure & compliant' },
];

const AuthHero: React.FC = () => {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActive((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 6000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative hidden h-full min-h-0 overflow-hidden bg-[#0d1310] lg:flex lg:flex-col lg:p-7 xl:p-9">
      {HERO_SLIDES.map((slide, index) => (
        <div
          key={slide.image}
          aria-hidden
          className={`absolute inset-0 bg-cover bg-center transition-opacity duration-[1200ms] ease-out ${
            index === active ? 'scale-100 opacity-100' : 'scale-105 opacity-0'
          }`}
          style={{ backgroundImage: `url(${slide.image})`, transitionProperty: 'opacity, transform' }}
        />
      ))}

      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-[#0a0f0c]/85 via-[#0a0f0c]/15 to-transparent"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-[#0a0f0c]/90 via-[#0a0f0c]/35 to-transparent"
      />
      <div aria-hidden className="absolute inset-0 bg-[#132018]/15" />

      <div className="relative z-10 flex min-h-0 flex-1 items-center">
        {HERO_SLIDES.map((slide, index) => (
          <div
            key={slide.heading}
            className={`absolute inset-x-0 flex flex-col transition-all duration-700 ease-out ${
              index === active
                ? 'translate-y-0 opacity-100'
                : 'pointer-events-none translate-y-3 opacity-0'
            }`}
          >
            <h2 className="max-w-xl font-heading text-3xl font-semibold leading-[1.08] tracking-tight text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.55)] xl:text-[2.35rem]">
              {slide.heading}
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/90 [text-shadow:0_1px_10px_rgba(0,0,0,0.5)] xl:text-base">
              {slide.description}
            </p>
          </div>
        ))}
      </div>

      <div className="relative z-10 shrink-0 space-y-3.5">
        <div className="grid grid-cols-3 gap-2.5">
          {HERO_STATS.map(({ icon: Icon, value, label }) => (
            <div
              key={label}
              className="rounded-xl border border-white/15 bg-white/10 p-3 shadow-[0_8px_30px_rgba(0,0,0,0.25)] backdrop-blur-md"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20">
                <Icon className="h-3.5 w-3.5 text-[#e7ce8f]" />
              </span>
              <p className="mt-2 font-heading text-xl font-semibold text-white">{value}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-white/75">{label}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium tracking-wide text-[#e7ce8f] [text-shadow:0_1px_8px_rgba(0,0,0,0.5)]">
            {HERO_SLIDES[active].caption}
          </span>
          <div className="flex items-center gap-2">
            {HERO_SLIDES.map((slide, index) => (
              <button
                key={slide.heading}
                type="button"
                onClick={() => setActive(index)}
                aria-label={`Show slide ${index + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === active ? 'w-7 bg-[#e7ce8f]' : 'w-2.5 bg-white/35 hover:bg-white/60'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  title,
  subtitle,
  titleClassName = 'font-heading',
  maxWidth = 'md',
  compact = false,
}) => {
  const widthClass = {
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
    '2xl': 'max-w-3xl',
  }[maxWidth];

  return (
    <div className="h-dvh max-h-dvh w-full overflow-hidden bg-anixi-beige lg:grid lg:grid-cols-2">
      <div
        className={`relative flex h-full min-h-0 flex-col items-center justify-center overflow-x-hidden px-4 sm:px-6 lg:px-8 ${
          compact
            ? 'overflow-hidden py-4 sm:py-5'
            : 'overflow-y-auto py-6 sm:py-8 lg:overflow-y-auto'
        }`}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,rgba(66,89,80,0.07),transparent_55%),radial-gradient(circle_at_82%_88%,rgba(231,206,143,0.16),transparent_52%)]" />
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-anixi-green/15 blur-[70px]" />
          <div className="absolute -bottom-28 -right-16 h-80 w-80 rounded-full bg-[#e7ce8f]/25 blur-[70px]" />
          <div className="absolute inset-0 opacity-50 [background-image:radial-gradient(rgba(66,89,80,0.12)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)] [-webkit-mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]" />
        </div>

        <div
          className={`relative ${widthClass} w-full ${compact ? 'space-y-3' : 'space-y-5'}`}
        >
          <div className="flex flex-col items-center text-center">
            <AnixiLogo variant="auth" linkTo={null} showWordmark={false} />
            <h1
              className={`font-semibold text-anixi-green ${titleClassName} ${
                compact ? 'text-2xl sm:text-[1.75rem]' : 'text-3xl'
              }`}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                className={`max-w-md font-sans leading-relaxed text-gray-600 ${
                  compact ? 'mt-1.5 text-sm' : 'mt-2 text-sm'
                }`}
              >
                {subtitle}
              </p>
            )}
          </div>
          {children}
          <p className="text-center text-sm text-gray-500">
            <Link to="/privacy" className="font-medium text-anixi-green hover:underline">
              Privacy notice (POPIA)
            </Link>
          </p>
        </div>
      </div>

      <AuthHero />
    </div>
  );
};
