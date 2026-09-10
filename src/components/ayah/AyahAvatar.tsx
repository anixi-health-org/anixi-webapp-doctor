import ayahImage from '../../assets/ayah.png';

type Props = {
  size?: 'md' | 'lg';
  className?: string;
};

const SIZE_CLASS = {
  md: 'h-9 w-9',
  lg: 'h-14 w-14',
} as const;

export function AyahAvatar({ size = 'lg', className = '' }: Props) {
  return (
    <img
      src={ayahImage}
      alt="Ayah"
      className={`shrink-0 rounded-full object-cover shadow-md ring-2 ring-white ${SIZE_CLASS[size]} ${className}`}
    />
  );
}
