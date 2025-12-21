import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { getPlans, getSubscription, createCheckout, cancelSubscription, type SubscriptionPlan, type Subscription } from '../services/paymentService';
import { useAuth } from '../context/AuthContext';
import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = (size: number) => Math.round((SCREEN_WIDTH / 393) * size);

export const SubscriptionScreen: React.FC = () => {
  const { user } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [plansData, subscriptionData] = await Promise.all([
        getPlans(),
        getSubscription(),
      ]);
      setPlans(plansData);
      setCurrentSubscription(subscriptionData);
    } catch (error) {
      console.error('Failed to load subscription data:', error);
      Alert.alert('Error', 'Failed to load subscription plans');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId: string) => {
    if (planId === 'free') {
      Alert.alert('Free Plan', 'You are already on the free plan!');
      return;
    }

    setProcessing(planId);
    try {
      const { url } = await createCheckout(planId);
      
      // Open Stripe checkout in browser
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        Alert.alert(
          'Checkout Opened',
          'Complete your payment in the browser. Your subscription will activate automatically.',
          [{ text: 'OK', onPress: () => loadData() }]
        );
      } else {
        Alert.alert('Error', 'Could not open checkout page');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      Alert.alert('Error', error.message || 'Failed to start checkout');
    } finally {
      setProcessing(null);
    }
  };

  const handleCancel = async () => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your subscription? You will continue to have access until the end of your billing period.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelSubscription();
              Alert.alert('Success', 'Subscription cancelled successfully');
              loadData();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to cancel subscription');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <LinearGradient colors={['#020617', '#050816', '#0b1020']} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading plans...</Text>
        </View>
      </LinearGradient>
    );
  }

  const isPremium = currentSubscription?.planId !== 'free' && currentSubscription?.status === 'active';

  return (
    <LinearGradient colors={['#020617', '#050816', '#0b1020']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.betaBanner}>
            <Text style={styles.betaBannerText}>🚀 BETA MODE - ALL FEATURES FREE</Text>
          </View>
          <Text style={styles.title}>Premium Coming Soon</Text>
          <Text style={styles.subtitle}>
            During beta, everything is free! We're focused on making Fashion Fit amazing.
          </Text>
          <Text style={styles.betaMessage}>
            Once we validate the app with real users, we'll introduce subscription plans. For now, enjoy unlimited access to all features! 🎉
          </Text>
        </View>

        {isPremium && (
          <View style={styles.currentPlan}>
            <Ionicons name="checkmark-circle" size={scale(24)} color={colors.primary} />
            <Text style={styles.currentPlanText}>
              You're on {plans.find(p => p.id === currentSubscription?.planId)?.name || 'Premium'}
            </Text>
            {currentSubscription?.currentPeriodEnd && (
              <Text style={styles.currentPlanDate}>
                Renews: {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
              </Text>
            )}
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.plansContainer}>
          {plans.map((plan) => {
            const isCurrentPlan = currentSubscription?.planId === plan.id && currentSubscription?.status === 'active';
            const isFree = plan.id === 'free';
            const isPopular = plan.id === 'premium';

            return (
              <View
                key={plan.id}
                style={[
                  styles.planCard,
                  isPopular && styles.planCardPopular,
                  isCurrentPlan && styles.planCardCurrent,
                ]}
              >
                {isPopular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
                  </View>
                )}

                <View style={styles.planHeader}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <View style={styles.priceContainer}>
                    <Text style={styles.price}>${plan.price}</Text>
                    <Text style={styles.priceInterval}>/{plan.interval === 'year' ? 'year' : 'mo'}</Text>
                  </View>
                  {plan.interval === 'year' && (
                    <Text style={styles.saveBadge}>Save 33%</Text>
                  )}
                </View>

                <View style={styles.featuresContainer}>
                  {plan.features.map((feature, index) => (
                    <View key={index} style={styles.feature}>
                      <Ionicons name="checkmark" size={scale(16)} color={colors.primary} />
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  style={[
                    styles.subscribeButton,
                    isCurrentPlan && styles.subscribeButtonCurrent,
                    isFree && styles.subscribeButtonFree,
                  ]}
                  onPress={() => {
                    Alert.alert(
                      'Beta Mode',
                      'All features are free during beta! Payments will be enabled after we validate the app with users.',
                      [{ text: 'Got it!' }]
                    );
                  }}
                  disabled={processing !== null}
                >
                  <Text style={styles.subscribeButtonText}>
                    {isCurrentPlan ? 'Current Plan' : isFree ? 'Free Forever' : 'Coming Soon'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            🎉 Beta Mode: Everything is free! Focus on building the best fashion app.
          </Text>
          <Text style={styles.footerText}>
            Payments will be enabled after beta testing. Your feedback helps us improve!
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: colors.textMuted,
  },
  header: {
    marginBottom: spacing.xl,
    alignItems: 'center',
  },
  betaBanner: {
    backgroundColor: '#22c55e',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: scale(20),
    marginBottom: spacing.lg,
  },
  betaBannerText: {
    ...typography.bodyBold,
    fontSize: scale(12),
    color: '#fff',
    letterSpacing: 1,
  },
  betaMessage: {
    ...typography.body,
    fontSize: scale(14),
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: spacing.md,
    lineHeight: scale(20),
  },
  title: {
    ...typography.display,
    fontSize: scale(32),
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    fontSize: scale(16),
    textAlign: 'center',
    color: colors.textSecondary,
  },
  currentPlan: {
    backgroundColor: colors.primarySoft,
    borderRadius: scale(16),
    padding: spacing.lg,
    marginBottom: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  currentPlanText: {
    ...typography.bodyBold,
    fontSize: scale(16),
    marginTop: spacing.sm,
    color: colors.primary,
  },
  currentPlanDate: {
    ...typography.caption,
    marginTop: spacing.xs,
    color: colors.textMuted,
  },
  cancelButton: {
    marginTop: spacing.md,
    paddingVertical: scale(8),
    paddingHorizontal: scale(16),
  },
  cancelButtonText: {
    ...typography.caption,
    color: colors.danger,
    textDecorationLine: 'underline',
  },
  plansContainer: {
    gap: spacing.lg,
  },
  planCard: {
    backgroundColor: colors.cardSoft,
    borderRadius: scale(20),
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    position: 'relative',
  },
  planCardPopular: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.primarySoft,
  },
  planCardCurrent: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  popularBadge: {
    position: 'absolute',
    top: scale(-12),
    alignSelf: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: scale(16),
    paddingVertical: scale(4),
    borderRadius: scale(12),
  },
  popularBadgeText: {
    ...typography.caption,
    fontSize: scale(10),
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
  planHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  planName: {
    ...typography.title,
    fontSize: scale(24),
    marginBottom: spacing.sm,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.xs,
  },
  price: {
    ...typography.display,
    fontSize: scale(40),
    color: colors.primary,
  },
  priceInterval: {
    ...typography.body,
    fontSize: scale(16),
    color: colors.textMuted,
    marginLeft: scale(4),
  },
  saveBadge: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  featuresContainer: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featureText: {
    ...typography.body,
    flex: 1,
  },
  subscribeButton: {
    backgroundColor: colors.primary,
    borderRadius: scale(12),
    paddingVertical: scale(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscribeButtonCurrent: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  subscribeButtonFree: {
    backgroundColor: colors.card,
  },
  subscribeButtonText: {
    ...typography.bodyBold,
    fontSize: scale(16),
    color: '#fff',
  },
  footer: {
    marginTop: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  footerText: {
    ...typography.caption,
    textAlign: 'center',
    color: colors.textMuted,
  },
});

export default SubscriptionScreen;

