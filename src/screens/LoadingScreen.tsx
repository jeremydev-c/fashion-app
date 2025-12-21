import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { scale } from '../utils/responsive';

const { width, height } = Dimensions.get('window');

export const LoadingScreen: React.FC = () => {
  // Animation values using useRef to prevent re-creation
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoRotation = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(20)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;
  const shimmerTranslateX = useRef(new Animated.Value(-width)).current;
  const particle1Y = useRef(new Animated.Value(0)).current;
  const particle2Y = useRef(new Animated.Value(0)).current;
  const particle3Y = useRef(new Animated.Value(0)).current;
  const particle4Y = useRef(new Animated.Value(0)).current;
  const dot1Opacity = useRef(new Animated.Value(0.3)).current;
  const dot2Opacity = useRef(new Animated.Value(0.3)).current;
  const dot3Opacity = useRef(new Animated.Value(0.3)).current;
  const screenFadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Logo entrance animation
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Logo rotation (continuous)
    Animated.loop(
      Animated.timing(logoRotation, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Title animation
    Animated.parallel([
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 800,
        delay: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(titleTranslateY, {
        toValue: 0,
        duration: 800,
        delay: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Subtitle animation
    Animated.timing(subtitleOpacity, {
      toValue: 1,
      duration: 600,
      delay: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // Progress bar animation - fill completely
    Animated.timing(progressWidth, {
      toValue: width * 0.6, // Match the container width
      duration: 2000,
      delay: 900,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();

    // Shimmer effect (continuous)
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerTranslateX, {
          toValue: width * 2,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerTranslateX, {
          toValue: -width,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Floating particles
    const animateParticle = (animValue: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(animValue, {
            toValue: -30,
            duration: 2000 + delay * 200,
            delay,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 0,
            duration: 2000 + delay * 200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    animateParticle(particle1Y, 0);
    animateParticle(particle2Y, 200);
    animateParticle(particle3Y, 400);
    animateParticle(particle4Y, 600);

    // Animated dots (pulsing)
    const animateDots = () => {
      const createDotAnimation = (animValue: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(animValue, {
              toValue: 1,
              duration: 600,
              delay,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(animValue, {
              toValue: 0.3,
              duration: 600,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        );
      };

      Animated.parallel([
        createDotAnimation(dot1Opacity, 0),
        createDotAnimation(dot2Opacity, 200),
        createDotAnimation(dot3Opacity, 400),
      ]).start();
    };

    animateDots();

    // Fade out at the end for smooth transition
    Animated.timing(screenFadeOut, {
      toValue: 0,
      duration: 400,
      delay: 2800,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, []);

  const logoRotationInterpolate = logoRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const shimmerOpacity = shimmerTranslateX.interpolate({
    inputRange: [-width, 0, width, width * 2],
    outputRange: [0, 0.3, 0.3, 0],
  });

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        {
          opacity: screenFadeOut,
        },
      ]}
    >
      <LinearGradient
        colors={['#020617', '#050816', '#0f172a', '#111827']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      >
        <View style={styles.root}>
      {/* Animated background particles */}
      <Animated.View
        style={[
          styles.particle,
          styles.particle1,
          {
            transform: [{ translateY: particle1Y }],
            opacity: 0.4,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.particle,
          styles.particle2,
          {
            transform: [{ translateY: particle2Y }],
            opacity: 0.3,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.particle,
          styles.particle3,
          {
            transform: [{ translateY: particle3Y }],
            opacity: 0.35,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.particle,
          styles.particle4,
          {
            transform: [{ translateY: particle4Y }],
            opacity: 0.25,
          },
        ]}
      />

      {/* Main content */}
      <View style={styles.content}>
        {/* Logo with rotation */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              transform: [
                { scale: logoScale },
                { rotate: logoRotationInterpolate },
              ],
              opacity: logoOpacity,
            },
          ]}
        >
          <LinearGradient
            colors={[colors.primary, colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoGradient}
          >
            <View style={styles.logoInner}>
              <Ionicons name="sparkles" size={40} color="#ffffff" />
            </View>
          </LinearGradient>
          {/* Glow effect */}
          <View style={styles.logoGlow} />
        </Animated.View>

        {/* Title */}
        <Animated.View
          style={{
            opacity: titleOpacity,
            transform: [{ translateY: titleTranslateY }],
          }}
        >
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Fashion Fit</Text>
            <View style={styles.titleUnderline} />
          </View>
        </Animated.View>

        {/* Subtitle */}
        <Animated.View style={{ opacity: subtitleOpacity }}>
          <Text style={styles.subtitle}>Calibrating your Style DNA</Text>
        </Animated.View>

        {/* Progress bar container */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressBar,
                {
                  width: progressWidth,
                },
              ]}
            >
              {/* Shimmer overlay */}
              <Animated.View
                style={[
                  styles.shimmer,
                  {
                    transform: [{ translateX: shimmerTranslateX }],
                    opacity: shimmerOpacity,
                  },
                ]}
              />
            </Animated.View>
          </View>
        </View>

        {/* Loading dots */}
        <View style={styles.dotsContainer}>
          <Animated.View
            style={[
              styles.dot,
              {
                opacity: dot1Opacity,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              {
                opacity: dot2Opacity,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              {
                opacity: dot3Opacity,
              },
            ]}
          />
        </View>

        {/* Tagline */}
        <Animated.View
          style={[
            styles.taglineContainer,
            {
              opacity: subtitleOpacity,
            },
          ]}
        >
          <Ionicons name="diamond-outline" size={14} color={colors.primary} />
          <Text style={styles.tagline}>Your personal style assistant</Text>
        </Animated.View>
      </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  // Particles
  particle: {
    position: 'absolute',
    width: scale(4),
    height: scale(4),
    borderRadius: scale(2),
    backgroundColor: colors.primary,
  },
  particle1: {
    left: '20%',
    top: '15%',
  },
  particle2: {
    right: '25%',
    top: '25%',
  },
  particle3: {
    left: '30%',
    bottom: '30%',
  },
  particle4: {
    right: '20%',
    bottom: '20%',
  },
  // Logo
  logoContainer: {
    width: scale(100),
    height: scale(100),
    marginBottom: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGradient: {
    width: scale(100),
    height: scale(100),
    borderRadius: scale(50),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: scale(20),
    elevation: 10,
  },
  logoInner: {
    width: scale(90),
    height: scale(90),
    borderRadius: scale(45),
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlow: {
    position: 'absolute',
    width: scale(120),
    height: scale(120),
    borderRadius: scale(60),
    backgroundColor: colors.primarySoft,
    zIndex: -1,
  },
  // Title
  titleContainer: {
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  title: {
    ...typography.display,
    fontSize: scale(38),
    fontWeight: '800',
    letterSpacing: scale(2),
    textAlign: 'center',
    color: colors.textPrimary,
    textShadowColor: 'rgba(255, 107, 156, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: scale(25),
  },
  titleUnderline: {
    width: scale(60),
    height: scale(3),
    marginTop: spacing.xs,
    borderRadius: scale(2),
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: scale(8),
    elevation: 5,
  },
  // Subtitle
  subtitle: {
    ...typography.subtitle,
    fontSize: scale(16),
    fontWeight: '500',
    textAlign: 'center',
    color: colors.textSecondary,
    marginBottom: spacing['2xl'],
    letterSpacing: scale(0.5),
  },
  // Progress bar
  progressContainer: {
    width: width * 0.6,
    marginBottom: spacing.xl,
  },
  progressTrack: {
    height: scale(3),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: scale(10),
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: scale(10),
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    width: scale(100),
  },
  // Dots
  dotsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  dot: {
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
    backgroundColor: colors.primary,
  },
  // Tagline
  taglineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  tagline: {
    ...typography.caption,
    fontSize: scale(11),
    color: colors.textMuted,
    letterSpacing: scale(0.5),
    textTransform: 'uppercase',
  },
});



