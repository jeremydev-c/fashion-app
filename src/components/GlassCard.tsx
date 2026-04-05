import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme, useThemeColors } from '../theme/ThemeProvider';
import { spacing } from '../theme/spacing';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
}

export default function GlassCard({ children, style, intensity = 20 }: GlassCardProps) {
  const colors = useThemeColors();
  const { isDark } = useTheme();
  return (
    <View style={[styles.container, { borderColor: colors.borderSubtle }, style]}>
      <BlurView intensity={intensity} tint={isDark ? 'dark' : 'light'} style={styles.blur}>
        <View style={[styles.content, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>{children}</View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
  },
  blur: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
});

