import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../theme/ThemeProvider';
import { spacing } from '../theme/spacing';
import { scale, verticalScale } from '../utils/responsive';
import { useUserId } from '../hooks/useUserId';
import { fetchWardrobeItems } from '../services/wardrobeApi';

const TIPS = [
  { icon: 'diamond-outline' as const, text: 'Mix textures for depth — denim with knit creates effortless contrast' },
  { icon: 'sunny-outline' as const, text: 'Lighter fabrics in the morning, layer up for seamless evening transitions' },
  { icon: 'color-palette-outline' as const, text: 'The rule of three: pick 3 colors max per outfit for a polished look' },
  { icon: 'sparkles-outline' as const, text: 'One statement accessory transforms a simple outfit into a look' },
  { icon: 'contrast-outline' as const, text: 'Monochrome outfits instantly read as more intentional and refined' },
];

function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export const HomeScreen: React.FC = () => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const userId = useUserId();

  const [wardrobeCount, setWardrobeCount] = useState(0);
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!userId) return;
    fetchWardrobeItems(userId).then(items => setWardrobeCount(items.length)).catch(() => {});
  }, [userId]);

  const timeOfDay = getTimeGreeting();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + verticalScale(16) }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {/* Brand Mark */}
          <View style={styles.brandRow}>
            <Text style={[styles.brandText, { color: colors.primary }]}>FASHION FIT</Text>
            <View style={[styles.liveBadge, { backgroundColor: colors.primarySoft }]}>
              <View style={[styles.liveDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.liveText, { color: colors.primary }]}>AI ACTIVE</Text>
            </View>
          </View>

          {/* Greeting */}
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>{timeOfDay}</Text>
          <Text style={[styles.headline, { color: colors.textPrimary }]}>
            Your Style,{'\n'}Elevated.
          </Text>

          {/* Hero Action */}
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.navigate('Stylist')}
          >
            <LinearGradient
              colors={[...colors.gradientAccent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <View style={styles.heroContent}>
                <View style={styles.heroIconWrap}>
                  <Ionicons name="sparkles" size={scale(20)} color={colors.textOnPrimary} />
                </View>
                <View style={styles.heroText}>
                  <Text style={[styles.heroTitle, { color: colors.textOnPrimary }]}>Get Styled</Text>
                  <Text style={[styles.heroDesc, { color: colors.textOnPrimary, opacity: 0.75 }]}>
                    AI-curated outfits from your wardrobe
                  </Text>
                </View>
              </View>
              <Ionicons name="arrow-forward" size={scale(20)} color={colors.textOnPrimary} style={{ opacity: 0.8 }} />
            </LinearGradient>
          </TouchableOpacity>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{wardrobeCount}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>PIECES</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
              <Text style={[styles.statValue, { color: colors.primary }]}>∞</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>COMBOS</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
              <Ionicons name="trending-up" size={scale(18)} color={colors.success} />
              <Text style={[styles.statLabel, { color: colors.textMuted, marginTop: verticalScale(4) }]}>LEARNING</Text>
            </View>
          </View>

          {/* Quick Actions */}
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>EXPLORE</Text>
          <View style={styles.actionsColumn}>
            {[
              { icon: 'camera-outline' as const, title: 'Add to Wardrobe', desc: 'Scan & categorize items instantly', route: 'Wardrobe', accent: colors.primary },
              { icon: 'calendar-outline' as const, title: 'Plan Your Week', desc: 'AI outfits for every occasion', route: 'Planner', accent: colors.accent },
              { icon: 'chatbubble-outline' as const, title: 'Style Coach', desc: 'Personal fashion advice on demand', route: 'Coach', accent: colors.secondary },
            ].map((action, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.actionRow, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}
                activeOpacity={0.85}
                onPress={() => navigation.navigate(action.route)}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.primarySoft }]}>
                  <Ionicons name={action.icon} size={scale(18)} color={action.accent} />
                </View>
                <View style={styles.actionText}>
                  <Text style={[styles.actionTitle, { color: colors.textPrimary }]}>{action.title}</Text>
                  <Text style={[styles.actionDesc, { color: colors.textMuted }]}>{action.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={scale(16)} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Style Tip */}
          <View style={[styles.tipCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
            <Ionicons name={tip.icon} size={scale(16)} color={colors.primary} />
            <View style={styles.tipContent}>
              <Text style={[styles.tipLabel, { color: colors.primary }]}>STYLE INSIGHT</Text>
              <Text style={[styles.tipText, { color: colors.textSecondary }]}>{tip.text}</Text>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={[styles.footerLine, { backgroundColor: colors.divider }]} />
            <Text style={[styles.footerText, { color: colors.textMuted }]}>
              Powered by AI
            </Text>
            <View style={[styles.footerLine, { backgroundColor: colors.divider }]} />
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg + scale(4),
    paddingBottom: verticalScale(120),
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(24),
  },
  brandText: {
    fontSize: scale(12),
    fontWeight: '600',
    letterSpacing: 3,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    borderRadius: scale(12),
    gap: scale(5),
  },
  liveDot: {
    width: scale(5),
    height: scale(5),
    borderRadius: scale(3),
  },
  liveText: {
    fontSize: scale(9),
    fontWeight: '600',
    letterSpacing: 1.4,
  },
  greeting: {
    fontSize: scale(14),
    fontWeight: '400',
    letterSpacing: 0.3,
    marginBottom: verticalScale(4),
  },
  headline: {
    fontSize: scale(32),
    fontWeight: '300',
    letterSpacing: -0.8,
    lineHeight: scale(38),
    marginBottom: verticalScale(24),
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: scale(18),
    borderRadius: scale(16),
    marginBottom: verticalScale(24),
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(14),
  },
  heroIconWrap: {
    width: scale(42),
    height: scale(42),
    borderRadius: scale(21),
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { flex: 1 },
  heroTitle: {
    fontSize: scale(17),
    fontWeight: '600',
    letterSpacing: -0.2,
    marginBottom: verticalScale(2),
  },
  heroDesc: {
    fontSize: scale(12),
    fontWeight: '400',
    letterSpacing: 0.1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginBottom: verticalScale(28),
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(18),
    borderRadius: scale(14),
    borderWidth: 1,
  },
  statDivider: {
    width: scale(1),
    height: verticalScale(28),
    marginHorizontal: scale(8),
  },
  statValue: {
    fontSize: scale(24),
    fontWeight: '300',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: scale(9),
    fontWeight: '600',
    letterSpacing: 1.6,
    marginTop: verticalScale(4),
  },
  sectionLabel: {
    fontSize: scale(10),
    fontWeight: '600',
    letterSpacing: 2.2,
    marginBottom: verticalScale(14),
  },
  actionsColumn: {
    gap: verticalScale(8),
    marginBottom: verticalScale(28),
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: scale(14),
    borderRadius: scale(14),
    borderWidth: 1,
    gap: scale(12),
  },
  actionIcon: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { flex: 1 },
  actionTitle: {
    fontSize: scale(14),
    fontWeight: '600',
    letterSpacing: -0.1,
    marginBottom: verticalScale(2),
  },
  actionDesc: {
    fontSize: scale(12),
    fontWeight: '400',
    letterSpacing: 0.1,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: scale(16),
    borderRadius: scale(14),
    borderWidth: 1,
    gap: scale(12),
    marginBottom: verticalScale(28),
  },
  tipContent: { flex: 1 },
  tipLabel: {
    fontSize: scale(9),
    fontWeight: '700',
    letterSpacing: 1.8,
    marginBottom: verticalScale(6),
  },
  tipText: {
    fontSize: scale(13),
    lineHeight: scale(19),
    fontWeight: '400',
    letterSpacing: 0.1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(12),
    marginBottom: verticalScale(8),
  },
  footerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  footerText: {
    fontSize: scale(10),
    fontWeight: '500',
    letterSpacing: 1.4,
  },
});

export default HomeScreen;
