import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useThemeColors } from '../theme/ThemeProvider';
import { spacing } from '../theme/spacing';

type CardVariant = 'elevated' | 'outlined' | 'filled';

type CardProps = {
  children: ReactNode;
  variant?: CardVariant;
  style?: ViewStyle;
  onPress?: () => void;
};

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'elevated',
  style,
  onPress,
}) => {
  const colors = useThemeColors();
  const variantStyles = {
    elevated: {
      backgroundColor: colors.cardSoft,
      borderWidth: 0,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
    },
    outlined: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    filled: {
      backgroundColor: colors.cardSoft,
      borderWidth: 0,
    },
  };

  return (
    <View
      style={[
        styles.card,
        variantStyles[variant],
        style,
      ]}
      onStartShouldSetResponder={onPress ? () => true : undefined}
      onResponderRelease={onPress}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: spacing.lg,
  },
});

