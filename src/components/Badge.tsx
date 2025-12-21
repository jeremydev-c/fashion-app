import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'neutral';

type BadgeProps = {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'primary',
  style,
  textStyle,
}) => {
  const variantStyles = {
    primary: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    secondary: {
      backgroundColor: colors.secondarySoft,
      borderColor: colors.secondary,
    },
    success: {
      backgroundColor: 'rgba(34, 197, 94, 0.12)',
      borderColor: colors.success,
    },
    warning: {
      backgroundColor: 'rgba(249, 115, 22, 0.12)',
      borderColor: colors.warning,
    },
    danger: {
      backgroundColor: 'rgba(239, 68, 68, 0.12)',
      borderColor: colors.danger,
    },
    neutral: {
      backgroundColor: colors.cardSoft,
      borderColor: colors.borderSubtle,
    },
  };

  const textColors = {
    primary: colors.primary,
    secondary: colors.secondary,
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
    neutral: colors.textPrimary,
  };

  return (
    <View style={[styles.badge, variantStyles[variant], style]}>
      <Text style={[styles.text, { color: textColors[variant] }, textStyle]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  text: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
  },
});

