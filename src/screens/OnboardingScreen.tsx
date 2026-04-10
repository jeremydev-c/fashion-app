import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors as staticColors } from '../theme/colors';
import { useThemeColors } from '../theme/ThemeProvider';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { Button } from '../components/Button';
import { scale, verticalScale, SCREEN_WIDTH } from '../utils/responsive';

type OnboardingData = {
  styles: string[];
  colors: string[];
  occasions: string[];
  avoidColors: string[];
  bodyType: string;
  ageRange: string;
};

type Props = {
  onComplete: (data: OnboardingData) => void;
};

const STYLE_OPTIONS = [
  { id: 'casual', label: 'Casual', icon: 'shirt-outline' },
  { id: 'formal', label: 'Formal', icon: 'briefcase-outline' },
  { id: 'sporty', label: 'Sporty', icon: 'fitness-outline' },
  { id: 'bohemian', label: 'Bohemian', icon: 'flower-outline' },
  { id: 'minimalist', label: 'Minimalist', icon: 'remove-outline' },
  { id: 'streetwear', label: 'Streetwear', icon: 'walk-outline' },
  { id: 'classic', label: 'Classic', icon: 'diamond-outline' },
  { id: 'vintage', label: 'Vintage', icon: 'time-outline' },
];

const COLOR_OPTIONS = [
  { id: 'black', label: 'Black', hex: '#1a1a1a' },
  { id: 'white', label: 'White', hex: '#f5f5f5' },
  { id: 'navy', label: 'Navy', hex: '#1e3a5f' },
  { id: 'gray', label: 'Gray', hex: '#6b7280' },
  { id: 'beige', label: 'Beige', hex: '#d4c4a8' },
  { id: 'brown', label: 'Brown', hex: '#8b4513' },
  { id: 'red', label: 'Red', hex: '#dc2626' },
  { id: 'pink', label: 'Pink', hex: '#ec4899' },
  { id: 'blue', label: 'Blue', hex: '#3b82f6' },
  { id: 'green', label: 'Green', hex: '#22c55e' },
  { id: 'yellow', label: 'Yellow', hex: '#eab308' },
  { id: 'purple', label: 'Purple', hex: '#8b5cf6' },
  { id: 'orange', label: 'Orange', hex: '#f97316' },
  { id: 'teal', label: 'Teal', hex: '#14b8a6' },
];

const OCCASION_OPTIONS = [
  { id: 'work', label: 'Work/Office', icon: 'business-outline' },
  { id: 'casual', label: 'Casual Outings', icon: 'cafe-outline' },
  { id: 'date', label: 'Date Night', icon: 'heart-outline' },
  { id: 'party', label: 'Parties', icon: 'musical-notes-outline' },
  { id: 'formal', label: 'Formal Events', icon: 'ribbon-outline' },
  { id: 'workout', label: 'Workout', icon: 'barbell-outline' },
  { id: 'travel', label: 'Travel', icon: 'airplane-outline' },
  { id: 'lounge', label: 'Loungewear', icon: 'home-outline' },
];

const BODY_TYPE_OPTIONS = [
  { id: 'slim', label: 'Slim' },
  { id: 'athletic', label: 'Athletic' },
  { id: 'average', label: 'Average' },
  { id: 'curvy', label: 'Curvy' },
  { id: 'plus', label: 'Plus Size' },
  { id: 'prefer-not', label: 'Prefer not to say' },
];

const AGE_RANGE_OPTIONS = [
  { id: '13-17', label: '13-17' },
  { id: '18-24', label: '18-24' },
  { id: '25-34', label: '25-34' },
  { id: '35-44', label: '35-44' },
  { id: '45-54', label: '45-54' },
  { id: '55+', label: '55+' },
];

// step 0 = welcome, steps 1-5 = quiz, step 6 = completion
const QUIZ_STEPS = [
  {
    title: 'Your Style',
    subtitle: 'What styles do you gravitate towards?',
    hint: 'We use this to recommend outfits that feel like you.',
  },
  {
    title: 'Favorite Colors',
    subtitle: 'Pick colors you love wearing',
    hint: 'Your color palette shapes every outfit we suggest.',
  },
  {
    title: 'Colors to Avoid',
    subtitle: 'Any colors you prefer to skip?',
    hint: 'Optional — we\'ll filter these out of your recommendations.',
  },
  {
    title: 'Your Lifestyle',
    subtitle: 'What occasions do you dress for most?',
    hint: 'Your AI stylist will prioritize looks for these moments.',
  },
  {
    title: 'About You',
    subtitle: 'Help us personalize your experience',
    hint: 'Optional — more detail means smarter recommendations.',
  },
];

const FEATURES = [
  { icon: 'sparkles-outline', text: 'AI outfit recommendations built around your wardrobe' },
  { icon: 'color-palette-outline', text: 'A Style DNA that gets smarter with every upload' },
  { icon: 'people-outline', text: 'Share looks and discover styles from the community' },
];

export const OnboardingScreen: React.FC<Props> = ({ onComplete }) => {
  const colors = useThemeColors();
  // step 0=welcome, 1-5=quiz, 6=completion
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({
    styles: [],
    colors: [],
    occasions: [],
    avoidColors: [],
    bodyType: '',
    ageRange: '',
  });

  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Animate progress bar when quiz step changes
  useEffect(() => {
    if (step >= 1 && step <= 5) {
      Animated.timing(progressAnim, {
        toValue: (step / 5) * 100,
        duration: 350,
        useNativeDriver: false,
      }).start();
    } else if (step === 6) {
      Animated.timing(progressAnim, {
        toValue: 100,
        duration: 350,
        useNativeDriver: false,
      }).start();
    }
  }, [step]);

  const toggleSelection = (
    key: 'styles' | 'colors' | 'occasions' | 'avoidColors',
    value: string
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setData((prev) => {
      const arr = prev[key];
      if (arr.includes(value)) {
        return { ...prev, [key]: arr.filter((v) => v !== value) };
      }
      return { ...prev, [key]: [...arr, value] };
    });
  };

  const setSingleSelection = (key: 'bodyType' | 'ageRange', value: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const canProceed = () => {
    switch (step) {
      case 0: return true;
      case 1: return data.styles.length >= 1;
      case 2: return data.colors.length >= 2;
      case 3: return true;
      case 4: return data.occasions.length >= 1;
      case 5: return true;
      case 6: return true;
      default: return false;
    }
  };

  const getHintText = () => {
    switch (step) {
      case 1: return data.styles.length === 0 ? 'Pick at least one style to continue' : null;
      case 2: return data.colors.length < 2 ? `Pick ${2 - data.colors.length} more color${data.colors.length === 1 ? '' : 's'} to continue` : null;
      case 4: return data.occasions.length === 0 ? 'Pick at least one occasion to continue' : null;
      default: return null;
    }
  };

  const handleNext = () => {
    if (step < 6) {
      setStep(step + 1);
    } else {
      onComplete(data);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const getButtonLabel = () => {
    if (step === 0) return 'Get Started';
    if (step === 5) return 'Build My Style DNA';
    if (step === 6) return 'Explore My Wardrobe';
    return 'Continue';
  };

  // ─── Step renderers ───────────────────────────────────────────────

  const renderWelcomeStep = () => (
    <View style={styles.welcomeContainer}>
      <View style={styles.welcomeIconWrap}>
        <Ionicons name="sparkles" size={scale(48)} color={colors.primary} />
      </View>
      <Text style={[styles.welcomeTitle, { color: colors.textPrimary }]}>
        Your Personal{'\n'}AI Stylist
      </Text>
      <Text style={[styles.welcomeTagline, { color: colors.textSecondary }]}>
        Takes 2 minutes. Makes every outfit decision effortless.
      </Text>

      <View style={styles.featureList}>
        {FEATURES.map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <View style={[styles.featureIconWrap, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name={f.icon as any} size={scale(20)} color={colors.primary} />
            </View>
            <Text style={[styles.featureText, { color: colors.textSecondary }]}>{f.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderStyleStep = () => (
    <View style={styles.optionsGrid}>
      {STYLE_OPTIONS.map((option) => {
        const selected = data.styles.includes(option.id);
        return (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.styleOption,
              { backgroundColor: colors.card, borderColor: 'transparent' },
              selected && { borderColor: colors.primary, backgroundColor: colors.primarySoft },
            ]}
            onPress={() => toggleSelection('styles', option.id)}
            activeOpacity={0.75}
          >
            <Ionicons
              name={option.icon as any}
              size={28}
              color={selected ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.optionLabel, { color: colors.textSecondary }, selected && { color: colors.textPrimary, fontWeight: '600' }]}>
              {option.label}
            </Text>
            {selected && (
              <View style={[styles.checkmark, { backgroundColor: colors.primary }]}>
                <Ionicons name="checkmark" size={14} color={colors.background} />
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderColorStep = (key: 'colors' | 'avoidColors') => (
    <View style={styles.colorGrid}>
      {COLOR_OPTIONS.map((option) => {
        const selected = data[key].includes(option.id);
        return (
          <TouchableOpacity
            key={option.id}
            style={styles.colorOption}
            onPress={() => toggleSelection(key, option.id)}
            activeOpacity={0.75}
          >
            <View style={[
              styles.colorCircle,
              { backgroundColor: option.hex },
              selected && styles.colorCircleSelected,
            ]}>
              {selected && (
                <Ionicons
                  name="checkmark"
                  size={20}
                  color={['white', 'beige', 'yellow'].includes(option.id) ? '#000' : '#fff'}
                />
              )}
            </View>
            <Text style={[
              styles.colorLabel,
              { color: colors.textMuted },
              selected && { color: colors.textPrimary, fontWeight: '600' },
            ]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderOccasionStep = () => (
    <View style={styles.optionsGrid}>
      {OCCASION_OPTIONS.map((option) => {
        const selected = data.occasions.includes(option.id);
        return (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.styleOption,
              { backgroundColor: colors.card, borderColor: 'transparent' },
              selected && { borderColor: colors.primary, backgroundColor: colors.primarySoft },
            ]}
            onPress={() => toggleSelection('occasions', option.id)}
            activeOpacity={0.75}
          >
            <Ionicons
              name={option.icon as any}
              size={28}
              color={selected ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.optionLabel, { color: colors.textSecondary }, selected && { color: colors.textPrimary, fontWeight: '600' }]}>
              {option.label}
            </Text>
            {selected && (
              <View style={[styles.checkmark, { backgroundColor: colors.primary }]}>
                <Ionicons name="checkmark" size={14} color={colors.background} />
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderAboutStep = () => (
    <View style={styles.aboutContainer}>
      <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Body Type (optional)</Text>
      <View style={styles.pillRow}>
        {BODY_TYPE_OPTIONS.map((option) => {
          const selected = data.bodyType === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.pill,
                { backgroundColor: colors.card, borderColor: colors.borderSubtle },
                selected && { backgroundColor: colors.primarySoft, borderColor: colors.primary },
              ]}
              onPress={() => setSingleSelection('bodyType', option.id)}
            >
              <Text style={[styles.pillText, { color: colors.textSecondary }, selected && { color: colors.primary, fontWeight: '600' }]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.sectionLabel, { color: colors.textPrimary, marginTop: spacing.xl }]}>Age Range (optional)</Text>
      <View style={styles.pillRow}>
        {AGE_RANGE_OPTIONS.map((option) => {
          const selected = data.ageRange === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.pill,
                { backgroundColor: colors.card, borderColor: colors.borderSubtle },
                selected && { backgroundColor: colors.primarySoft, borderColor: colors.primary },
              ]}
              onPress={() => setSingleSelection('ageRange', option.id)}
            >
              <Text style={[styles.pillText, { color: colors.textSecondary }, selected && { color: colors.primary, fontWeight: '600' }]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderCompletionStep = () => {
    const styleCount = data.styles.length;
    const colorCount = data.colors.length;
    const occasionCount = data.occasions.length;

    return (
      <View style={styles.completionContainer}>
        <View style={[styles.completionIconWrap, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="checkmark-circle" size={scale(64)} color={colors.primary} />
        </View>

        <Text style={[styles.completionTitle, { color: colors.textPrimary }]}>
          Your Style DNA is Ready!
        </Text>
        <Text style={[styles.completionSubtitle, { color: colors.textSecondary }]}>
          We built your personalized profile based on your choices.
        </Text>

        <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
          <View style={styles.summaryRow}>
            <Ionicons name="shirt-outline" size={scale(18)} color={colors.primary} />
            <Text style={[styles.summaryText, { color: colors.textPrimary }]}>
              <Text style={{ fontWeight: '700' }}>{styleCount}</Text> style{styleCount !== 1 ? 's' : ''} selected
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Ionicons name="color-palette-outline" size={scale(18)} color={colors.primary} />
            <Text style={[styles.summaryText, { color: colors.textPrimary }]}>
              <Text style={{ fontWeight: '700' }}>{colorCount}</Text> color{colorCount !== 1 ? 's' : ''} in your palette
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Ionicons name="calendar-outline" size={scale(18)} color={colors.primary} />
            <Text style={[styles.summaryText, { color: colors.textPrimary }]}>
              <Text style={{ fontWeight: '700' }}>{occasionCount}</Text> occasion{occasionCount !== 1 ? 's' : ''} to dress for
            </Text>
          </View>
        </View>

        <Text style={[styles.completionHint, { color: colors.textMuted }]}>
          Add wardrobe items to get your first outfit recommendation
        </Text>
      </View>
    );
  };

  const renderStepContent = () => {
    switch (step) {
      case 0: return renderWelcomeStep();
      case 1: return renderStyleStep();
      case 2: return renderColorStep('colors');
      case 3: return renderColorStep('avoidColors');
      case 4: return renderOccasionStep();
      case 5: return renderAboutStep();
      case 6: return renderCompletionStep();
      default: return null;
    }
  };

  const isQuizStep = step >= 1 && step <= 5;
  const quizStepInfo = isQuizStep ? QUIZ_STEPS[step - 1] : null;
  const hintText = getHintText();

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[...colors.gradient]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Progress bar — only during quiz */}
      {isQuizStep && (
        <View style={styles.progressHeader}>
          <View style={[styles.progressTrack, { backgroundColor: colors.card }]}>
            <Animated.View
              style={[
                styles.progressBar,
                { backgroundColor: colors.primary },
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
          <Text style={[styles.stepIndicator, { color: colors.textMuted }]}>
            {step} of 5
          </Text>
        </View>
      )}

      {/* Quiz step header */}
      {isQuizStep && quizStepInfo && (
        <View style={styles.quizHeader}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{quizStepInfo.title}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{quizStepInfo.subtitle}</Text>
          <Text style={[styles.microcopy, { color: colors.textMuted }]}>{quizStepInfo.hint}</Text>
        </View>
      )}

      {/* Welcome / Completion headers are inside their renderers */}

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          (step === 0 || step === 6) && styles.centeredContent,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {renderStepContent()}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.borderSubtle }]}>
        {/* Validation hint */}
        {hintText && (
          <Text style={[styles.validationHint, { color: colors.textMuted }]}>{hintText}</Text>
        )}

        <View style={styles.buttonRow}>
          {isQuizStep && step > 1 ? (
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
              <Text style={[styles.backButtonText, { color: colors.textSecondary }]}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.placeholderSpacer} />
          )}

          <Button
            title={getButtonLabel()}
            onPress={handleNext}
            disabled={!canProceed()}
            style={styles.continueButton}
          />
        </View>

        {step === 0 && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={() =>
              onComplete({ styles: [], colors: [], occasions: [], avoidColors: [], bodyType: '', ageRange: '' })
            }
          >
            <Text style={[styles.skipText, { color: colors.textMuted }]}>Skip setup for now</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: staticColors.background,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: verticalScale(60),
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  progressTrack: {
    flex: 1,
    height: verticalScale(4),
    borderRadius: scale(2),
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: scale(2),
  },
  stepIndicator: {
    ...typography.caption,
  },
  quizHeader: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  title: {
    ...typography.display,
    fontSize: scale(28),
  },
  subtitle: {
    ...typography.body,
  },
  microcopy: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  centeredContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },

  // ── Welcome ───────────────────────────────────────────────────────
  welcomeContainer: {
    alignItems: 'center',
    paddingTop: verticalScale(40),
    paddingBottom: spacing.xl,
  },
  welcomeIconWrap: {
    marginBottom: spacing.lg,
  },
  welcomeTitle: {
    ...typography.display,
    fontSize: scale(34),
    textAlign: 'center',
    lineHeight: scale(42),
    marginBottom: spacing.sm,
  },
  welcomeTagline: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  featureList: {
    width: '100%',
    gap: spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  featureIconWrap: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(12),
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  featureText: {
    ...typography.body,
    flex: 1,
  },

  // ── Options grid ──────────────────────────────────────────────────
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  styleOption: {
    width: (SCREEN_WIDTH - spacing.lg * 2 - spacing.md) / 2,
    borderRadius: scale(16),
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: scale(2),
    position: 'relative',
  },
  optionLabel: {
    ...typography.body,
    textAlign: 'center',
  },
  checkmark: {
    position: 'absolute',
    top: scale(8),
    right: scale(8),
    width: scale(22),
    height: scale(22),
    borderRadius: scale(11),
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Color grid ────────────────────────────────────────────────────
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
    justifyContent: 'center',
  },
  colorOption: {
    alignItems: 'center',
    gap: spacing.xs,
    width: scale(70),
  },
  colorCircle: {
    width: scale(52),
    height: scale(52),
    borderRadius: scale(26),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: scale(3),
    borderColor: 'transparent',
  },
  colorCircleSelected: {
    borderColor: staticColors.primary,
    borderWidth: scale(3),
  },
  colorLabel: {
    ...typography.caption,
  },

  // ── About ─────────────────────────────────────────────────────────
  aboutContainer: {
    marginTop: spacing.md,
  },
  sectionLabel: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: scale(20),
    borderWidth: 1,
  },
  pillText: {
    ...typography.body,
  },

  // ── Completion ────────────────────────────────────────────────────
  completionContainer: {
    alignItems: 'center',
    paddingTop: verticalScale(20),
    paddingBottom: spacing.xl,
  },
  completionIconWrap: {
    width: scale(100),
    height: scale(100),
    borderRadius: scale(50),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  completionTitle: {
    ...typography.display,
    fontSize: scale(26),
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  completionSubtitle: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  summaryCard: {
    width: '100%',
    borderRadius: scale(16),
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: staticColors.borderSubtle,
  },
  summaryText: {
    ...typography.body,
    flex: 1,
  },
  completionHint: {
    ...typography.caption,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },

  // ── Footer ────────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: verticalScale(40),
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  validationHint: {
    ...typography.caption,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
  },
  backButtonText: {
    ...typography.body,
  },
  continueButton: {
    minWidth: scale(140),
  },
  placeholderSpacer: {
    width: scale(80),
  },
  skipButton: {
    alignSelf: 'center',
    marginTop: spacing.md,
    padding: spacing.sm,
  },
  skipText: {
    ...typography.body,
    textDecorationLine: 'underline',
  },
});
