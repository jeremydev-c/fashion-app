import React from 'react';
import { RefreshControl } from 'react-native';
import { useThemeColors } from '../theme/ThemeProvider';

interface PullToRefreshProps {
  refreshing: boolean;
  onRefresh: () => void;
}

export default function PullToRefresh({ refreshing, onRefresh }: PullToRefreshProps) {
  const colors = useThemeColors();
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={colors.primary}
      colors={[colors.primary, colors.secondary]}
      progressBackgroundColor={colors.card}
    />
  );
}
