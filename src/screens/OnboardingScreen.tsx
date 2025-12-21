import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { Button } from '../components/Button';

const { width, width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = (size: number) => Math.round((SCREEN_WIDTH / 393) * size);

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

const STEPS = [
  { title: 'Your Style', subtitle: 'What styles do you gravitate towards?' },
  { title: 'Favorite Colors', subtitle: 'Pick colors you love wearing' },
  { title: 'Colors to Avoid', subtitle: 'Any colors you prefer to skip?' },
  { title: 'Your Lifestyle', subtitle: 'What occasions do you dress for most?' },
  { title: 'About You', subtitle: 'Help us personalize your experience' },
];

export const OnboardingScreen: React.FC<Props> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({
    styles: [],
    colors: [],
    occasions: [],
    avoidColors: [],
    bodyType: '',
    ageRange: '',
  });

  const progress = (step + 1) / STEPS.length;

  const toggleSelection = (
    key: 'styles' | 'colors' | 'occasions' | 'avoidColors',
    value: string
  ) => {
    setData((prev) => {
      const arr = prev[key];
      if (arr.includes(value)) {
        return { ...prev, [key]: arr.filter((v) => v !== value) };
      }
      return { ...prev, [key]: [...arr, value] };
    });
  };

  const setSingleSelection = (key: 'bodyType' | 'ageRange', value: string) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const canProceed = () => {
    switch (step) {
      case 0:
        return data.styles.length >= 1;
      case 1:
        return data.colors.length >= 2;
      case 2:
        return true; // Avoid colors is optional
      case 3:
        return data.occasions.length >= 1;
      case 4:
        return true; // Body type and age are optional
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      onComplete(data);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const renderStyleStep = () => (
    <View style={styles.optionsGrid}>
      {STYLE_OPTIONS.map((option) => {
        const selected = data.styles.includes(option.id);
        return (
          <TouchableOpacity
            key={option.id}
            style={[styles.styleOption, selected && styles.styleOptionSelected]}
            onPress={() => toggleSelection('styles', option.id)}
          >
            <Ionicons
              name={option.icon as any}
              size={28}
              color={selected ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
              {option.label}
            </Text>
            {selected && (
              <View style={styles.checkmark}>
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
            style={[styles.colorOption, selected && styles.colorOptionSelected]}
            onPress={() => toggleSelection(key, option.id)}
          >
            <View style={[styles.colorCircle, { backgroundColor: option.hex }]}>
              {selected && (
                <Ionicons
                  name="checkmark"
                  size={20}
                  color={option.id === 'white' || option.id === 'beige' || option.id === 'yellow' ? '#000' : '#fff'}
                />
              )}
            </View>
            <Text style={[styles.colorLabel, selected && styles.colorLabelSelected]}>
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
            style={[styles.styleOption, selected && styles.styleOptionSelected]}
            onPress={() => toggleSelection('occasions', option.id)}
          >
            <Ionicons
              name={option.icon as any}
              size={28}
              color={selected ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
              {option.label}
            </Text>
            {selected && (
              <View style={styles.checkmark}>
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
      <Text style={styles.sectionLabel}>Body Type (optional)</Text>
      <View style={styles.pillRow}>
        {BODY_TYPE_OPTIONS.map((option) => {
          const selected = data.bodyType === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              style={[styles.pill, selected && styles.pillSelected]}
              onPress={() => setSingleSelection('bodyType', option.id)}
            >
              <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>Age Range (optional)</Text>
      <View style={styles.pillRow}>
        {AGE_RANGE_OPTIONS.map((option) => {
          const selected = data.ageRange === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              style={[styles.pill, selected && styles.pillSelected]}
              onPress={() => setSingleSelection('ageRange', option.id)}
            >
              <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return renderStyleStep();
      case 1:
        return renderColorStep('colors');
      case 2:
        return renderColorStep('avoidColors');
      case 3:
        return renderOccasionStep();
      case 4:
        return renderAboutStep();
      default:
        return null;
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#050816', '#0b1020', '#111827']}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.stepIndicator}>
            {step + 1} of {STEPS.length}
          </Text>
        </View>

        <View style={styles.titleContainer}>
          <Text style={styles.title}>{STEPS[step].title}</Text>
          <Text style={styles.subtitle}>{STEPS[step].subtitle}</Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {renderStepContent()}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.buttonRow}>
          {step > 0 ? (
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 80 }} />
          )}

          <Button
            title={step === STEPS.length - 1 ? "Let's Go!" : 'Continue'}
            onPress={handleNext}
            disabled={!canProceed()}
            style={styles.continueButton}
          />
        </View>

        {step === 0 && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => onComplete({ styles: [], colors: [], occasions: [], avoidColors: [], bodyType: '', ageRange: '' })}
          >
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: colors.card,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  stepIndicator: {
    ...typography.caption,
    color: colors.textMuted,
  },
  titleContainer: {
    gap: spacing.xs,
  },
  title: {
    ...typography.display,
    fontSize: scale(28),
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  styleOption: {
    width: (width - spacing.lg * 2 - spacing.md) / 2,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  styleOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  optionLabel: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  optionLabelSelected: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  checkmark: {
    position: 'absolute',
    top: scale(8),
    right: scale(8),
    width: scale(22),
    height: scale(22),
    borderRadius: scale(11),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  colorOptionSelected: {},
  colorCircle: {
    width: scale(52),
    height: scale(52),
    borderRadius: scale(26),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  colorLabelSelected: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  aboutContainer: {
    marginTop: spacing.md,
  },
  sectionLabel: {
    ...typography.body,
    color: colors.textPrimary,
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
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  pillSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  pillText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  pillTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
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
    color: colors.textSecondary,
  },
  continueButton: {
    minWidth: 140,
  },
  skipButton: {
    alignSelf: 'center',
    marginTop: spacing.md,
    padding: spacing.sm,
  },
  skipText: {
    ...typography.body,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
});

