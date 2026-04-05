import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { useThemeColors } from '../theme/ThemeProvider';

const { width, height } = Dimensions.get('window');

interface ConfettiPiece {
  x: Animated.Value;
  y: Animated.Value;
  rotate: Animated.Value;
  color: string;
  size: number;
}

interface SuccessConfettiProps {
  visible: boolean;
  duration?: number;
}

export default function SuccessConfetti({ visible, duration = 3000 }: SuccessConfettiProps) {
  const colors = useThemeColors();
  const pieces = useRef<ConfettiPiece[]>([]);

  useEffect(() => {
    if (visible) {
      pieces.current = Array.from({ length: 50 }, () => ({
        x: new Animated.Value(Math.random() * width),
        y: new Animated.Value(-50),
        rotate: new Animated.Value(0),
        color: [
          colors.primary,
          colors.secondary,
          colors.accent,
          colors.success,
          colors.warning,
        ][Math.floor(Math.random() * 5)],
        size: Math.random() * 10 + 5,
      }));

      pieces.current.forEach((piece) => {
        const xEnd = piece.x._value + (Math.random() - 0.5) * 200;
        
        Animated.parallel([
          Animated.timing(piece.y, {
            toValue: height + 50,
            duration: duration + Math.random() * 1000,
            useNativeDriver: true,
          }),
          Animated.timing(piece.x, {
            toValue: xEnd,
            duration: duration + Math.random() * 1000,
            useNativeDriver: true,
          }),
          Animated.timing(piece.rotate, {
            toValue: Math.random() * 10,
            duration: duration,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }
  }, [visible, duration, colors]);

  if (!visible) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {pieces.current.map((piece, index) => (
        <Animated.View
          key={index}
          style={[
            styles.piece,
            {
              backgroundColor: piece.color,
              width: piece.size,
              height: piece.size,
              transform: [
                { translateX: piece.x },
                { translateY: piece.y },
                {
                  rotate: piece.rotate.interpolate({
                    inputRange: [0, 10],
                    outputRange: ['0deg', '3600deg'],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  piece: {
    position: 'absolute',
    borderRadius: 2,
  },
});
