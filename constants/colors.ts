export const Colors = {
  primary: '#FF6B35',
  primaryDark: '#E55A2B',
  secondary: '#2A9D8F',
  accent: '#E9C46A',
  success: '#2A9D8F',
  warning: '#E9C46A',
  error: '#E63946',
  background: '#F8F9FA',
  surface: '#FFFFFF',
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  peachSoft: '#FFECE0',
  peachMid: '#FFE2D0',
  platinum: '#C0C0C0',
  gold: '#FFD700',
  secondaryContainer: '#E8DEF8',
  dangerSoft: '#FEE2E2',
  primarySoft: 'rgba(255,107,53,0.10)',
  premium: '#FF6B35',
  star: '#F59E0B',
  white: '#FFFFFF',
  black: '#000000',
  shadow: 'rgba(0,0,0,0.08)',
  cardGradient: ['#FF6B35', '#FF8F5A'] as const,
};

export type Palette = typeof Colors;

/**
 * Dark theme palette (paridad con los tokens `.dark` de la web, con dos
 * excepciones deliberadas): `primary`, `error` y `secondary` mantienen los
 * valores de marca porque se usan como FONDO de botones con texto blanco
 * (en la web esos roles los cumplen tokens tipo `primary-container` con
 * texto oscuro — la app mobile tiene un solo token por rol).
 */
export const DarkColors: Palette = {
  primary: '#FF6B35',
  primaryDark: '#E55A2B',
  secondary: '#2A9D8F',
  accent: '#E9C46A',
  success: '#6FD8C8',
  warning: '#E9C46A',
  error: '#E63946',
  background: '#111315',
  surface: '#1A1C1D',
  text: '#E1E3E4',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  border: '#2D2F30',
  borderLight: '#222426',
  peachSoft: '#2D1E14',
  peachMid: '#3D2818',
  platinum: '#C0C0C0',
  gold: '#FFD700',
  secondaryContainer: '#4A4458',
  dangerSoft: '#3A1D1D',
  primarySoft: 'rgba(255,107,53,0.15)',
  premium: '#FF6B35',
  star: '#F59E0B',
  white: '#FFFFFF',
  black: '#000000',
  shadow: 'rgba(0,0,0,0.25)',
  cardGradient: ['#FF6B35', '#FF8F5A'] as const,
};

export const CategoryColors = {
  'autos-motos': '#2563EB',
  inmuebles: '#FF6B35',
  'resto-bares-cafeterias': '#DC2626',
  'celulares-accesorios': '#78716C',
  'servicios-comercios': '#2A9D8F',
};
