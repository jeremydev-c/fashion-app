# Fashion Fit - Responsive Design System (2025 Standards)

## Overview

Fashion Fit implements a **mobile-first, responsive design** approach that ensures the app fits perfectly on all screen sizes, from compact smartphones (320px) to ultra-wide monitors (1440px+), including foldable devices.

## Core Principles

### 1. Mobile-First Approach
- Design starts with smallest screens (320px width)
- Essential features prioritized
- Progressive enhancement for larger displays

### 2. Flexible Units
- Uses relative units (`scale()`, `wp()`, `hp()`) instead of fixed pixels
- Responsive spacing adapts to screen size
- Typography uses clamp-like behavior for fluid scaling

### 3. Breakpoints (2025 Standards)

```typescript
BREAKPOINTS = {
  mobile: 320,        // Smallest mobile
  mobileMedium: 375,  // Standard mobile
  mobileLarge: 414,   // Large mobile
  tablet: 768,        // Tablet
  desktop: 1024,      // Desktop
  desktopLarge: 1440, // Large desktop
}
```

### 4. Safe Areas
- Handles notches, camera cutouts, rounded corners
- Uses `useSafeAreaInsets()` from `react-native-safe-area-context`
- Proper padding for all device types

## Implementation

### Responsive Utilities

Located in: `src/utils/responsive.ts`

#### Core Functions

**`scale(size: number)`**
- Scales values based on screen width
- Use for: font sizes, icon sizes, fixed dimensions
- Clamps between 80% and 130% of original

**`wp(percentage: number)`**
- Width percentage (like CSS `vw`)
- Use for: horizontal spacing, widths

**`hp(percentage: number)`**
- Height percentage (like CSS `vh`)
- Use for: vertical spacing, heights

**`moderateScale(size: number, factor: number)`**
- Less aggressive scaling
- Use for: text (factor: 0.3-0.5)

**`clamp(min: number, preferred: number, max: number)`**
- CSS `clamp()` equivalent
- Ensures values stay within bounds

**`fluidFontSize(minSize: number, maxSize: number)`**
- Fluid typography that scales smoothly
- Similar to CSS `clamp()` for fonts

**`getResponsiveSpacing(base: number)`**
- Adaptive spacing based on screen size
- Smaller screens = tighter spacing
- Larger screens = more generous spacing

**`getImageDimensions(width, height, maxWidth?, maxHeight?)`**
- Maintains aspect ratio
- Fits within screen bounds
- Use for responsive images

### Typography System

Located in: `src/theme/typography.ts`

Uses **fluid typography** with clamp-like behavior:

```typescript
display: fluidFontSize(28, 40)    // 28px (mobile) → 40px (desktop)
title: fluidFontSize(20, 28)      // 20px → 28px
subtitle: fluidFontSize(14, 18)   // 14px → 18px
body: fontSize(14, 0.9, 1.1)      // Moderate scaling with bounds
```

### Spacing System

Located in: `src/theme/spacing.ts`

Uses adaptive spacing:

```typescript
spacing = {
  xs: getResponsiveSpacing(4),   // Adapts: 3.4px (small) → 4.8px (desktop)
  sm: getResponsiveSpacing(8),   // Adapts: 6.8px → 9.6px
  md: getResponsiveSpacing(12),  // Adapts: 10.2px → 14.4px
  // ... etc
}
```

### Responsive Image Component

Located in: `src/components/ResponsiveImage.tsx`

Handles images across all screen sizes:

```tsx
<ResponsiveImage
  source={{ uri: imageUrl }}
  width={200}
  aspectRatio={16/9}
  maxWidth={SCREEN_WIDTH}
  resizeMode="cover"
/>
```

## Usage Examples

### In Components

```tsx
import { scale, wp, hp, useResponsive } from '../utils/responsive';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

const MyComponent = () => {
  const { screenSize, safeArea, gridColumns } = useResponsive();
  
  return (
    <View style={{
      padding: spacing.lg,           // Responsive spacing
      paddingTop: safeArea.top,      // Safe area aware
      width: wp(90),                  // 90% of screen width
    }}>
      <Text style={typography.title}>Title</Text>
      <Image 
        source={...}
        style={{ width: scale(200), height: scale(200) }}
      />
    </View>
  );
};
```

### Grid Layouts

```tsx
import { getCardWidth, getGridColumns } from '../utils/responsive';

const columns = getGridColumns(2); // 1 (small) → 2 (medium) → 3 (tablet) → 4 (desktop)
const cardWidth = getCardWidth(columns, 16); // Responsive card width
```

### Thumb-Friendly Zones

```tsx
import { isInThumbZone } from '../utils/responsive';

// Place primary actions in bottom third
const buttonY = SCREEN_HEIGHT * 0.8; // Bottom third
if (isInThumbZone(buttonY)) {
  // Button is in thumb-friendly zone
}
```

## Device Support

### ✅ Supported Devices

- **Compact Phones** (320px-374px): Optimized spacing, single column layouts
- **Standard Phones** (375px-413px): Standard mobile experience
- **Large Phones** (414px-767px): More generous spacing, 2-column grids
- **Tablets** (768px-1023px): Multi-column layouts, larger touch targets
- **Desktop** (1024px+): Maximum spacing, 3-4 column grids
- **Foldables**: Detected and handled with appropriate layouts
- **Notches/Cutouts**: Safe area insets applied everywhere

### Safe Area Handling

All screens use `useSafeAreaInsets()`:

```tsx
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const insets = useSafeAreaInsets();

// Header
<View style={{ paddingTop: Math.max(insets.top, scale(12)) }}>

// Input/Footer
<View style={{ paddingBottom: Math.max(insets.bottom, scale(12)) }}>
```

## Best Practices

### ✅ DO

- Use `scale()` for fixed dimensions
- Use `wp()`/`hp()` for percentage-based layouts
- Use `spacing` from theme for consistent spacing
- Use `typography` from theme for text
- Use `ResponsiveImage` for images
- Test on multiple screen sizes
- Use safe area insets for headers/footers
- Place primary actions in thumb-friendly zones

### ❌ DON'T

- Don't use fixed pixel values (`width: 100`)
- Don't ignore safe areas
- Don't assume screen size
- Don't hardcode breakpoints
- Don't forget to test on small/large devices

## Testing

### Recommended Test Devices

1. **Small**: iPhone SE (320px width)
2. **Medium**: iPhone 14 (390px width)
3. **Large**: iPhone 14 Pro Max (430px width)
4. **Tablet**: iPad (768px width)
5. **Desktop**: 1024px+ width

### Testing Checklist

- [ ] All screens fit on smallest device (320px)
- [ ] Text is readable on all sizes
- [ ] Images maintain aspect ratio
- [ ] Safe areas respected (notches, cutouts)
- [ ] Touch targets are adequate (min 44x44px)
- [ ] Primary actions in thumb-friendly zones
- [ ] Grid layouts adapt correctly
- [ ] Typography scales smoothly
- [ ] Spacing feels natural on all sizes

## Performance

- Uses `PixelRatio.roundToNearestPixel()` for crisp rendering
- Calculations are memoized where possible
- No layout thrashing
- Smooth animations on all devices

## Future Enhancements

- [ ] Foldable device posture detection (folded/unfolded)
- [ ] Dynamic type support (accessibility)
- [ ] Dark mode optimizations
- [ ] Landscape orientation optimizations
- [ ] Multi-window support (tablets)

---

**Last Updated**: December 2025  
**Standards**: 2025 Mobile-First Responsive Design  
**Status**: ✅ Production Ready

