/**
 * Responsive Spacing (2025 Standards)
 * Mobile-first approach with adaptive spacing based on screen size
 */
import { getResponsiveSpacing } from '../utils/responsive';

export const spacing = {
  xs: getResponsiveSpacing(4),
  sm: getResponsiveSpacing(8),
  md: getResponsiveSpacing(12),
  lg: getResponsiveSpacing(16),
  xl: getResponsiveSpacing(24),
  '2xl': getResponsiveSpacing(32),
  '3xl': getResponsiveSpacing(48),
  '4xl': getResponsiveSpacing(140), // For tab bar padding
};
