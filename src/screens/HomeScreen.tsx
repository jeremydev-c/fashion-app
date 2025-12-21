import React from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { scale } from '../utils/responsive';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const HomeScreen: React.FC = () => {
  return (
    <LinearGradient
      colors={['#020617', '#050816', '#0b1020']}
      style={styles.root}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>AI POWERED</Text>
            </View>
            <View style={[styles.badge, styles.betaBadge]}>
              <Text style={[styles.badgeText, styles.betaBadgeText]}>BETA</Text>
            </View>
          </View>
          <Text style={styles.title}>Fashion Fit</Text>
          <Text style={styles.subtitle}>
            Your AI-powered wardrobe that learns your style and creates perfect outfits.
          </Text>
          <View style={styles.heroRow}>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillNumber}>95%</Text>
              <Text style={styles.heroPillLabel}>AI accuracy</Text>
            </View>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillNumber}>500ms</Text>
              <Text style={styles.heroPillLabel}>Instant looks</Text>
            </View>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillNumber}>∞</Text>
              <Text style={styles.heroPillLabel}>Outfit ideas</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.cardRow}>
            <View style={[styles.card, styles.cardPrimary]}>
              <Text style={styles.cardLabel}>AI Stylist</Text>
              <Text style={styles.cardTitle}>Get today's perfect fits</Text>
              <Text style={styles.cardText}>
                Time, weather, mood, occasion — your AI stylist handles it.
              </Text>
            </View>
            <View style={[styles.card, styles.cardSecondary]}>
              <Text style={styles.cardLabel}>Wardrobe Scan</Text>
              <Text style={styles.cardTitle}>Digitize your closet</Text>
              <Text style={styles.cardText}>
                Add items with photo-based AI and auto-categorization.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Live Style Intelligence</Text>
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Style DNA</Text>
              <Text style={styles.metricValue}>Calibrating…</Text>
              <Text style={styles.metricHint}>Save outfits & rate looks</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Wardrobe Utilization</Text>
              <Text style={styles.metricValue}>Coming soon</Text>
              <Text style={styles.metricHint}>We'll track cost-per-wear</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingTop: spacing['2xl'],
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  hero: {
    marginBottom: spacing['2xl'],
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
  },
  betaBadge: {
    backgroundColor: '#22c55e',
  },
  betaBadgeText: {
    color: '#fff',
    fontWeight: '700',
  },
  badgeText: {
    ...typography.caption,
    color: colors.primary,
    letterSpacing: 1,
  },
  title: {
    ...typography.display,
  },
  subtitle: {
    ...typography.body,
    marginTop: spacing.sm,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
  },
  heroPill: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: 18,
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  heroPillNumber: {
    ...typography.bodyBold,
    fontSize: scale(16),
  },
  heroPillLabel: {
    ...typography.caption,
    marginTop: scale(2),
  },
  section: {
    marginTop: spacing['2xl'],
  },
  sectionTitle: {
    ...typography.sectionTitle,
    marginBottom: spacing.md,
  },
  cardRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  card: {
    flex: 1,
    borderRadius: scale(20),
    padding: spacing.lg,
  },
  cardPrimary: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  cardSecondary: {
    backgroundColor: colors.secondarySoft,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  cardLabel: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  cardTitle: {
    ...typography.bodyBold,
    fontSize: scale(16),
    marginBottom: spacing.sm,
  },
  cardText: {
    ...typography.body,
    fontSize: scale(13),
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  metricCard: {
    flex: 1,
    borderRadius: 18,
    padding: spacing.lg,
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  metricLabel: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  metricValue: {
    ...typography.bodyBold,
    fontSize: scale(15),
    marginBottom: spacing.xs,
  },
  metricHint: {
    ...typography.caption,
  },
});
