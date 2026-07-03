/**
 * NativeWind (Tailwind for RN) config. The colour tokens mirror the web
 * design system (`apps/web/src/app/globals.css` @theme) so the two clients
 * share one visual language — Warm Linen canvas, burnt-orange accent.
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Brand orange ladder (from web --color-primary-*)
        primary: {
          50: '#fff4ef',
          100: '#ffe5d6',
          200: '#ffc6a8',
          300: '#ffa07a',
          400: '#ff7a40',
          500: '#ff4d00',
          600: '#e63d00',
          700: '#c43200',
          800: '#a02900',
          900: '#7a2000',
        },
        // Warm Linen semantic tokens (from web v2 @theme)
        bg: '#ede4d0',
        'bg-subtle': '#e3d9c1',
        surface: '#fbf7ec',
        'surface-hover': '#f5efde',
        fg: '#1a1410',
        'fg-muted': '#5a5043',
        'fg-subtle': '#807666',
        'fg-onaccent': '#ffffff',
        border: '#d4c9ad',
        'border-strong': '#bdaf90',
        accent: '#c43200',
        'accent-hover': '#a02900',
        'accent-subtle': '#fce4d2',
        success: '#16a34a',
        warning: '#d97706',
        danger: '#dc2626',
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '10px',
        '2xl': '14px',
      },
    },
  },
  plugins: [],
};
