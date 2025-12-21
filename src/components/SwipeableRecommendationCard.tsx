import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions } from 'react-native';
import { PanGestureHandler, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedGestureHandler,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { Card } from './Card';
import { Badge } from './Badge';
import type { OutfitRecommendation } from '../services/recommendationsService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;
const SWIPE_VELOCITY_THRESHOLD = 500;

type SwipeableRecommendationCardProps = {
  recommendation: OutfitRecommendation;
  onSwipeRight: (rec: OutfitRecommendation) => void;
  onSwipeLeft: (rec: OutfitRecommendation) => void;
  onPress: (rec: OutfitRecommendation) => void;
  isSaved: boolean;
  getColorHex: (color: string) => string;
};

export const SwipeableRecommendationCard: React.FC<SwipeableRecommendationCardProps> = ({
  recommendation,
  onSwipeRight,
  onSwipeLeft,
  onPress,
  isSaved,
  getColorHex,
}) => {
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  const gestureHandler = useAnimatedGestureHandler({
    onStart: (_, ctx: any) => {
      ctx.startX = translateX.value;
    },
    onActive: (event, ctx) => {
      translateX.value = ctx.startX + event.translationX;
      // Add rotation based on swipe distance
      const rotation = (event.translationX / SCREEN_WIDTH) * 20;
      scale.value = 1 - Math.abs(event.translationX) / SCREEN_WIDTH * 0.1;
    },
    onEnd: (event) => {
      const shouldSwipeRight = translateX.value > SWIPE_THRESHOLD || event.velocityX > SWIPE_VELOCITY_THRESHOLD;
      const shouldSwipeLeft = translateX.value < -SWIPE_THRESHOLD || event.velocityX < -SWIPE_VELOCITY_THRESHOLD;

      if (shouldSwipeRight) {
        translateX.value = withSpring(SCREEN_WIDTH * 1.5);
        opacity.value = withSpring(0);
        runOnJS(onSwipeRight)(recommendation);
      } else if (shouldSwipeLeft) {
        translateX.value = withSpring(-SCREEN_WIDTH * 1.5);
        opacity.value = withSpring(0);
        runOnJS(onSwipeLeft)(recommendation);
      } else {
        // Spring back to center
        translateX.value = withSpring(0);
        scale.value = withSpring(1);
      }
    },
  });

  const cardStyle = useAnimatedStyle(() => {
    const rotation = (translateX.value / SCREEN_WIDTH) * 20;
    return {
      transform: [
        { translateX: translateX.value },
        { rotate: `${rotation}deg` },
        { scale: scale.value },
      ],
      opacity: opacity.value,
    };
  });

  const rightActionStyle = useAnimatedStyle(() => {
    const opacity = translateX.value > 0 ? Math.min(translateX.value / SWIPE_THRESHOLD, 1) : 0;
    return {
      opacity,
    };
  });

  const leftActionStyle = useAnimatedStyle(() => {
    const opacity = translateX.value < 0 ? Math.min(Math.abs(translateX.value) / SWIPE_THRESHOLD, 1) : 0;
    return {
      opacity,
    };
  });

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.cardWrapper}>
        {/* Right action indicator (Save) */}
        <Animated.View style={[styles.actionIndicator, styles.rightAction, rightActionStyle]}>
          <Ionicons name="heart" size={40} color={colors.success} />
          <Text style={styles.actionText}>Save</Text>
        </Animated.View>

        {/* Left action indicator (Reject) */}
        <Animated.View style={[styles.actionIndicator, styles.leftAction, leftActionStyle]}>
          <Ionicons name="close-circle" size={40} color={colors.danger} />
          <Text style={styles.actionText}>Reject</Text>
        </Animated.View>

        {/* Swipeable card */}
        <PanGestureHandler onGestureEvent={gestureHandler}>
          <Animated.View style={cardStyle}>
            <TouchableOpacity activeOpacity={0.9} onPress={() => onPress(recommendation)}>
              <Card variant="elevated" style={styles.recommendationCard}>
                {/* Header with confidence */}
                <View style={styles.recommendationHeader}>
                  <View style={styles.confidenceBadge}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    <Text style={styles.confidenceText}>{Math.round(recommendation.confidence)}% match</Text>
                  </View>
                  {recommendation.reasons.length > 0 && (
                    <View style={styles.reasonsContainer}>
                      {recommendation.reasons.slice(0, 2).map((reason, idx) => (
                        <Badge key={idx} label={reason} variant="success" style={styles.reasonBadge} />
                      ))}
                    </View>
                  )}
                </View>

                {/* Outfit Items */}
                <View style={styles.outfitItemsRow}>
                  {recommendation.items.map((piece) => (
                    <View key={piece.id} style={styles.pieceCard}>
                      {piece.imageUrl ? (
                        <Image source={{ uri: piece.imageUrl }} style={styles.pieceImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.pieceImagePlaceholder}>
                          <Ionicons name="shirt-outline" size={24} color={colors.textMuted} />
                        </View>
                      )}
                      <View style={styles.pieceInfo}>
                        <Text style={styles.pieceCategory}>{piece.category.toUpperCase()}</Text>
                        {piece.color && (
                          <View style={styles.pieceColorRow}>
                            <View style={[styles.colorDotSmall, { backgroundColor: getColorHex(piece.color) }]} />
                            <Text style={styles.pieceColor}>{piece.color}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </View>

                {/* Saved indicator */}
                {isSaved && (
                  <View style={styles.savedBadge}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                    <Text style={styles.savedText}>Saved</Text>
                  </View>
                )}

                {/* Swipe hint */}
                <View style={styles.swipeHint}>
                  <Ionicons name="swap-horizontal" size={16} color={colors.textMuted} />
                  <Text style={styles.swipeHintText}>Swipe right to save, left to reject</Text>
                </View>
              </Card>
            </TouchableOpacity>
          </Animated.View>
        </PanGestureHandler>
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  cardWrapper: {
    position: 'relative',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIndicator: {
    position: 'absolute',
    top: '50%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  rightAction: {
    right: spacing.xl,
  },
  leftAction: {
    left: spacing.xl,
  },
  actionText: {
    ...typography.bodyBold,
    marginTop: spacing.xs,
    fontSize: 14,
  },
  recommendationCard: {
    width: SCREEN_WIDTH - spacing.lg * 2,
    marginHorizontal: spacing.lg,
  },
  recommendationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: colors.success + '20',
  },
  confidenceText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '600',
  },
  reasonsContainer: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  reasonBadge: {
    marginRight: spacing.xs,
  },
  outfitItemsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  pieceCard: {
    flex: 1,
    minWidth: 100,
    maxWidth: 120,
  },
  pieceImage: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    marginBottom: spacing.xs,
  },
  pieceImagePlaceholder: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    backgroundColor: colors.cardSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  pieceInfo: {
    padding: spacing.xs,
    gap: 2,
  },
  pieceCategory: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '600',
  },
  pieceColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  colorDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  pieceColor: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textMuted,
  },
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: colors.success + '20',
    marginTop: spacing.sm,
  },
  savedText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '600',
  },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  swipeHintText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
});

