import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { useThemeColors } from '../theme/ThemeProvider';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'small' | 'medium' | 'large';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  textStyle,
}) => {
  const colors = useThemeColors();
  const isDisabled = disabled || loading;

  const variantStyles = {
    primary: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
      borderWidth: 0,
    },
    secondary: {
      backgroundColor: colors.secondary,
      borderColor: colors.secondary,
      borderWidth: 0,
    },
    outline: {
      backgroundColor: 'transparent',
      borderColor: colors.primary,
      borderWidth: 1,
    },
    ghost: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      borderWidth: 0,
    },
  };

  const sizeStyles = {
    small: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      ...typography.caption,
    },
    medium: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      ...typography.body,
    },
    large: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      ...typography.bodyBold,
      fontSize: 16,
    },
  };

  const textColor = {
    primary: colors.background,
    secondary: colors.background,
    outline: colors.primary,
    ghost: colors.primary,
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'secondary' ? colors.background : colors.primary}
          size="small"
        />
      ) : (
        <Text style={[styles.text, { color: textColor[variant] }, textStyle]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontWeight: '600',
  },
});

