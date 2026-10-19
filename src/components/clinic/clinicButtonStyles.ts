import clsx from 'clsx';

export type ClinicButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'dangerOutline';

export type ClinicButtonSize = 'md' | 'sm';

const sizeClass: Record<ClinicButtonSize, string> = {
  md: 'rounded-full px-5 py-2.5 text-sm font-semibold',
  sm: 'rounded-full px-3.5 py-1.5 text-sm font-semibold',
};

const variantClass: Record<ClinicButtonVariant, string> = {
  primary: 'bg-anixi-green text-white shadow-sm transition hover:opacity-90 disabled:opacity-50',
  secondary:
    'border-2 border-anixi-green bg-white text-anixi-green transition hover:bg-anixi-green/5 disabled:opacity-50',
  outline:
    'border border-[#e1e7ef] bg-white text-[#344256] shadow-sm transition hover:border-[#c5cdd8] hover:bg-[#f8fafc] disabled:opacity-50',
  ghost: 'text-[#65758b] transition hover:bg-[#f1f5f9] disabled:opacity-50',
  danger: 'bg-red-600 text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50',
  dangerOutline:
    'border border-red-200 bg-white text-red-600 transition hover:bg-red-50 disabled:opacity-50',
};

export function clinicButtonClasses(
  variant: ClinicButtonVariant,
  size: ClinicButtonSize = 'md',
  extra?: string,
): string {
  return clsx(
    'inline-flex items-center justify-center gap-1.5 disabled:cursor-not-allowed',
    sizeClass[size],
    variantClass[variant],
    extra,
  );
}
