import React from 'react';
import { RefreshControl } from 'react-native';
import { colors } from '../theme/colors';

interface PullToRefreshProps {
  refreshing: boolean;
  onRefresh: () => void;
}

export default function PullToRefresh({ refreshing, onRefresh }: PullToRefreshProps) {
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
