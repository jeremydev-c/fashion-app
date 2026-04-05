import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
  RefreshControl,
  AppState,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../theme/ThemeProvider';
import {
  getPlans,
  getSubscription,
  initializePayment,
  verifyPayment,
  cancelSubscription,
  type SubscriptionPlan,
  type Subscription,
} from '../services/paymentService';
import { scale, verticalScale, SCREEN_WIDTH } from '../utils/responsive';

const PENDING_REF_KEY = 'paystack_pending_ref';

export const SubscriptionScreen: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currentSub, setCurrentSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [pendingRef, setPendingRef] = useState<string | null>(null);

  const appState = useRef(AppState.currentState);
  const hasAutoVerified = useRef(false);

  const loadData = useCallback(async () => {
    try {
      const [plansData, subData] = await Promise.all([
        getPlans(),
        getSubscription(),
      ]);
      setPlans(plansData);
      setCurrentSub(subData.subscription);
    } catch (error) {
      console.log('Failed to load subscription data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Restore pending reference from storage
  useEffect(() => {
    loadData();
    AsyncStorage.getItem(PENDING_REF_KEY).then(ref => {
      if (ref) setPendingRef(ref);
    });
  }, [loadData]);

  // Auto-verify when app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        const ref = pendingRef || await AsyncStorage.getItem(PENDING_REF_KEY);
        if (ref && !hasAutoVerified.current) {
          hasAutoVerified.current = true;
          console.log('App foregrounded — auto-verifying payment:', ref);
          setPendingRef(ref);
          try {
            const result = await verifyPayment(ref);
            if (result.success) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('You\'re In!', 'Your premium plan is now active!');
              await AsyncStorage.removeItem(PENDING_REF_KEY);
              setPendingRef(null);
              loadData();
            }
          } catch {
            // Verification failed — user can tap verify manually
          }
          hasAutoVerified.current = false;
        }
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [pendingRef, loadData]);

  const handleSubscribe = async (planId: string) => {
    if (planId === 'free') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setProcessing(planId);

    try {
      const { authorizationUrl, reference } = await initializePayment(planId);
      setPendingRef(reference);
      await AsyncStorage.setItem(PENDING_REF_KEY, reference);
      hasAutoVerified.current = false;

      await Linking.openURL(authorizationUrl);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to start payment');
      setPendingRef(null);
      await AsyncStorage.removeItem(PENDING_REF_KEY);
    } finally {
      setProcessing(null);
    }
  };

  const handleVerify = async () => {
    if (!pendingRef) return;
    setProcessing('verify');
    try {
      const result = await verifyPayment(pendingRef);
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('You\'re In!', 'Your premium plan is now active. Enjoy all features!');
        setPendingRef(null);
        await AsyncStorage.removeItem(PENDING_REF_KEY);
        loadData();
      } else {
        Alert.alert('Not Yet', 'Payment hasn\'t been confirmed yet. Complete the payment in your browser, then tap verify again.');
      }
    } catch {
      Alert.alert('Try Again', 'Couldn\'t verify yet. If you already paid, wait a moment and try again.');
    } finally {
      setProcessing(null);
    }
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Cancel Subscription',
      'Are you sure? You\'ll keep access until the end of your billing period.',
      [
        { text: 'Keep Plan', style: 'cancel' },
        {
          text: 'Cancel Plan',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelSubscription();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              Alert.alert('Cancelled', 'Your subscription has been cancelled.');
              loadData();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to cancel');
            }
          },
        },
      ]
    );
  };

  const isPremium = currentSub && currentSub.planId !== 'free' && currentSub.status === 'active';

  if (loading) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading plans...</Text>
        </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
        <View style={styles.header}>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={scale(24)} color={colors.textPrimary} />
          </TouchableOpacity>
        )}
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Choose Your Plan</Text>
        <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
          Unlock the full power of AI styling
          </Text>
        </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.primary} />}
      >
        {/* Current plan banner */}
        {isPremium && (
          <View style={[styles.activeBanner, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>
            <Ionicons name="checkmark-circle" size={scale(20)} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.activePlanName, { color: colors.primary }]}>
                {plans.find(p => p.id === currentSub?.planId)?.name || 'Premium'} — Active
              </Text>
            </View>
            <TouchableOpacity onPress={handleCancel}>
              <Text style={[styles.cancelLink, { color: colors.danger }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Plan cards */}
          {plans.map((plan) => {
          const isCurrent = currentSub?.planId === plan.id && currentSub?.status === 'active';
            const isFree = plan.id === 'free';
          const isPopular = plan.badge === 'MOST POPULAR';
          const isBestValue = plan.badge === 'BEST VALUE';
          const isElite = plan.id === 'elite';
          const isProcessing = processing === plan.id;

            return (
              <View
                key={plan.id}
                style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.borderSubtle },
                isPopular && { borderColor: colors.primary, borderWidth: scale(2) },
                isElite && { borderColor: colors.accent, borderWidth: scale(2) },
                isCurrent && { borderColor: colors.primary, backgroundColor: colors.primarySoft },
              ]}
            >
              {/* Badge */}
              {plan.badge && (
                <LinearGradient
                  colors={isElite ? ['#8B5CF6', '#6D28D9'] : isBestValue ? ['#059669', '#047857'] : [...colors.gradientAccent]}
                  style={styles.badge}
                >
                  <Text style={styles.badgeText}>{plan.badge}</Text>
                </LinearGradient>
              )}

              {/* Plan info */}
              <Text style={[styles.planName, { color: colors.textPrimary }]}>{plan.name}</Text>

              <View style={styles.priceRow}>
                {isFree ? (
                  <Text style={[styles.priceBig, { color: colors.textPrimary }]}>Free</Text>
                ) : (
                  <>
                    <Text style={[styles.priceCurrency, { color: colors.textMuted }]}>KES</Text>
                    <Text style={[styles.priceBig, { color: colors.primary }]}>{plan.price.toLocaleString()}</Text>
                    <Text style={[styles.priceInterval, { color: colors.textMuted }]}>
                      /{plan.interval === 'annually' ? 'year' : 'mo'}
                    </Text>
                  </>
                )}
              </View>

              {plan.id === 'pro-yearly' && (
                <Text style={[styles.saveLine, { color: colors.accent }]}>
                  KES 333/mo — save KES 1,989 vs monthly
                </Text>
              )}

              {/* Features */}
              <View style={styles.features}>
                {plan.features.map((feat, i) => (
                  <View key={i} style={styles.featRow}>
                    <Ionicons
                      name="checkmark-circle"
                      size={scale(16)}
                      color={isElite ? '#8B5CF6' : colors.primary}
                    />
                    <Text style={[styles.featText, { color: colors.textSecondary }]}>{feat}</Text>
                  </View>
                ))}
              </View>

              {/* CTA */}
              {isFree ? (
                <View style={[styles.ctaBtn, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.ctaText, { color: colors.textMuted }]}>
                    {isCurrent ? 'Current Plan' : 'Free Forever'}
                  </Text>
                </View>
              ) : isCurrent ? (
                <View style={[styles.ctaBtn, { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primary }]}>
                  <Text style={[styles.ctaText, { color: colors.primary }]}>Current Plan ✓</Text>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => handleSubscribe(plan.id)}
                  disabled={isProcessing || processing !== null}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={isElite ? ['#8B5CF6', '#6D28D9'] : [...colors.gradientAccent]}
                    style={styles.ctaBtn}
                  >
                    {isProcessing ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={[styles.ctaText, { color: '#fff', fontWeight: '700' }]}>
                        Get {plan.name}
                  </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              )}
              </View>
            );
          })}

        {/* Pending verification */}
        {pendingRef && (
          <View style={{ gap: verticalScale(8), marginBottom: verticalScale(16) }}>
            <TouchableOpacity
              style={[styles.verifyBanner, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}
              onPress={handleVerify}
              disabled={processing === 'verify'}
            >
              {processing === 'verify' ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="checkmark-circle" size={scale(20)} color={colors.primary} />
              )}
              <Text style={[styles.verifyText, { color: colors.primary }]}>
                {processing === 'verify' ? 'Verifying...' : 'I\'ve paid — Verify my payment'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={async () => { setPendingRef(null); await AsyncStorage.removeItem(PENDING_REF_KEY); }}>
              <Text style={[styles.footerText, { color: colors.textMuted, textAlign: 'center', textDecorationLine: 'underline' }]}>
                Cancel
              </Text>
            </TouchableOpacity>
        </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textMuted }]}>
            Secure payments powered by Paystack
          </Text>
          <Text style={[styles.footerText, { color: colors.textMuted }]}>
            Cancel anytime. No hidden fees.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: verticalScale(12) },
  loadingText: { fontSize: scale(14) },

  header: { paddingHorizontal: scale(20), paddingTop: verticalScale(16), paddingBottom: verticalScale(12) },
  closeBtn: { position: 'absolute', right: scale(16), top: verticalScale(16), zIndex: 1 },
  headerTitle: { fontSize: scale(26), fontWeight: '800', letterSpacing: -0.5 },
  headerSub: { fontSize: scale(14), marginTop: verticalScale(4), letterSpacing: 0.2 },

  scroll: { paddingHorizontal: scale(16), paddingBottom: verticalScale(100) },

  activeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: scale(10),
    padding: scale(14), borderRadius: scale(12), borderWidth: 1,
    marginBottom: verticalScale(16),
  },
  activePlanName: { fontSize: scale(14), fontWeight: '700' },
  cancelLink: { fontSize: scale(12), fontWeight: '600', textDecorationLine: 'underline' },

  card: {
    borderRadius: scale(16), padding: scale(20), marginBottom: verticalScale(16),
    borderWidth: 1, position: 'relative', overflow: 'visible',
  },
  badge: {
    position: 'absolute', top: scale(-11), alignSelf: 'center', left: '25%', right: '25%',
    paddingVertical: verticalScale(4), borderRadius: scale(10), alignItems: 'center',
  },
  badgeText: { color: '#fff', fontSize: scale(10), fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },

  planName: { fontSize: scale(20), fontWeight: '700', marginTop: verticalScale(4), marginBottom: verticalScale(8) },

  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: scale(4), marginBottom: verticalScale(4) },
  priceCurrency: { fontSize: scale(14), fontWeight: '500' },
  priceBig: { fontSize: scale(36), fontWeight: '800', letterSpacing: -1 },
  priceInterval: { fontSize: scale(14), fontWeight: '500' },
  saveLine: { fontSize: scale(12), fontWeight: '600', marginBottom: verticalScale(8) },

  features: { marginTop: verticalScale(12), marginBottom: verticalScale(16), gap: verticalScale(10) },
  featRow: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
  featText: { fontSize: scale(13), flex: 1, lineHeight: scale(18) },

  ctaBtn: {
    borderRadius: scale(12), paddingVertical: verticalScale(14),
    alignItems: 'center', justifyContent: 'center',
  },
  ctaText: { fontSize: scale(15), fontWeight: '600', letterSpacing: 0.3 },

  verifyBanner: {
    flexDirection: 'row', alignItems: 'center', gap: scale(10),
    padding: scale(14), borderRadius: scale(12), borderWidth: 1,
    marginBottom: verticalScale(16),
  },
  verifyText: { fontSize: scale(14), fontWeight: '600' },

  footer: { alignItems: 'center', marginTop: verticalScale(8), gap: verticalScale(4) },
  footerText: { fontSize: scale(11), letterSpacing: 0.3 },
});

export default SubscriptionScreen;
