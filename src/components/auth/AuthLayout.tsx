import React, { useEffect, useState } from 'react';
import { UsersIcon, SparklesIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { AnixiLogo } from '../brand/AnixiLogo';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  titleClassName?: string;
  maxWidth?: 'md' | 'lg' | 'xl';
}

const HERO_SLIDES = [
  {
    heading: 'Chronic care, made continuous',
    description:
      'Support your Warriors between visits — track medication adherence, mood, and vitals in one clinical dashboard.',
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
    <div className="relative hidden overflow-hidden bg-[#0d1310] lg:flex lg:flex-col lg:p-12 xl:p-14">
      {/* Crossfading background images */}
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

      {/* Directional scrims — keep photo visible, text legible */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-[#0a0f0c]/85 via-[#0a0f0c]/15 to-transparent"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-[#0a0f0c]/90 via-[#0a0f0c]/35 to-transparent"
      />
      {/* Subtle brand tint + vignette */}
      <div aria-hidden className="absolute inset-0 bg-[#132018]/15" />

      {/* Rotating headline */}
      <div className="relative z-10 flex flex-1 items-center">
        {HERO_SLIDES.map((slide, index) => (
          <div
            key={slide.heading}
            className={`absolute inset-x-0 flex flex-col transition-all duration-700 ease-out ${
              index === active
                ? 'translate-y-0 opacity-100'
                : 'pointer-events-none translate-y-3 opacity-0'
            }`}
          >
            <h2 className="max-w-xl font-heading text-4xl font-semibold leading-[1.08] tracking-tight text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.55)] xl:text-[3.25rem]">
              {slide.heading}
            </h2>
            <p className="mt-5 max-w-md text-base leading-relaxed text-white/90 [text-shadow:0_1px_10px_rgba(0,0,0,0.5)]">
              {slide.description}
            </p>
          </div>
        ))}
      </div>

      {/* Stats + carousel controls */}
      <div className="relative z-10 space-y-7">
        <div className="grid grid-cols-3 gap-3">
          {HERO_STATS.map(({ icon: Icon, value, label }) => (
            <div
              key={label}
              className="rounded-2xl border border-white/15 bg-white/10 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.25)] backdrop-blur-md"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20">
                <Icon className="h-4 w-4 text-[#e7ce8f]" />
              </span>
              <p className="mt-3 font-heading text-2xl font-semibold text-white">{value}</p>
              <p className="mt-0.5 text-xs leading-snug text-white/75">{label}</p>
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
}) => {
  const widthClass = {
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  }[maxWidth];

  return (
    <div className="min-h-screen w-full bg-anixi-beige lg:grid lg:grid-cols-2">
      {/* Form panel */}
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10 sm:px-6 lg:px-8">
        {/* Decorative brand backdrop */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,rgba(66,89,80,0.07),transparent_55%),radial-gradient(circle_at_82%_88%,rgba(231,206,143,0.16),transparent_52%)]" />
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-anixi-green/15 blur-[70px]" />
          <div className="absolute -bottom-28 -right-16 h-80 w-80 rounded-full bg-[#e7ce8f]/25 blur-[70px]" />
          <div className="absolute inset-0 opacity-50 [background-image:radial-gradient(rgba(66,89,80,0.12)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)] [-webkit-mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]" />
        </div>

        <div className={`relative ${widthClass} w-full space-y-8`}>
          <div className="flex flex-col items-center text-center">
            <AnixiLogo variant="auth" linkTo={null} showWordmark={false} />
            <h1 className={`text-3xl font-semibold text-anixi-green ${titleClassName}`}>{title}</h1>
            {subtitle && (
              <p className="mt-3 max-w-sm font-sans text-sm leading-relaxed text-gray-600">
                {subtitle}
              </p>
            )}
          </div>
          {children}
          <p className="text-center text-xs text-gray-500">
            <a href="/privacy" className="text-anixi-green hover:underline">
              Privacy notice (POPIA)
            </a>
          </p>
        </div>
      </div>

      {/* Hero panel */}
      <AuthHero />
    </div>
  );
};
