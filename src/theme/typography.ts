import { TextStyle } from 'react-native';
import { colors } from './colors';
import { fontSize, fluidFontSize, clamp } from '../utils/responsive';

// 2025 Typography Standards: Using clamp-like behavior for fluid typography
// Ensures readable text across all screen sizes (320px to 1440px+)

type TextVariants =
  | 'display'
  | 'title'
  | 'subtitle'
  | 'sectionTitle'
  | 'body'
  | 'bodyBold'
  | 'caption';

export const typography: Record<TextVariants, TextStyle> = {
  display: {
    fontSize: fluidFontSize(28, 40), // Clamps between 28px (mobile) and 40px (desktop)
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.textPrimary,
  },
  title: {
    fontSize: fluidFontSize(20, 28), // Clamps between 20px and 28px
    fontWeight: '700',
    letterSpacing: 0.3,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: fluidFontSize(14, 18), // Clamps between 14px and 18px
    fontWeight: '500',
    color: colors.textSecondary,
  },
  sectionTitle: {
    fontSize: fluidFontSize(16, 20), // Clamps between 16px and 20px
    fontWeight: '600',
    letterSpacing: 0.2,
    color: colors.textPrimary,
  },
  body: {
    fontSize: fontSize(14, 0.9, 1.1), // Moderate scaling with bounds
    fontWeight: '400',
    color: colors.textSecondary,
  },
  bodyBold: {
    fontSize: fontSize(14, 0.9, 1.1),
    fontWeight: '600',
    color: colors.textPrimary,
  },
  caption: {
    fontSize: fontSize(12, 0.85, 1.0), // Smaller text, tighter bounds
    color: colors.textMuted,
  },
};
