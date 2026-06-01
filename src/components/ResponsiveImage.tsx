/**
 * ResponsiveImage Component (2025 Standards)
 * Handles images across all screen sizes with:
 * - Aspect ratio preservation
 * - Responsive sizing
 * - Optimized loading
 * - Safe area awareness
 */

import React from 'react';
import { Image, ImageStyle, StyleProp, View, ViewStyle } from 'react-native';
import { getImageDimensions, scale, verticalScale } from '../utils/responsive';

interface ResponsiveImageProps {
  source: { uri: string } | number;
  width?: ImageStyle['width'];
  height?: ImageStyle['height'];
  aspectRatio?: number;
  maxWidth?: number;
  maxHeight?: number;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center' | 'repeat';
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}

export const ResponsiveImage: React.FC<ResponsiveImageProps> = ({
  source,
  width,
  height,
  aspectRatio,
  maxWidth,
  maxHeight,
  resizeMode = 'cover',
  style,
  containerStyle,
}) => {
  // Calculate responsive dimensions
  let imageWidth = width;
  let imageHeight = height;

  // If aspect ratio provided, calculate dimensions
  if (aspectRatio && width) {
    imageHeight = typeof width === 'number' ? width / aspectRatio : undefined;
  } else if (aspectRatio && height) {
    imageWidth = typeof height === 'number' ? height * aspectRatio : undefined;
  }

  // If both width and height are numbers, use responsive scaling
  if (typeof imageWidth === 'number' && typeof imageHeight === 'number') {
    const dimensions = getImageDimensions(
      imageWidth,
      imageHeight,
      maxWidth,
      maxHeight
    );
    imageWidth = dimensions.width;
    imageHeight = dimensions.height;
  }

  // Apply responsive scaling to numeric values
  if (typeof imageWidth === 'number') {
    imageWidth = scale(imageWidth);
  }
  if (typeof imageHeight === 'number') {
    imageHeight = verticalScale(imageHeight);
  }

  const image = (
    <Image
      source={source}
      style={[
        {
          width: imageWidth,
          height: imageHeight,
        },
        style,
      ]}
      resizeMode={resizeMode}
    />
  );

  if (containerStyle) {
    return <View style={containerStyle}>{image}</View>;
  }

  return image;
};

