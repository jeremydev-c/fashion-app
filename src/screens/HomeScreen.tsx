import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { useTranslation } from 'react-i18next';

const TIPS = [
  { icon: 'diamond-outline' as const, text: 'Mix textures for depth \u2014 denim with knit creates effortless contrast' },
  { icon: 'sunny-outline' as const, text: 'Lighter fabrics in the morning, layer up for seamless evening transitions' },
  { icon: 'color-palette-outline' as const, text: 'The rule of three: pick 3 colors max per outfit for a polished look' },
  { icon: 'sparkles-outline' as const, text: 'One statement accessory transforms a simple outfit into a look' },
  { icon: 'contrast-outline' as const, text: 'Monochrome outfits instantly read as more intentional and refined' },
];

const MORNING_MESSAGES = [
  { headline: 'Rise & Refine', sub: 'A fresh day deserves a fresh look. Let\u2019s style your morning.' },
  { headline: 'Good Morning', sub: 'Start your day with intention. Your wardrobe is ready.' },
  { headline: 'New Day, New Look', sub: 'The morning is yours. Let\u2019s make it count.' },
  { headline: 'Dress the Part', sub: 'Set the tone for today with the perfect outfit.' },
];

const AFTERNOON_MESSAGES = [
  { headline: 'Afternoon Polish', sub: 'Midday refresh? We\u2019ve got looks that transition beautifully.' },
  { headline: 'Style Check', sub: 'The day is in motion. Stay sharp, stay you.' },
  { headline: 'Keep It Going', sub: 'Your afternoon deserves the same energy as your morning.' },
  { headline: 'Looking Good', sub: 'Halfway through \u2014 let\u2019s keep the style momentum.' },
];

const EVENING_MESSAGES = [
  { headline: 'Evening Elegance', sub: 'Wind down in style. Or gear up for tonight.' },
  { headline: 'Night Mode', sub: 'The evening calls for something special. We\u2019re on it.' },
  { headline: 'After Hours', sub: 'Transition seamlessly from day to night.' },
  { headline: 'Set the Scene', sub: 'Evening plans? Let your outfit do the talking.' },
];

function getTimeGreeting(h: number, t: (k: string) => string) {
  if (h < 12) return { label: t('home.morning'), messages: MORNING_MESSAGES };
  if (h < 17) return { label: t('home.afternoon'), messages: AFTERNOON_MESSAGES };
  return { label: t('home.evening'), messages: EVENING_MESSAGES };
}

export const HomeScreen: React.FC = () => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const userId = useUserId();
  const { t } = useTranslation();

  const [wardrobeCount, setWardrobeCount] = useState(0);
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);

  const h = new Date().getHours();
  const { label: timeLabel, messages } = getTimeGreeting(h, t);
  const [greeting] = useState(() => messages[Math.floor(Math.random() * messages.length)]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!userId) return;
    fetchWardrobeItems(userId).then(items => setWardrobeCount(items.length)).catch(() => {});
  }, [userId]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + verticalScale(20) }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.brandText, { color: colors.primary }]}>FASHION FIT</Text>
            <View style={[styles.aiBadge, { backgroundColor: colors.primarySoft }]}>
              <View style={[styles.aiDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.aiLabel, { color: colors.primary }]}>AI ACTIVE</Text>
            </View>
          </View>

          {/* Dynamic Greeting */}
          <Text style={[styles.timeLabel, { color: colors.textMuted }]}>
            {timeLabel.toUpperCase()}
          </Text>
          <Text style={[styles.headline, { color: colors.textPrimary }]}>
            {greeting.headline}
          </Text>
          <Text style={[styles.subline, { color: colors.textSecondary }]}>
            {greeting.sub}
          </Text>

          {/* Hero CTA */}
          <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('Stylist')}>
            <LinearGradient
              colors={[...colors.gradientAccent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCta}
            >
              <View style={styles.heroLeft}>
                <View style={styles.heroIcon}>
                  <Ionicons name="sparkles" size={scale(18)} color={colors.textOnPrimary} />
                </View>
                <View style={styles.heroTextWrap}>
                  <Text style={[styles.heroTitle, { color: colors.textOnPrimary }]}>{t('home.aiStylist')}</Text>
                  <Text style={[styles.heroSub, { color: colors.textOnPrimary }]}>
                    {t('home.getPerfectOutfit')}
                  </Text>
                </View>
              </View>
              <Ionicons name="arrow-forward" size={scale(18)} color={colors.textOnPrimary} style={{ opacity: 0.7 }} />
            </LinearGradient>
          </TouchableOpacity>

          {/* Stats Strip */}
          <View style={[styles.statsStrip, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: colors.primary }]}>{wardrobeCount}</Text>
              <Text style={[styles.statText, { color: colors.textMuted }]}>{t('home.totalItems').toUpperCase()}</Text>
            </View>
            <View style={[styles.statSep, { backgroundColor: colors.divider }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: colors.primary }]}>{'\u221E'}</Text>
              <Text style={[styles.statText, { color: colors.textMuted }]}>{t('home.outfitIdeas').toUpperCase()}</Text>
            </View>
            <View style={[styles.statSep, { backgroundColor: colors.divider }]} />
            <View style={styles.statItem}>
              <Ionicons name="trending-up" size={scale(16)} color={colors.success} />
              <Text style={[styles.statText, { color: colors.textMuted, marginTop: verticalScale(3) }]}>{t('slideshow.learning').toUpperCase()}</Text>
            </View>
          </View>

          {/* Quick Actions */}
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('home.quickActions').toUpperCase()}</Text>
          <View style={styles.actionsGrid}>
            {([
              { icon: 'camera-outline' as const, title: t('home.wardrobeScan'), desc: t('home.digitizeCloset'), route: 'Wardrobe', accent: colors.primary },
              { icon: 'calendar-outline' as const, title: t('planner.title'), desc: t('home.instantRecommendations'), route: 'Planner', accent: colors.accent },
              { icon: 'chatbubble-outline' as const, title: t('chat.title'), desc: t('chat.subtitle'), route: 'Coach', accent: colors.secondary },
            ]).map((a, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}
                activeOpacity={0.85}
                onPress={() => navigation.navigate(a.route)}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: colors.primarySoft }]}>
                  <Ionicons name={a.icon} size={scale(17)} color={a.accent} />
                </View>
                <View style={styles.actionBody}>
                  <Text style={[styles.actionTitle, { color: colors.textPrimary }]}>{a.title}</Text>
                  <Text style={[styles.actionDesc, { color: colors.textMuted }]} numberOfLines={2}>{a.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={scale(14)} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Style Tip */}
          <View style={[styles.tipCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
            <View style={[styles.tipIconWrap, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name={tip.icon} size={scale(14)} color={colors.primary} />
            </View>
            <View style={styles.tipBody}>
              <Text style={[styles.tipLabel, { color: colors.primary }]}>{t('home.styleTips').toUpperCase()}</Text>
              <Text style={[styles.tipText, { color: colors.textSecondary }]}>{tip.text}</Text>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={[styles.footerLine, { backgroundColor: colors.divider }]} />
            <Text style={[styles.footerText, { color: colors.textMuted }]}>{t('home.aiPowered')}</Text>
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
    paddingHorizontal: spacing.lg + scale(6),
    paddingBottom: verticalScale(120),
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(32),
  },
  brandText: {
    fontSize: scale(11),
    fontWeight: '700',
    letterSpacing: 4,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    borderRadius: scale(12),
    gap: scale(5),
  },
  aiDot: {
    width: scale(5),
    height: scale(5),
    borderRadius: scale(3),
  },
  aiLabel: {
    fontSize: scale(8),
    fontWeight: '700',
    letterSpacing: 1.6,
  },

  // Greeting
  timeLabel: {
    fontSize: scale(10),
    fontWeight: '600',
    letterSpacing: 3,
    marginBottom: verticalScale(8),
  },
  headline: {
    fontSize: scale(30),
    fontWeight: '300',
    letterSpacing: -0.6,
    lineHeight: scale(36),
    marginBottom: verticalScale(6),
  },
  subline: {
    fontSize: scale(14),
    fontWeight: '400',
    letterSpacing: 0.2,
    lineHeight: scale(20),
    marginBottom: verticalScale(28),
  },

  // Hero CTA
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: scale(16),
    borderRadius: scale(14),
    marginBottom: verticalScale(24),
  },
  heroLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    flex: 1,
  },
  heroIcon: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(19),
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextWrap: { flex: 1 },
  heroTitle: {
    fontSize: scale(15),
    fontWeight: '600',
    letterSpacing: -0.1,
    marginBottom: verticalScale(1),
  },
  heroSub: {
    fontSize: scale(11),
    fontWeight: '400',
    opacity: 0.75,
    letterSpacing: 0.1,
  },

  // Stats
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: scale(14),
    borderWidth: 1,
    paddingVertical: verticalScale(16),
    marginBottom: verticalScale(28),
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNum: {
    fontSize: scale(22),
    fontWeight: '300',
    letterSpacing: -0.5,
  },
  statText: {
    fontSize: scale(8),
    fontWeight: '600',
    letterSpacing: 1.8,
    marginTop: verticalScale(4),
  },
  statSep: {
    width: 1,
    height: verticalScale(24),
  },

  // Section Title
  sectionTitle: {
    fontSize: scale(9),
    fontWeight: '700',
    letterSpacing: 2.5,
    marginBottom: verticalScale(12),
  },

  // Actions
  actionsGrid: {
    gap: verticalScale(8),
    marginBottom: verticalScale(24),
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: scale(14),
    borderRadius: scale(14),
    borderWidth: 1,
    gap: scale(12),
  },
  actionIconWrap: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBody: { flex: 1 },
  actionTitle: {
    fontSize: scale(13),
    fontWeight: '600',
    letterSpacing: -0.1,
    marginBottom: verticalScale(2),
  },
  actionDesc: {
    fontSize: scale(11),
    fontWeight: '400',
    letterSpacing: 0.1,
    lineHeight: scale(15),
  },

  // Tip
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: scale(14),
    borderRadius: scale(14),
    borderWidth: 1,
    gap: scale(12),
    marginBottom: verticalScale(28),
  },
  tipIconWrap: {
    width: scale(30),
    height: scale(30),
    borderRadius: scale(8),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: verticalScale(2),
  },
  tipBody: { flex: 1 },
  tipLabel: {
    fontSize: scale(8),
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: verticalScale(5),
  },
  tipText: {
    fontSize: scale(12),
    lineHeight: scale(18),
    fontWeight: '400',
    letterSpacing: 0.1,
  },

  // Footer
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
    fontSize: scale(9),
    fontWeight: '500',
    letterSpacing: 1.6,
  },
});

export default HomeScreen;
