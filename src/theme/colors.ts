export type ThemeColors = {
  background: string;
  backgroundAlt: string;
  surface: string;
  surfaceElevated: string;
  primary: string;
  primarySoft: string;
  secondary: string;
  secondarySoft: string;
  accent: string;
  accentSoft: string;
  card: string;
  cardSoft: string;
  cardElevated: string;
  borderSubtle: string;
  borderMedium: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textOnPrimary: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  gradient: readonly [string, string, string];
  gradientAccent: readonly [string, string];
  gradientCard: readonly [string, string];
  inputBg: string;
  overlay: string;
  shimmer: string;
  divider: string;
  tabBar: string;
  tabBarBorder: string;
};

export const darkColors: ThemeColors = {
  background: '#080808',
  backgroundAlt: '#101010',
  surface: '#141414',
  surfaceElevated: '#1c1c1c',
  primary: '#c8a55a',
  primarySoft: 'rgba(200, 165, 90, 0.10)',
  secondary: '#dcc9a3',
  secondarySoft: 'rgba(220, 201, 163, 0.08)',
  accent: '#e8dbc4',
  accentSoft: 'rgba(232, 219, 196, 0.10)',
  card: '#151515',
  cardSoft: 'rgba(21, 21, 21, 0.94)',
  cardElevated: '#1a1a1a',
  borderSubtle: 'rgba(200, 165, 90, 0.10)',
  borderMedium: 'rgba(200, 165, 90, 0.22)',
  textPrimary: '#f7f3ee',
  textSecondary: '#a09890',
  textMuted: '#686058',
  textOnPrimary: '#080808',
  success: '#5ecc8a',
  successSoft: 'rgba(94, 204, 138, 0.12)',
  warning: '#e8b84a',
  warningSoft: 'rgba(232, 184, 74, 0.12)',
  danger: '#e8635a',
  dangerSoft: 'rgba(232, 99, 90, 0.12)',
  gradient: ['#080808', '#0c0c0c', '#111111'],
  gradientAccent: ['#c8a55a', '#dcc9a3'],
  gradientCard: ['#151515', '#1a1a1a'],
  inputBg: '#141414',
  overlay: 'rgba(0, 0, 0, 0.65)',
  shimmer: 'rgba(200, 165, 90, 0.06)',
  divider: 'rgba(200, 165, 90, 0.06)',
  tabBar: '#0a0a0a',
  tabBarBorder: 'rgba(200, 165, 90, 0.08)',
};

export const lightColors: ThemeColors = {
  background: '#fcfaf7',
  backgroundAlt: '#f5f1eb',
  surface: '#f8f5f0',
  surfaceElevated: '#ffffff',
  primary: '#9c7d3a',
  primarySoft: 'rgba(156, 125, 58, 0.08)',
  secondary: '#7a6545',
  secondarySoft: 'rgba(122, 101, 69, 0.06)',
  accent: '#b89850',
  accentSoft: 'rgba(184, 152, 80, 0.08)',
  card: '#ffffff',
  cardSoft: 'rgba(255, 255, 255, 0.97)',
  cardElevated: '#ffffff',
  borderSubtle: 'rgba(156, 125, 58, 0.10)',
  borderMedium: 'rgba(156, 125, 58, 0.20)',
  textPrimary: '#18140e',
  textSecondary: '#665c50',
  textMuted: '#988e82',
  textOnPrimary: '#ffffff',
  success: '#2a9d5c',
  successSoft: 'rgba(42, 157, 92, 0.08)',
  warning: '#c48a1a',
  warningSoft: 'rgba(196, 138, 26, 0.08)',
  danger: '#c43a32',
  dangerSoft: 'rgba(196, 58, 50, 0.08)',
  gradient: ['#fcfaf7', '#f8f5f0', '#f5f1eb'],
  gradientAccent: ['#9c7d3a', '#b89850'],
  gradientCard: ['#ffffff', '#fcfaf7'],
  inputBg: '#f5f1eb',
  overlay: 'rgba(0, 0, 0, 0.25)',
  shimmer: 'rgba(156, 125, 58, 0.04)',
  divider: 'rgba(156, 125, 58, 0.06)',
  tabBar: '#fcfaf7',
  tabBarBorder: 'rgba(156, 125, 58, 0.08)',
};

export const colors: ThemeColors = darkColors;
