import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { scale } from '../utils/responsive';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
import {
  getWardrobeAnalytics,
  getOutfitAnalytics,
  getInsights,
  type WardrobeAnalytics,
  type OutfitAnalytics,
  type InsightsData,
} from '../services/analyticsService';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { useUserId } from '../hooks/useUserId';

export const AnalyticsScreen: React.FC = () => {
  const userId = useUserId();
  const { data: wardrobeAnalytics, isLoading: wardrobeLoading } = useQuery<WardrobeAnalytics>({
    queryKey: ['wardrobeAnalytics', userId],
    queryFn: () => getWardrobeAnalytics(userId),
  });

  const { data: outfitAnalytics, isLoading: outfitLoading } = useQuery<OutfitAnalytics>({
    queryKey: ['outfitAnalytics', userId],
    queryFn: () => getOutfitAnalytics(userId),
  });

  const { data: insightsData, isLoading: insightsLoading } = useQuery<InsightsData>({
    queryKey: ['insights', userId],
    queryFn: () => getInsights(userId),
  });

  const isLoading = wardrobeLoading || outfitLoading || insightsLoading;

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Loading your analytics...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
      <Text style={styles.title}>Analytics & Insights</Text>
      <Text style={styles.subtitle}>Discover your style patterns and wardrobe insights</Text>

      {/* Insights Section */}
      {insightsData && insightsData.insights.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💡 Personalized Insights</Text>
          {insightsData.insights.map((insight, index) => (
            <Card key={index} variant="elevated" style={styles.insightCard}>
              <View style={styles.insightHeader}>
                <Ionicons
                  name={
                    insight.priority === 'high'
                      ? 'alert-circle'
                      : insight.priority === 'medium'
                      ? 'information-circle'
                      : 'bulb'
                  }
                  size={scale(24)}
                  color={
                    insight.priority === 'high'
                      ? colors.danger
                      : insight.priority === 'medium'
                      ? colors.warning
                      : colors.accent
                  }
                />
                <View style={styles.insightContent}>
                  <Text style={styles.insightTitle}>{insight.title}</Text>
                  <Text style={styles.insightMessage}>{insight.message}</Text>
                </View>
              </View>
            </Card>
          ))}
        </View>
      )}

      {/* Wardrobe Stats */}
      {wardrobeAnalytics && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Wardrobe Statistics</Text>
          
          <Card variant="elevated" style={styles.statsCard}>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{wardrobeAnalytics.totalItems}</Text>
                <Text style={styles.statLabel}>Total Items</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{wardrobeAnalytics.utilizationRate}%</Text>
                <Text style={styles.statLabel}>Utilization</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{wardrobeAnalytics.totalOutfits}</Text>
                <Text style={styles.statLabel}>Outfits</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{wardrobeAnalytics.avgItemsPerOutfit}</Text>
                <Text style={styles.statLabel}>Avg/Outfit</Text>
              </View>
            </View>
          </Card>

          {/* Category Distribution */}
          <Card variant="elevated" style={styles.distributionCard}>
            <Text style={styles.cardTitle}>Category Distribution</Text>
            <View style={styles.distributionList}>
              {Object.entries(wardrobeAnalytics.categoryDistribution)
                .sort(([, a], [, b]) => b - a)
                .map(([category, count]) => (
                  <View key={category} style={styles.distributionItem}>
                    <Text style={styles.distributionLabel}>{category.toUpperCase()}</Text>
                    <View style={styles.distributionBarContainer}>
                      <View
                        style={[
                          styles.distributionBar,
                          {
                            width: `${(count / wardrobeAnalytics.totalItems) * 100}%`,
                            backgroundColor: colors.primary,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.distributionValue}>{count}</Text>
                  </View>
                ))}
            </View>
          </Card>

          {/* Most Worn Items */}
          {wardrobeAnalytics.mostWorn.length > 0 && (
            <Card variant="elevated" style={styles.listCard}>
              <Text style={styles.cardTitle}>⭐ Most Worn Items</Text>
              {wardrobeAnalytics.mostWorn.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
                  ) : (
                    <View style={styles.itemImagePlaceholder}>
                      <Ionicons name="shirt-outline" size={24} color={colors.textMuted} />
                    </View>
                  )}
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemMeta}>
                      {item.category} • {item.color}
                    </Text>
                  </View>
                  <View style={styles.wearCountBadge}>
                    <Ionicons name="repeat" size={scale(16)} color={colors.primary} />
                    <Text style={styles.wearCount}>{item.wearCount}</Text>
                  </View>
                </View>
              ))}
            </Card>
          )}

          {/* Unused Items */}
          {wardrobeAnalytics.unusedItems.length > 0 && (
            <Card variant="elevated" style={styles.listCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>⚠️ Unused Items</Text>
                <Badge label={`${wardrobeAnalytics.unusedItems.length} items`} variant="warning" />
              </View>
              <Text style={styles.cardSubtitle}>
                Items you haven't worn yet - consider creating outfits with them!
              </Text>
              {wardrobeAnalytics.unusedItems.slice(0, 3).map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
                  ) : (
                    <View style={styles.itemImagePlaceholder}>
                      <Ionicons name="shirt-outline" size={24} color={colors.textMuted} />
                    </View>
                  )}
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemMeta}>
                      {item.daysSinceAdded} days since added
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          )}
        </View>
      )}

      {/* Outfit Analytics */}
      {outfitAnalytics && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👔 Outfit Analytics</Text>
          
          <Card variant="elevated" style={styles.statsCard}>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{outfitAnalytics.totalOutfits}</Text>
                <Text style={styles.statLabel}>Total Outfits</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{outfitAnalytics.favoriteOutfits}</Text>
                <Text style={styles.statLabel}>Favorites</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{outfitAnalytics.recentOutfits}</Text>
                <Text style={styles.statLabel}>Last 30 Days</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{outfitAnalytics.avgRating}</Text>
                <Text style={styles.statLabel}>Avg Rating</Text>
              </View>
            </View>
          </Card>

          {/* Occasion Distribution */}
          {Object.keys(outfitAnalytics.occasionDistribution).length > 0 && (
            <Card variant="elevated" style={styles.distributionCard}>
              <Text style={styles.cardTitle}>Occasion Distribution</Text>
              <View style={styles.distributionList}>
                {Object.entries(outfitAnalytics.occasionDistribution)
                  .sort(([, a], [, b]) => b - a)
                  .map(([occasion, count]) => (
                    <View key={occasion} style={styles.distributionItem}>
                      <Text style={styles.distributionLabel}>{occasion.toUpperCase()}</Text>
                      <View style={styles.distributionBarContainer}>
                        <View
                          style={[
                            styles.distributionBar,
                            {
                              width: `${(count / outfitAnalytics.totalOutfits) * 100}%`,
                              backgroundColor: colors.secondary,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.distributionValue}>{count}</Text>
                    </View>
                  ))}
              </View>
            </Card>
          )}
        </View>
      )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingTop: spacing['2xl'],
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    ...typography.body,
    marginTop: spacing.md,
    color: colors.textMuted,
  },
  title: {
    ...typography.title,
    fontSize: scale(28),
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.sectionTitle,
    marginBottom: spacing.md,
  },
  // Insights
  insightCard: {
    marginBottom: spacing.md,
  },
  insightHeader: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    ...typography.bodyBold,
    marginBottom: spacing.xs,
  },
  insightMessage: {
    ...typography.body,
    color: colors.textSecondary,
  },
  // Stats
  statsCard: {
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.cardSoft,
    borderRadius: 12,
  },
  statValue: {
    ...typography.title,
    fontSize: scale(32),
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  // Distribution
  distributionCard: {
    marginBottom: spacing.md,
  },
  cardTitle: {
    ...typography.sectionTitle,
    fontSize: scale(16),
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  distributionList: {
    gap: spacing.sm,
  },
  distributionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  distributionLabel: {
    ...typography.caption,
    width: scale(80),
    fontSize: scale(11),
  },
  distributionBarContainer: {
    flex: 1,
    height: scale(8),
    backgroundColor: colors.cardSoft,
    borderRadius: scale(4),
    overflow: 'hidden',
  },
  distributionBar: {
    height: '100%',
    borderRadius: scale(4),
  },
  distributionValue: {
    ...typography.caption,
    width: scale(30),
    textAlign: 'right',
  },
  // Lists
  listCard: {
    marginBottom: spacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  itemImage: {
    width: scale(60),
    height: scale(60),
    borderRadius: scale(8),
  },
  itemImagePlaceholder: {
    width: scale(60),
    height: scale(60),
    borderRadius: scale(8),
    backgroundColor: colors.cardSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    ...typography.bodyBold,
    marginBottom: spacing.xs / 2,
  },
  itemMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  wearCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
  },
  wearCount: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
});

