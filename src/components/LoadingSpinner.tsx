import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useThemeColors } from '../theme/ThemeProvider';
import { scale } from '../utils/responsive';

const { width } = Dimensions.get('window');

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  message?: string;
  fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  color = colors.primary,
  message,
  fullScreen = false,
}) => {
  const colors = useThemeColors();
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(-200)).current;

  useEffect(() => {
    // Continuous rotation
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Shimmer effect
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: width + 200,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: -200,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const sizeMap = {
    small: scale(24),
    medium: scale(48),
    large: scale(72),
  };

  const iconSizeMap = {
    small: scale(12),
    medium: scale(24),
    large: scale(36),
  };

  const spinnerSize = sizeMap[size];
  const iconSize = iconSizeMap[size];

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [-200, 0, width / 2, width + 200],
    outputRange: [0, 0.3, 0.6, 0],
  });

  const container = fullScreen ? (
    <View style={styles.fullScreenContainer}>
      <Animated.View
        style={[
          styles.spinnerContainer,
          {
            width: spinnerSize,
            height: spinnerSize,
            transform: [
              { rotate },
              { scale: pulseAnim },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={[color, colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradientCircle, { width: spinnerSize, height: spinnerSize, borderRadius: spinnerSize / 2 }]}
        >
          <View style={[styles.innerCircle, { width: spinnerSize * 0.7, height: spinnerSize * 0.7, borderRadius: (spinnerSize * 0.7) / 2 }]}>
            <Ionicons name="sparkles" size={iconSize} color="#fff" />
          </View>
          {/* Shimmer overlay */}
          <Animated.View
            style={[
              styles.shimmer,
              {
                transform: [{ translateX: shimmerAnim }],
                opacity: shimmerOpacity,
              },
            ]}
          />
        </LinearGradient>
      </Animated.View>
      {message && <Animated.Text style={[styles.message, { opacity: pulseAnim }]}>{message}</Animated.Text>}
    </View>
  ) : (
    <View style={styles.inlineContainer}>
      <Animated.View
        style={[
          styles.spinnerContainer,
          {
            width: spinnerSize,
            height: spinnerSize,
            transform: [
              { rotate },
              { scale: pulseAnim },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={[color, colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradientCircle, { width: spinnerSize, height: spinnerSize, borderRadius: spinnerSize / 2 }]}
        >
          <View style={[styles.innerCircle, { width: spinnerSize * 0.7, height: spinnerSize * 0.7, borderRadius: (spinnerSize * 0.7) / 2 }]}>
            <Ionicons name="sparkles" size={iconSize} color="#fff" />
          </View>
          <Animated.View
            style={[
              styles.shimmer,
              {
                transform: [{ translateX: shimmerAnim }],
                opacity: shimmerOpacity,
              },
            ]}
          />
        </LinearGradient>
      </Animated.View>
    </View>
  );

  return container;
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  inlineContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientCircle: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 8,
    overflow: 'hidden',
  },
  innerCircle: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    zIndex: 1,
  },
  message: {
    marginTop: scale(16),
    fontSize: scale(14),
    color: colors.textSecondary,
    fontWeight: '500',
  },
});

