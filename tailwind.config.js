
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        heading: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        card: '0 1px 3px 0 rgb(0 0 0 / 0.05), 0 4px 12px -2px rgb(66 89 80 / 0.08)',
        elevated: '0 4px 6px -1px rgb(0 0 0 / 0.06), 0 10px 24px -4px rgb(66 89 80 / 0.1)',
      },
      colors: {
        'anixi-beige': '#F3F6EA', 
        'anixi-green': '#425950',
        'anixi-teal': '#427160',
        'anixi-card': '#F5F5F5',
        'anixi-slate': '#f8fafc',
        'anixi-ink': '#344256',
        'anixi-muted': '#65758b',
        'anixi-line': '#e1e7ef',
        border: 'hsl(var(--border) / <alpha-value>)',
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        card: 'hsl(var(--card) / <alpha-value>)',
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
      },
      keyframes: {
        'ayah-fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'ayah-fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'ayah-message-in': {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'ayah-composer-enter': {
          '0%': { opacity: '0', transform: 'translateY(10px) scale(0.985)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'ayah-composer-breathe': {
          '0%, 100%': {
            boxShadow:
              '0 1px 2px rgba(28,39,49,0.04), 0 10px 28px rgba(28,39,49,0.06)',
          },
          '50%': {
            boxShadow:
              '0 2px 8px rgba(66,113,96,0.08), 0 14px 32px rgba(28,39,49,0.07)',
          },
        },
        'ayah-send-ready': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.06)' },
        },
        'ayah-shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'ayah-fade-in-up': 'ayah-fade-in-up 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'ayah-fade-in': 'ayah-fade-in 0.45s ease-out forwards',
        'ayah-message-in': 'ayah-message-in 0.38s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'ayah-composer-enter': 'ayah-composer-enter 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'ayah-composer-breathe': 'ayah-composer-breathe 3.5s ease-in-out infinite',
        'ayah-send-ready': 'ayah-send-ready 2.4s ease-in-out infinite',
        'ayah-shimmer': 'ayah-shimmer 2.2s linear infinite',
      },
    },
  },
  plugins: [],
}
