import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors } from '../theme/colors';
import { useThemeColors } from '../theme/ThemeProvider';
import { spacing } from '../theme/spacing';

interface AnimatedButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export default function AnimatedButton({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
}: AnimatedButtonProps) {
  const colors = useThemeColors();
  const handlePress = () => {
    if (!disabled && !loading) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  };

  const sizeStyles = {
    small: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
    medium: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
    large: { paddingVertical: spacing.lg, paddingHorizontal: spacing.xl },
  };

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled || loading}
        style={[styles.container, style]}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={disabled ? [colors.textMuted, colors.textMuted] : [colors.primary, colors.primary]}
          style={[styles.gradient, sizeStyles[size]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.textOnPrimary} />
          ) : (
            <>
              {icon}
              <Text style={[styles.text, { color: colors.textOnPrimary }, textStyle]}>{title}</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  if (variant === 'secondary') {
    return (
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled || loading}
        style={[styles.container, styles.secondary, sizeStyles[size], style]}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.textPrimary} />
        ) : (
          <>
            {icon}
            <Text style={[styles.text, styles.secondaryText, textStyle]}>{title}</Text>
          </>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled || loading}
      style={[styles.container, styles.outline, sizeStyles[size], style]}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, styles.outlineText, textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  secondary: {
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryText: {
    color: colors.textPrimary,
  },
  outlineText: {
    color: colors.primary,
  },
});
