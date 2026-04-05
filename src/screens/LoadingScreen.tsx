import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../theme/ThemeProvider';
import { scale, verticalScale } from '../utils/responsive';

const { width, height } = Dimensions.get('window');

const FASHION_WORDS = ['STYLE', 'ELEGANCE', 'CURATE', 'REFINE', 'LUXE', 'BESPOKE', 'VOGUE'];

export const LoadingScreen: React.FC = () => {
  const colors = useThemeColors();

  // Core animations
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const letterAnims = useRef(
    'FASHION FIT'.split('').map(() => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(scale(30)),
    })),
  ).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineTranslateY = useRef(new Animated.Value(scale(15))).current;
  const lineWidth = useRef(new Animated.Value(0)).current;
  const lineOpacity = useRef(new Animated.Value(0)).current;

  // Orbiting ring
  const ringRotation = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;

  // Pulsing glow
  const glowScale = useRef(new Animated.Value(0.8)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  // Rolling word
  const wordIndex = useRef(0);
  const wordOpacity = useRef(new Animated.Value(0)).current;
  const wordTranslateY = useRef(new Animated.Value(scale(12))).current;
  const [currentWord, setCurrentWord] = React.useState(FASHION_WORDS[0]);

  // Status text
  const statusOpacity = useRef(new Animated.Value(0)).current;
  const statusTranslateY = useRef(new Animated.Value(scale(10))).current;
  const [statusText, setStatusText] = React.useState('');

  // Bottom accent line
  const accentWidth = useRef(new Animated.Value(0)).current;

  // Floating diamond particles
  const diamonds = useRef(
    Array.from({ length: 6 }, () => ({
      x: new Animated.Value(Math.random() * width),
      y: new Animated.Value(height + 20),
      opacity: new Animated.Value(0),
      rotation: new Animated.Value(0),
    })),
  ).current;

  useEffect(() => {
    // ── Phase 1: Logo entrance (0ms – 1000ms) ──
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 35,
        friction: 9,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Orbiting ring
    Animated.parallel([
      Animated.timing(ringOpacity, {
        toValue: 0.6,
        duration: 800,
        delay: 400,
        useNativeDriver: true,
      }),
      Animated.spring(ringScale, {
        toValue: 1,
        tension: 25,
        friction: 10,
        delay: 400,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.timing(ringRotation, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();

    // Pulsing glow behind logo
    Animated.sequence([
      Animated.timing(glowOpacity, {
        toValue: 0.5,
        duration: 800,
        delay: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(glowScale, { toValue: 1.3, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(glowOpacity, { toValue: 0.25, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(glowScale, { toValue: 0.8, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(glowOpacity, { toValue: 0.6, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ]),
        ]),
      ).start();
    });

    // ── Phase 2: Letter-by-letter title (1200ms) ──
    const letterDelay = 1200;
    letterAnims.forEach((anim, i) => {
      Animated.parallel([
        Animated.timing(anim.opacity, {
          toValue: 1,
          duration: 400,
          delay: letterDelay + i * 80,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(anim.translateY, {
          toValue: 0,
          tension: 70,
          friction: 12,
          delay: letterDelay + i * 80,
          useNativeDriver: true,
        }),
      ]).start();
    });

    // Gold underline sweep
    const lineDelay = letterDelay + 'FASHION FIT'.length * 80 + 200;
    Animated.sequence([
      Animated.timing(lineOpacity, {
        toValue: 1,
        duration: 250,
        delay: lineDelay,
        useNativeDriver: false,
      }),
      Animated.timing(lineWidth, {
        toValue: scale(140),
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();

    // ── Phase 3: Tagline (2800ms) ──
    Animated.parallel([
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 700,
        delay: 2800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(taglineTranslateY, {
        toValue: 0,
        tension: 50,
        friction: 12,
        delay: 2800,
        useNativeDriver: true,
      }),
    ]).start();

    // ── Phase 4: Rolling fashion words (3200ms) ──
    const cycleWord = () => {
      Animated.parallel([
        Animated.timing(wordOpacity, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(wordTranslateY, { toValue: 0, tension: 70, friction: 12, useNativeDriver: true }),
      ]).start(() => {
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(wordOpacity, { toValue: 0, duration: 350, useNativeDriver: true }),
            Animated.timing(wordTranslateY, { toValue: scale(-12), duration: 350, useNativeDriver: true }),
          ]).start(() => {
            wordIndex.current = (wordIndex.current + 1) % FASHION_WORDS.length;
            setCurrentWord(FASHION_WORDS[wordIndex.current]);
            wordTranslateY.setValue(scale(12));
            cycleWord();
          });
        }, 600);
      });
    };
    const wordTimer = setTimeout(cycleWord, 3200);

    // Bottom accent
    Animated.timing(accentWidth, {
      toValue: scale(50),
      duration: 900,
      delay: 3000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    // ── Phase 5: Status text sequence (3600ms) ──
    const STATUS_MESSAGES = [
      'Analyzing your style...',
      'Preparing your wardrobe...',
      'Almost ready...',
    ];
    let statusIdx = 0;

    const showStatus = () => {
      if (statusIdx >= STATUS_MESSAGES.length) return;
      setStatusText(STATUS_MESSAGES[statusIdx]);
      statusTranslateY.setValue(scale(10));

      Animated.parallel([
        Animated.timing(statusOpacity, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(statusTranslateY, { toValue: 0, tension: 80, friction: 14, useNativeDriver: true }),
      ]).start(() => {
        setTimeout(() => {
          Animated.timing(statusOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
            statusIdx++;
            showStatus();
          });
        }, 600);
      });
    };
    const statusTimer = setTimeout(showStatus, 3600);

    // ── Floating diamond particles ──
    diamonds.forEach((d, i) => {
      const animateDiamond = () => {
        d.x.setValue(Math.random() * width * 0.8 + width * 0.1);
        d.y.setValue(height + 20);
        d.opacity.setValue(0);
        d.rotation.setValue(0);

        Animated.parallel([
          Animated.timing(d.y, {
            toValue: -50,
            duration: 4500 + Math.random() * 2000,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(d.opacity, { toValue: 0.4 + Math.random() * 0.3, duration: 1200, useNativeDriver: true }),
            Animated.timing(d.opacity, { toValue: 0, duration: 2800, delay: 500, useNativeDriver: true }),
          ]),
          Animated.timing(d.rotation, {
            toValue: 1,
            duration: 4500 + Math.random() * 2000,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ]).start(() => animateDiamond());
      };

      setTimeout(animateDiamond, 600 + i * 400);
    });

    // ── Fade out screen (5000ms) ──
    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 600,
      delay: 4900,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();

    return () => {
      clearTimeout(wordTimer);
      clearTimeout(statusTimer);
      // Stop all running animations on unmount
      [logoScale, logoOpacity, ringOpacity, ringScale, ringRotation, glowScale, glowOpacity, accentWidth, screenOpacity, statusOpacity, statusTranslateY].forEach(v => v.stopAnimation());
      diamonds.forEach(d => { d.x.stopAnimation(); d.y.stopAnimation(); d.opacity.stopAnimation(); d.rotation.stopAnimation(); });
    };
  }, []);

  const ringRotationInterp = ringRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const letters = 'FASHION FIT'.split('');

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: screenOpacity }]}>
      <LinearGradient
        colors={[colors.background, colors.backgroundAlt, colors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      >
        <View style={styles.root}>
          {/* Floating diamond particles */}
          {diamonds.map((d, i) => (
            <Animated.View
              key={i}
              style={[
                styles.diamond,
                {
                  transform: [
                    { translateX: d.x },
                    { translateY: d.y },
                    {
                      rotate: d.rotation.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '360deg'],
                      }),
                    },
                  ],
                  opacity: d.opacity,
                  borderColor: colors.primary,
                },
              ]}
            />
          ))}

          <View style={styles.content}>
            {/* Glow behind logo */}
            <Animated.View
              style={[
                styles.glow,
                {
                  backgroundColor: colors.primary,
                  transform: [{ scale: glowScale }],
                  opacity: glowOpacity,
                },
              ]}
            />

            {/* Orbiting ring */}
            <Animated.View
              style={[
                styles.orbitRing,
                {
                  borderColor: colors.primary,
                  transform: [{ rotate: ringRotationInterp }, { scale: ringScale }],
                  opacity: ringOpacity,
                },
              ]}
            >
              <View style={[styles.orbitDot, { backgroundColor: colors.primary }]} />
            </Animated.View>

            {/* Logo */}
            <Animated.View
              style={[
                styles.logoWrap,
                {
                  transform: [{ scale: logoScale }],
                  opacity: logoOpacity,
                },
              ]}
            >
              <LinearGradient
                colors={[colors.primary, colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoOuter}
              >
                <View style={[styles.logoInner, { backgroundColor: colors.background }]}>
                  <Text style={[styles.logoLetter, { color: colors.primary }]}>F</Text>
                </View>
              </LinearGradient>
            </Animated.View>

            {/* Letter-by-letter title */}
            <View style={styles.titleRow}>
              {letters.map((char, i) => (
                <Animated.Text
                  key={i}
                  style={[
                    styles.titleChar,
                    {
                      color: colors.textPrimary,
                      opacity: letterAnims[i].opacity,
                      transform: [{ translateY: letterAnims[i].translateY }],
                    },
                    char === ' ' && styles.titleSpace,
                  ]}
                >
                  {char}
                </Animated.Text>
              ))}
            </View>

            {/* Gold underline */}
            <Animated.View
              style={[
                styles.goldLine,
                {
                  backgroundColor: colors.primary,
                  width: lineWidth,
                  opacity: lineOpacity,
                  shadowColor: colors.primary,
                },
              ]}
            />

            {/* Tagline */}
            <Animated.View
              style={{
                opacity: taglineOpacity,
                transform: [{ translateY: taglineTranslateY }],
                marginTop: verticalScale(20),
              }}
            >
              <Text style={[styles.tagline, { color: colors.textSecondary }]}>
                Your Personal Style Intelligence
              </Text>
            </Animated.View>

            {/* Rolling fashion word */}
            <View style={[styles.wordContainer, { borderColor: colors.borderSubtle }]}>
              <Ionicons name="diamond" size={scale(10)} color={colors.primary} />
              <Animated.Text
                style={[
                  styles.rollingWord,
                  {
                    color: colors.primary,
                    opacity: wordOpacity,
                    transform: [{ translateY: wordTranslateY }],
                  },
                ]}
              >
                {currentWord}
              </Animated.Text>
              <Ionicons name="diamond" size={scale(10)} color={colors.primary} />
            </View>

            {/* Status text */}
            {statusText !== '' && (
              <Animated.Text
                style={[
                  styles.statusText,
                  {
                    color: colors.textMuted,
                    opacity: statusOpacity,
                    transform: [{ translateY: statusTranslateY }],
                  },
                ]}
              >
                {statusText}
              </Animated.Text>
            )}

            {/* Bottom accent */}
            <View style={styles.bottomAccent}>
              <Animated.View
                style={[
                  styles.accentLine,
                  { backgroundColor: colors.primary, width: accentWidth },
                ]}
              />
            </View>
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
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Floating diamond particles
  diamond: {
    position: 'absolute',
    width: scale(8),
    height: scale(8),
    borderWidth: 1,
    transform: [{ rotate: '45deg' }],
  },
  // Glow
  glow: {
    position: 'absolute',
    width: scale(200),
    height: scale(200),
    borderRadius: scale(100),
  },
  // Orbiting ring
  orbitRing: {
    position: 'absolute',
    width: scale(140),
    height: scale(140),
    borderRadius: scale(70),
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  orbitDot: {
    position: 'absolute',
    top: -scale(4),
    left: '50%',
    marginLeft: -scale(4),
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
  },
  // Logo
  logoWrap: {
    marginBottom: verticalScale(32),
  },
  logoOuter: {
    width: scale(96),
    height: scale(96),
    borderRadius: scale(48),
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: scale(30),
    elevation: 15,
  },
  logoInner: {
    width: scale(82),
    height: scale(82),
    borderRadius: scale(41),
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: {
    fontSize: scale(42),
    fontWeight: '300',
    fontStyle: 'italic',
    letterSpacing: -2,
  },
  // Title
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(8),
  },
  titleChar: {
    fontSize: scale(28),
    fontWeight: '200',
    letterSpacing: scale(6),
  },
  titleSpace: {
    width: scale(14),
  },
  // Gold underline
  goldLine: {
    height: scale(1.5),
    borderRadius: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: scale(8),
    elevation: 5,
  },
  // Tagline
  tagline: {
    fontSize: scale(12),
    fontWeight: '400',
    letterSpacing: scale(3),
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  // Rolling word
  wordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    marginTop: verticalScale(28),
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(20),
    borderWidth: 1,
    borderRadius: scale(20),
  },
  rollingWord: {
    fontSize: scale(11),
    fontWeight: '600',
    letterSpacing: scale(5),
    textTransform: 'uppercase',
    minWidth: scale(90),
    textAlign: 'center',
  },
  // Status text
  statusText: {
    fontSize: scale(11),
    fontWeight: '400',
    letterSpacing: scale(1.5),
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: verticalScale(24),
  },
  // Bottom
  bottomAccent: {
    marginTop: verticalScale(40),
    alignItems: 'center',
  },
  accentLine: {
    height: scale(1),
    borderRadius: 1,
  },
});
