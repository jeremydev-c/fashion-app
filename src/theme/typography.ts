import { Platform, TextStyle } from 'react-native';
import { colors } from './colors';
import { fontSize, fluidFontSize } from '../utils/responsive';

type TextVariants =
  | 'display'
  | 'headline'
  | 'title'
  | 'subtitle'
  | 'sectionTitle'
  | 'sectionLabel'
  | 'body'
  | 'bodyBold'
  | 'caption'
  | 'overline'
  | 'mono';

export const typography: Record<TextVariants, TextStyle> = {
  display: {
    fontSize: fluidFontSize(30, 42),
    fontWeight: '300',
    letterSpacing: -0.8,
    color: colors.textPrimary,
  },
  headline: {
    fontSize: fluidFontSize(24, 34),
    fontWeight: '600',
    letterSpacing: -0.5,
    color: colors.textPrimary,
  },
  title: {
    fontSize: fluidFontSize(20, 28),
    fontWeight: '600',
    letterSpacing: -0.3,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: fluidFontSize(15, 18),
    fontWeight: '400',
    letterSpacing: 0.1,
    color: colors.textSecondary,
  },
  sectionTitle: {
    fontSize: fluidFontSize(17, 21),
    fontWeight: '600',
    letterSpacing: -0.2,
    color: colors.textPrimary,
  },
  sectionLabel: {
    fontSize: fluidFontSize(11, 13),
    fontWeight: '600',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  body: {
    fontSize: fontSize(14, 0.9, 1.1),
    fontWeight: '400',
    letterSpacing: 0.1,
    lineHeight: fontSize(14, 0.9, 1.1) * 1.6,
    color: colors.textSecondary,
  },
  bodyBold: {
    fontSize: fontSize(14, 0.9, 1.1),
    fontWeight: '600',
    letterSpacing: 0.1,
    color: colors.textPrimary,
  },
  caption: {
    fontSize: fontSize(12, 0.85, 1.0),
    fontWeight: '400',
    letterSpacing: 0.2,
    color: colors.textMuted,
  },
  overline: {
    fontSize: fontSize(10, 0.85, 1.0),
    fontWeight: '600',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: colors.primary,
  },
  mono: {
    fontSize: fontSize(13, 0.85, 1.0),
    fontWeight: '500',
    letterSpacing: 0.5,
    color: colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
};
