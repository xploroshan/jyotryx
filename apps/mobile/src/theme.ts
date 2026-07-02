/**
 * Design tokens mirrored from the web design system
 * (`apps/web/src/app/globals.css` @theme) so both clients share one visual
 * language. NativeWind classes cover most styling; this is for the cases that
 * need raw values (StatusBar, gradients, navigation theming, charts).
 */

export const colors = {
  // Warm Linen canvas
  bg: '#ede4d0',
  bgSubtle: '#e3d9c1',
  surface: '#fbf7ec',
  surfaceHover: '#f5efde',
  // Text
  fg: '#1a1410',
  fgMuted: '#5a5043',
  fgSubtle: '#807666',
  fgOnAccent: '#ffffff',
  // Lines / accent
  border: '#d4c9ad',
  borderStrong: '#bdaf90',
  accent: '#c43200',
  accentHover: '#a02900',
  accentSubtle: '#fce4d2',
  // Brand orange
  primary500: '#ff4d00',
  primary700: '#c43200',
  // Status
  success: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',
} as const;

export const radius = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 10,
  '2xl': 14,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
} as const;
