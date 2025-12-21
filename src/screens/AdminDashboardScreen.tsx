import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { apiClient } from '../services/apiClient';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { scale } from '../utils/responsive';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Admin secret - you can change this
const ADMIN_SECRET = 'fashion-fit-admin-2025';

interface AnalyticsData {
  timestamp: string;
  users: {
    total: number;
    verified: number;
    onboarded: number;
    active: number;
    premium: number;
    recent: number;
    topUsers: Array<{ userId: string; email: string; name: string; itemCount: number }>;
  };
  wardrobe: {
    totalItems: number;
    avgItemsPerUser: number;
    categoryDistribution: Record<string, number>;
    colorDistribution: Array<{ color: string; count: number }>;
  };
  outfits: {
    total: number;
    saved: number;
  };
  styleDNA: {
    total: number;
    coverage: string;
  };
  chat: {
    totalConversations: number;
    totalMessages: number;
    avgMessagesPerConversation: string;
  };
  ai: {
    totalCategorizations: number;
    totalOutfitGenerations: number;
    totalChatMessages: number;
    totalStyleDNACalculations: number;
  };
  system: {
    database: string;
    cloudinary: string;
    openai: string;
    stripe: string;
    uptime: number;
    memory: {
      used: number;
      total: number;
      external: number;
    };
  };
  apiCosts: {
    openai: {
      totalTokens: number;
      promptTokens: number;
      completionTokens: number;
      totalCost: number;
      estimatedCost: number;
      calls: {
        categorizeImage: number;
        chat: number;
        styleDNA: number;
      };
    };
    cloudinary: {
      totalStorage: number;
      totalStorageMB: number;
      totalStorageGB: number;
      totalImages: number;
      storageLimit: number | null;
      storageUsedPercent: number;
      bandwidthUsed: number;
      bandwidthUsedGB: number;
    };
    totalEstimatedCost: number;
  };
}

export const AdminDashboardScreen: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = async () => {
    try {
      setError(null);
      const response = await apiClient.get(`/admin/analytics?secret=${ADMIN_SECRET}`);
      setAnalytics(response.data);
    } catch (err: any) {
      console.error('Failed to load analytics:', err);
      setError(err?.data?.error || err?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadAnalytics();
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <LoadingSpinner size="large" message="Loading analytics..." />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={scale(48)} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadAnalytics}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!analytics) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.gradient}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {/* Header */}
          <View style={styles.header}>
            <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.headerIcon}>
              <Ionicons name="analytics" size={scale(28)} color="#fff" />
            </LinearGradient>
            <View>
              <Text style={styles.headerTitle}>Admin Dashboard</Text>
              <Text style={styles.headerSubtitle}>System Analytics & Insights</Text>
            </View>
          </View>

          {/* Last Updated */}
          <View style={styles.timestampContainer}>
            <Ionicons name="time-outline" size={scale(14)} color={colors.textMuted} />
            <Text style={styles.timestamp}>
              Last updated: {new Date(analytics.timestamp).toLocaleString()}
            </Text>
          </View>

          {/* Users Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👥 Users</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{analytics.users.total}</Text>
                <Text style={styles.statLabel}>Total Users</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{analytics.users.verified}</Text>
                <Text style={styles.statLabel}>Verified</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{analytics.users.active}</Text>
                <Text style={styles.statLabel}>Active</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{analytics.users.premium}</Text>
                <Text style={styles.statLabel}>Premium</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{analytics.users.recent}</Text>
                <Text style={styles.statLabel}>Last 7 Days</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{analytics.users.onboarded}</Text>
                <Text style={styles.statLabel}>Onboarded</Text>
              </View>
            </View>

            {/* Top Users */}
            {analytics.users.topUsers.length > 0 && (
              <View style={styles.topUsersContainer}>
                <Text style={styles.subsectionTitle}>Top Users by Items</Text>
                {analytics.users.topUsers.map((user, index) => (
                  <View key={user.userId} style={styles.topUserItem}>
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankText}>{index + 1}</Text>
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{user.name}</Text>
                      <Text style={styles.userEmail}>{user.email}</Text>
                    </View>
                    <Text style={styles.itemCount}>{user.itemCount} items</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Wardrobe Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👔 Wardrobe</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{analytics.wardrobe.totalItems}</Text>
                <Text style={styles.statLabel}>Total Items</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{analytics.wardrobe.avgItemsPerUser}</Text>
                <Text style={styles.statLabel}>Avg per User</Text>
              </View>
            </View>

            {/* Categories */}
            <View style={styles.distributionContainer}>
              <Text style={styles.subsectionTitle}>Category Distribution</Text>
              {Object.entries(analytics.wardrobe.categoryDistribution).map(([category, count]) => (
                <View key={category} style={styles.distributionItem}>
                  <Text style={styles.distributionLabel}>{category}</Text>
                  <View style={styles.distributionBarContainer}>
                    <View
                      style={[
                        styles.distributionBar,
                        {
                          width: `${(count / analytics.wardrobe.totalItems) * 100}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.distributionValue}>{count}</Text>
                </View>
              ))}
            </View>

            {/* Top Colors */}
            {analytics.wardrobe.colorDistribution.length > 0 && (
              <View style={styles.colorsContainer}>
                <Text style={styles.subsectionTitle}>Top Colors</Text>
                <View style={styles.colorsGrid}>
                  {analytics.wardrobe.colorDistribution.slice(0, 10).map(({ color, count }) => (
                    <View key={color} style={styles.colorItem}>
                      <View style={[styles.colorDot, { backgroundColor: color }]} />
                      <Text style={styles.colorName}>{color}</Text>
                      <Text style={styles.colorCount}>{count}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Outfits Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>✨ Outfits</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{analytics.outfits.total}</Text>
                <Text style={styles.statLabel}>Total Outfits</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{analytics.outfits.saved}</Text>
                <Text style={styles.statLabel}>Saved</Text>
              </View>
            </View>
          </View>

          {/* AI Usage Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🤖 AI Usage</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{analytics.ai.totalCategorizations}</Text>
                <Text style={styles.statLabel}>Categorizations</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{analytics.ai.totalOutfitGenerations}</Text>
                <Text style={styles.statLabel}>Outfit Generations</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{analytics.ai.totalChatMessages}</Text>
                <Text style={styles.statLabel}>Chat Messages</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{analytics.ai.totalStyleDNACalculations}</Text>
                <Text style={styles.statLabel}>Style DNA</Text>
              </View>
            </View>
          </View>

          {/* Chat Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💬 Chat</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{analytics.chat.totalConversations}</Text>
                <Text style={styles.statLabel}>Conversations</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{analytics.chat.totalMessages}</Text>
                <Text style={styles.statLabel}>Messages</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{analytics.chat.avgMessagesPerConversation}</Text>
                <Text style={styles.statLabel}>Avg per Chat</Text>
              </View>
            </View>
          </View>

          {/* System Health Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚙️ System Health</Text>
            <View style={styles.systemContainer}>
              <View style={styles.systemItem}>
                <Text style={styles.systemLabel}>Database</Text>
                <View style={[styles.statusBadge, analytics.system.database === 'connected' && styles.statusBadgeSuccess]}>
                  <Text style={styles.statusText}>{analytics.system.database}</Text>
                </View>
              </View>
              <View style={styles.systemItem}>
                <Text style={styles.systemLabel}>Cloudinary</Text>
                <View style={[styles.statusBadge, analytics.system.cloudinary === 'configured' && styles.statusBadgeSuccess]}>
                  <Text style={styles.statusText}>{analytics.system.cloudinary}</Text>
                </View>
              </View>
              <View style={styles.systemItem}>
                <Text style={styles.systemLabel}>OpenAI</Text>
                <View style={[styles.statusBadge, analytics.system.openai === 'configured' && styles.statusBadgeSuccess]}>
                  <Text style={styles.statusText}>{analytics.system.openai}</Text>
                </View>
              </View>
              <View style={styles.systemItem}>
                <Text style={styles.systemLabel}>Stripe</Text>
                <View style={[styles.statusBadge, analytics.system.stripe === 'configured' && styles.statusBadgeSuccess]}>
                  <Text style={styles.statusText}>{analytics.system.stripe}</Text>
                </View>
              </View>
              <View style={styles.systemItem}>
                <Text style={styles.systemLabel}>Uptime</Text>
                <Text style={styles.systemValue}>{formatUptime(analytics.system.uptime)}</Text>
              </View>
              <View style={styles.systemItem}>
                <Text style={styles.systemLabel}>Memory Usage</Text>
                <Text style={styles.systemValue}>
                  {analytics.system.memory.used}MB / {analytics.system.memory.total}MB
                </Text>
              </View>
            </View>
          </View>

          {/* Style DNA Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🧬 Style DNA</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{analytics.styleDNA.total}</Text>
                <Text style={styles.statLabel}>Calculated</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{analytics.styleDNA.coverage}%</Text>
                <Text style={styles.statLabel}>Coverage</Text>
              </View>
            </View>
          </View>

          {/* API Costs Section */}
          {analytics.apiCosts && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💰 API Costs & Usage</Text>
              
              {/* OpenAI Costs */}
              <View style={styles.costCard}>
                <View style={styles.costHeader}>
                  <Ionicons name="sparkles" size={scale(20)} color={colors.primary} />
                  <Text style={styles.costTitle}>OpenAI</Text>
                </View>
                <View style={styles.costStats}>
                  <View style={styles.costStatItem}>
                    <Text style={styles.costLabel}>Total Cost</Text>
                    <Text style={styles.costValue}>
                      ${((analytics.apiCosts.openai?.totalCost || analytics.apiCosts.openai?.estimatedCost) || 0).toFixed(4)}
                    </Text>
                  </View>
                  <View style={styles.costStatItem}>
                    <Text style={styles.costLabel}>Total Tokens</Text>
                    <Text style={styles.costValue}>
                      {((analytics.apiCosts.openai?.totalTokens || 0) / 1000).toFixed(1)}K
                    </Text>
                  </View>
                </View>
                <View style={styles.tokenBreakdown}>
                  <View style={styles.tokenItem}>
                    <Text style={styles.tokenLabel}>Prompt Tokens</Text>
                    <Text style={styles.tokenValue}>
                      {((analytics.apiCosts.openai?.promptTokens || 0) / 1000).toFixed(1)}K
                    </Text>
                  </View>
                  <View style={styles.tokenItem}>
                    <Text style={styles.tokenLabel}>Completion Tokens</Text>
                    <Text style={styles.tokenValue}>
                      {((analytics.apiCosts.openai?.completionTokens || 0) / 1000).toFixed(1)}K
                    </Text>
                  </View>
                </View>
                <View style={styles.callsBreakdown}>
                  <Text style={styles.subsectionTitle}>API Calls</Text>
                  <View style={styles.callsGrid}>
                    <View style={styles.callItem}>
                      <Text style={styles.callLabel}>Image Categorization</Text>
                      <Text style={styles.callValue}>{analytics.apiCosts.openai?.calls?.categorizeImage || 0}</Text>
                    </View>
                    <View style={styles.callItem}>
                      <Text style={styles.callLabel}>Chat Messages</Text>
                      <Text style={styles.callValue}>{analytics.apiCosts.openai?.calls?.chat || 0}</Text>
                    </View>
                    <View style={styles.callItem}>
                      <Text style={styles.callLabel}>Style DNA</Text>
                      <Text style={styles.callValue}>{analytics.apiCosts.openai?.calls?.styleDNA || 0}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Cloudinary Storage Section */}
          {analytics.apiCosts?.cloudinary && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>☁️ Cloudinary Storage</Text>
              
              <View style={styles.storageCard}>
                <View style={styles.storageHeader}>
                  <Ionicons name="cloud-outline" size={scale(20)} color={colors.secondary} />
                  <Text style={styles.storageTitle}>Storage Usage</Text>
                </View>
                
                {analytics.apiCosts.cloudinary.storageLimit ? (
                  <>
                    <View style={styles.storageBarContainer}>
                      <View style={styles.storageBarTrack}>
                        <View
                          style={[
                            styles.storageBarFill,
                            {
                              width: `${Math.min(analytics.apiCosts.cloudinary.storageUsedPercent || 0, 100)}%`,
                              backgroundColor:
                                (analytics.apiCosts.cloudinary.storageUsedPercent || 0) > 80
                                  ? colors.danger
                                  : (analytics.apiCosts.cloudinary.storageUsedPercent || 0) > 60
                                  ? '#f59e0b'
                                  : colors.primary,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.storagePercent}>
                        {analytics.apiCosts.cloudinary.storageUsedPercent || 0}% Used
                      </Text>
                    </View>
                    
                    <View style={styles.storageStats}>
                      <View style={styles.storageStatItem}>
                        <Text style={styles.storageLabel}>Used</Text>
                        <Text style={styles.storageValue}>
                          {analytics.apiCosts.cloudinary.totalStorageGB || 0} GB
                        </Text>
                      </View>
                      <View style={styles.storageStatItem}>
                        <Text style={styles.storageLabel}>Limit</Text>
                        <Text style={styles.storageValue}>
                          {analytics.apiCosts.cloudinary.storageLimit
                            ? (analytics.apiCosts.cloudinary.storageLimit / 1024 / 1024 / 1024).toFixed(2)
                            : 'N/A'}{' '}
                          GB
                        </Text>
                      </View>
                      <View style={styles.storageStatItem}>
                        <Text style={styles.storageLabel}>Remaining</Text>
                        <Text style={styles.storageValue}>
                          {analytics.apiCosts.cloudinary.storageLimit
                            ? (
                                (analytics.apiCosts.cloudinary.storageLimit -
                                  (analytics.apiCosts.cloudinary.totalStorage || 0)) /
                                1024 /
                                1024 /
                                1024
                              ).toFixed(2)
                            : 'N/A'}{' '}
                          GB
                        </Text>
                      </View>
                    </View>
                  </>
                ) : (
                  <View style={styles.storageStats}>
                    <View style={styles.storageStatItem}>
                      <Text style={styles.storageLabel}>Total Storage</Text>
                      <Text style={styles.storageValue}>
                        {analytics.apiCosts.cloudinary.totalStorageGB || 0} GB
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.storageDetails}>
                  <View style={styles.storageDetailItem}>
                    <Text style={styles.storageDetailLabel}>Total Images</Text>
                    <Text style={styles.storageDetailValue}>
                      {analytics.apiCosts.cloudinary.totalImages || 0}
                    </Text>
                  </View>
                  <View style={styles.storageDetailItem}>
                    <Text style={styles.storageDetailLabel}>Bandwidth Used</Text>
                    <Text style={styles.storageDetailValue}>
                      {analytics.apiCosts.cloudinary.bandwidthUsedGB || 0} GB
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorText: {
    fontSize: scale(16),
    color: colors.danger,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: scale(12),
  },
  retryButtonText: {
    fontSize: scale(16),
    fontWeight: '600',
    color: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  headerIcon: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(28),
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: scale(28),
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: scale(14),
    color: colors.textMuted,
    marginTop: scale(2),
  },
  timestampContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  timestamp: {
    fontSize: scale(12),
    color: colors.textMuted,
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: scale(16),
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  sectionTitle: {
    fontSize: scale(20),
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: (SCREEN_WIDTH - spacing.lg * 3) / 3,
    backgroundColor: colors.cardSoft,
    borderRadius: scale(12),
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  statValue: {
    fontSize: scale(24),
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: scale(12),
    color: colors.textMuted,
    textAlign: 'center',
  },
  subsectionTitle: {
    fontSize: scale(14),
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  topUsersContainer: {
    marginTop: spacing.md,
  },
  topUserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    gap: spacing.sm,
  },
  rankBadge: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    fontSize: scale(12),
    fontWeight: '700',
    color: '#fff',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: scale(14),
    fontWeight: '600',
    color: colors.textPrimary,
  },
  userEmail: {
    fontSize: scale(12),
    color: colors.textMuted,
  },
  itemCount: {
    fontSize: scale(14),
    fontWeight: '600',
    color: colors.primary,
  },
  distributionContainer: {
    marginTop: spacing.md,
  },
  distributionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  distributionLabel: {
    fontSize: scale(12),
    color: colors.textSecondary,
    width: scale(80),
    textTransform: 'capitalize',
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
    backgroundColor: colors.primary,
    borderRadius: scale(4),
  },
  distributionValue: {
    fontSize: scale(12),
    fontWeight: '600',
    color: colors.textPrimary,
    width: scale(40),
    textAlign: 'right',
  },
  colorsContainer: {
    marginTop: spacing.md,
  },
  colorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  colorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.cardSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: scale(16),
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  colorDot: {
    width: scale(16),
    height: scale(16),
    borderRadius: scale(8),
    borderWidth: 1,
    borderColor: colors.border,
  },
  colorName: {
    fontSize: scale(12),
    color: colors.textPrimary,
    textTransform: 'capitalize',
  },
  colorCount: {
    fontSize: scale(11),
    color: colors.textMuted,
  },
  systemContainer: {
    marginTop: spacing.md,
  },
  systemItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  systemLabel: {
    fontSize: scale(14),
    color: colors.textSecondary,
  },
  systemValue: {
    fontSize: scale(14),
    fontWeight: '600',
    color: colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: scale(4),
    borderRadius: scale(12),
    backgroundColor: colors.dangerSoft,
  },
  statusBadgeSuccess: {
    backgroundColor: colors.successSoft || '#10b981',
  },
  statusText: {
    fontSize: scale(11),
    fontWeight: '600',
    color: '#fff',
    textTransform: 'capitalize',
  },
  // API Costs Styles
  costCard: {
    backgroundColor: colors.cardSoft,
    borderRadius: scale(12),
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  costHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  costTitle: {
    fontSize: scale(16),
    fontWeight: '600',
    color: colors.textPrimary,
  },
  costStats: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  costStatItem: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.sm,
    borderRadius: scale(8),
    alignItems: 'center',
  },
  costLabel: {
    fontSize: scale(12),
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  costValue: {
    fontSize: scale(18),
    fontWeight: '700',
    color: colors.primary,
  },
  tokenBreakdown: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tokenItem: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  tokenLabel: {
    fontSize: scale(12),
    color: colors.textSecondary,
  },
  tokenValue: {
    fontSize: scale(12),
    fontWeight: '600',
    color: colors.textPrimary,
  },
  callsBreakdown: {
    marginTop: spacing.md,
  },
  callsGrid: {
    gap: spacing.xs,
  },
  callItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  callLabel: {
    fontSize: scale(12),
    color: colors.textSecondary,
  },
  callValue: {
    fontSize: scale(12),
    fontWeight: '600',
    color: colors.textPrimary,
  },
  // Cloudinary Storage Styles
  storageCard: {
    backgroundColor: colors.cardSoft,
    borderRadius: scale(12),
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  storageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  storageTitle: {
    fontSize: scale(16),
    fontWeight: '600',
    color: colors.textPrimary,
  },
  storageBarContainer: {
    marginBottom: spacing.md,
  },
  storageBarTrack: {
    height: scale(12),
    backgroundColor: colors.card,
    borderRadius: scale(6),
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  storageBarFill: {
    height: '100%',
    borderRadius: scale(6),
  },
  storagePercent: {
    fontSize: scale(12),
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'right',
  },
  storageStats: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  storageStatItem: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.sm,
    borderRadius: scale(8),
    alignItems: 'center',
  },
  storageLabel: {
    fontSize: scale(11),
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  storageValue: {
    fontSize: scale(14),
    fontWeight: '700',
    color: colors.secondary,
  },
  storageDetails: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  storageDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  storageDetailLabel: {
    fontSize: scale(12),
    color: colors.textSecondary,
  },
  storageDetailValue: {
    fontSize: scale(12),
    fontWeight: '600',
    color: colors.textPrimary,
  },
});

