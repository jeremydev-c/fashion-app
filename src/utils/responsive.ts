/**
 * Responsive Utilities for Fashion Fit (2025 Standards)
 * Mobile-first, responsive design with support for:
 * - Compact smartphones (320px+)
 * - Standard phones (375px-414px)
 * - Large phones (414px-767px)
 * - Tablets (768px-1023px)
 * - Desktop/Ultra-wide (1024px+)
 * - Foldable devices
 * - Safe areas (notches, camera cutouts)
 */

import { Dimensions, PixelRatio, Platform, ScaledSize } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Get initial dimensions
export const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base dimensions (iPhone 14 Pro as reference - mobile-first)
const BASE_WIDTH = 393;
const BASE_HEIGHT = 852;

// 2025 Breakpoints (mobile-first approach)
export const BREAKPOINTS = {
  mobile: 320,      // Smallest mobile
  mobileMedium: 375, // Standard mobile
  mobileLarge: 414,  // Large mobile
  tablet: 768,       // Tablet
  desktop: 1024,    // Desktop
  desktopLarge: 1440, // Large desktop
} as const;

/**
 * Screen size detection (2025 standards)
 */
export const getScreenSize = (): 'small' | 'medium' | 'large' | 'tablet' | 'desktop' => {
  if (SCREEN_WIDTH < BREAKPOINTS.mobileMedium) return 'small';
  if (SCREEN_WIDTH < BREAKPOINTS.mobileLarge) return 'medium';
  if (SCREEN_WIDTH < BREAKPOINTS.tablet) return 'large';
  if (SCREEN_WIDTH < BREAKPOINTS.desktop) return 'tablet';
  return 'desktop';
};

export const isSmallDevice = SCREEN_WIDTH < BREAKPOINTS.mobileMedium;
export const isMediumDevice = SCREEN_WIDTH >= BREAKPOINTS.mobileMedium && SCREEN_WIDTH < BREAKPOINTS.mobileLarge;
export const isLargeDevice = SCREEN_WIDTH >= BREAKPOINTS.mobileLarge && SCREEN_WIDTH < BREAKPOINTS.tablet;
export const isTablet = SCREEN_WIDTH >= BREAKPOINTS.tablet && SCREEN_WIDTH < BREAKPOINTS.desktop;
export const isDesktop = SCREEN_WIDTH >= BREAKPOINTS.desktop;
export const isFoldable = SCREEN_WIDTH >= 600 && SCREEN_HEIGHT >= 800; // Approximate foldable detection

/**
 * Scale a value based on screen width (horizontal scaling)
 * Use for horizontal spacing, widths, font sizes
 * Mobile-first: scales from base width
 */
export const wp = (percentage: number): number => {
  return PixelRatio.roundToNearestPixel((SCREEN_WIDTH * percentage) / 100);
};

/**
 * Scale a value based on screen height (vertical scaling)
 * Use for vertical spacing, heights
 */
export const hp = (percentage: number): number => {
  return PixelRatio.roundToNearestPixel((SCREEN_HEIGHT * percentage) / 100);
};

/**
 * Scale a fixed value proportionally to screen width
 * Use for font sizes, icon sizes, fixed dimensions
 * Mobile-first approach
 */
export const scale = (size: number): number => {
  const scaleRatio = SCREEN_WIDTH / BASE_WIDTH;
  const newSize = size * scaleRatio;
  // Clamp to prevent extreme scaling
  const minSize = size * 0.8;
  const maxSize = size * 1.3;
  const clampedSize = Math.max(minSize, Math.min(maxSize, newSize));
  return Math.round(PixelRatio.roundToNearestPixel(clampedSize));
};

/**
 * Moderate scale (less aggressive scaling)
 * Better for text to prevent too large/small fonts
 * Factor: 0.3-0.5 recommended for text
 */
export const moderateScale = (size: number, factor: number = 0.5): number => {
  const scaleRatio = SCREEN_WIDTH / BASE_WIDTH;
  return Math.round(size + (size * (scaleRatio - 1) * factor));
};

/**
 * Scale vertical values proportionally
 */
export const verticalScale = (size: number): number => {
  const scaleRatio = SCREEN_HEIGHT / BASE_HEIGHT;
  return Math.round(PixelRatio.roundToNearestPixel(size * scaleRatio));
};

/**
 * CSS clamp() equivalent for React Native
 * Ensures font sizes scale smoothly between min and max
 * @param min Minimum size (for small screens)
 * @param preferred Preferred size (scaled)
 * @param max Maximum size (for large screens)
 */
export const clamp = (min: number, preferred: number, max: number): number => {
  const scaled = moderateScale(preferred, 0.3);
  return Math.max(min, Math.min(max, scaled));
};

/**
 * Responsive font size with clamp-like behavior
 * Ensures readable text on all devices (2025 standard)
 * @param size Base font size
 * @param minFactor Minimum multiplier (default 0.8)
 * @param maxFactor Maximum multiplier (default 1.3)
 */
export const fontSize = (size: number, minFactor: number = 0.8, maxFactor: number = 1.3): number => {
  const scaledSize = moderateScale(size, 0.3);
  const minSize = size * minFactor;
  const maxSize = size * maxFactor;
  return Math.max(minSize, Math.min(maxSize, scaledSize));
};

/**
 * Fluid typography - scales smoothly across breakpoints
 * Similar to CSS clamp() function
 */
export const fluidFontSize = (minSize: number, maxSize: number, viewportWidth: number = SCREEN_WIDTH): number => {
  // Calculate preferred size based on viewport
  const preferred = minSize + ((maxSize - minSize) * ((viewportWidth - BREAKPOINTS.mobile) / (BREAKPOINTS.desktop - BREAKPOINTS.mobile)));
  return clamp(minSize, preferred, maxSize);
};

/**
 * Safe area helpers (2025 standards)
 * Handles notches, camera cutouts, rounded corners
 */
export const isIphoneX = Platform.OS === 'ios' && (SCREEN_HEIGHT >= 812 || SCREEN_WIDTH >= 812);
export const statusBarHeight = Platform.OS === 'ios' ? (isIphoneX ? 44 : 20) : 0;
export const bottomBarHeight = isIphoneX ? 34 : 0;

/**
 * Get responsive spacing based on screen size
 * Mobile-first: smaller screens get tighter spacing
 */
export const getResponsiveSpacing = (base: number): number => {
  const screenSize = getScreenSize();
  const multipliers: Record<string, number> = {
    small: 0.85,
    medium: 0.9,
    large: 1.0,
    tablet: 1.1,
    desktop: 1.2,
  };
  return scale(base * (multipliers[screenSize] || 1.0));
};

/**
 * Get responsive padding for containers
 * Adapts to screen size and safe areas
 */
export const getContainerPadding = (base: number = 16): number => {
  if (isTablet) return scale(base * 1.5);
  if (isDesktop) return scale(base * 2);
  return scale(base);
};

/**
 * Grid column calculation (responsive)
 * Mobile: 1-2 columns, Tablet: 2-3 columns, Desktop: 3-4 columns
 */
export const getGridColumns = (preferred: number = 2): number => {
  if (isSmallDevice) return Math.min(preferred, 1);
  if (isTablet) return Math.min(preferred + 1, 3);
  if (isDesktop) return Math.min(preferred + 2, 4);
  return preferred;
};

/**
 * Card width calculation (responsive grid)
 */
export const getCardWidth = (columns: number = 2, gap: number = 16): number => {
  const containerPadding = getContainerPadding();
  const totalGap = gap * (columns - 1);
  return (SCREEN_WIDTH - containerPadding * 2 - totalGap) / columns;
};

/**
 * Thumb-friendly zone helper
 * Places primary actions in bottom third of screen (2025 UX standard)
 */
export const isInThumbZone = (y: number): boolean => {
  return y > SCREEN_HEIGHT * 0.67;
};

/**
 * Responsive image dimensions
 * Maintains aspect ratio while fitting screen
 */
export const getImageDimensions = (
  originalWidth: number,
  originalHeight: number,
  maxWidth?: number,
  maxHeight?: number
): { width: number; height: number } => {
  const maxW = maxWidth || SCREEN_WIDTH;
  const maxH = maxHeight || SCREEN_HEIGHT * 0.6;
  
  const aspectRatio = originalWidth / originalHeight;
  
  let width = maxW;
  let height = maxW / aspectRatio;
  
  if (height > maxH) {
    height = maxH;
    width = maxH * aspectRatio;
  }
  
  return {
    width: Math.round(width),
    height: Math.round(height),
  };
};

/**
 * Common responsive values (2025 standards)
 */
export const responsive = {
  // Spacing (mobile-first)
  xs: getResponsiveSpacing(4),
  sm: getResponsiveSpacing(8),
  md: getResponsiveSpacing(12),
  lg: getResponsiveSpacing(16),
  xl: getResponsiveSpacing(24),
  xxl: getResponsiveSpacing(32),
  '3xl': getResponsiveSpacing(40),
  
  // Font sizes (with clamp-like behavior)
  fontTiny: fontSize(10),
  fontSmall: fontSize(12),
  fontBody: fontSize(14),
  fontMedium: fontSize(16),
  fontLarge: fontSize(18),
  fontXL: fontSize(22),
  fontXXL: fontSize(28),
  fontDisplay: fontSize(34),
  
  // Border radius
  radiusSm: scale(8),
  radiusMd: scale(12),
  radiusLg: scale(16),
  radiusXL: scale(24),
  radiusFull: scale(999),
  
  // Icon sizes
  iconSm: scale(16),
  iconMd: scale(20),
  iconLg: scale(24),
  iconXL: scale(32),
  iconXXL: scale(48),
  
  // Screen dimensions
  screenWidth: SCREEN_WIDTH,
  screenHeight: SCREEN_HEIGHT,
  
  // Container padding
  containerPadding: getContainerPadding(16),
  containerPaddingLarge: getContainerPadding(24),
  
  // Grid
  cardWidth: getCardWidth(2, 16),
  cardWidthTablet: getCardWidth(3, 16),
  listItemHeight: verticalScale(72),
  
  // Breakpoints
  breakpoints: BREAKPOINTS,
  
  // Device detection
  isSmallDevice,
  isMediumDevice,
  isLargeDevice,
  isTablet,
  isDesktop,
  isFoldable,
};

/**
 * Hook for responsive values (use in components)
 */
export const useResponsive = () => {
  const insets = useSafeAreaInsets();
  
  return {
    ...responsive,
    safeArea: {
      top: insets.top,
      bottom: insets.bottom,
      left: insets.left,
      right: insets.right,
    },
    screenSize: getScreenSize(),
    gridColumns: getGridColumns(2),
  };
};

export default responsive;
