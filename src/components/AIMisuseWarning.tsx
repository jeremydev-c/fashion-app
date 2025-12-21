import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = (size: number) => Math.round((SCREEN_WIDTH / 393) * size);

const WARNING_STORAGE_KEY = 'ai_misuse_warning_acknowledged';

interface AIMisuseWarningProps {
  visible: boolean;
  onAcknowledge: () => void;
}

export const AIMisuseWarning: React.FC<AIMisuseWarningProps> = ({
  visible,
  onAcknowledge,
}) => {
  const [acknowledged, setAcknowledged] = useState(false);

  const handleAcknowledge = async () => {
    if (!acknowledged) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await AsyncStorage.setItem(WARNING_STORAGE_KEY, 'true');
    onAcknowledge();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {}}
    >
      <View style={styles.overlay}>
        <BlurView intensity={20} style={styles.blur}>
          <View style={styles.container}>
            <View style={styles.iconContainer}>
              <LinearGradient
                colors={['#ef4444', '#dc2626']}
                style={styles.iconGradient}
              >
                <Ionicons name="warning" size={scale(40)} color="#fff" />
              </LinearGradient>
            </View>

            <Text style={styles.title}>⚠️ Important AI Usage Policy</Text>

            <ScrollView
              style={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.message}>
                Fashion Fit uses advanced AI technology to provide styling assistance. 
                To ensure a safe and respectful environment for all users, please read and 
                acknowledge the following:
              </Text>

              <View style={styles.warningBox}>
                <View style={styles.warningItem}>
                  <Ionicons name="close-circle" size={scale(20)} color="#ef4444" />
                  <Text style={styles.warningText}>
                    <Text style={styles.bold}>Prohibited Uses:</Text>
                    {'\n'}• Generating harmful, offensive, or inappropriate content
                    {'\n'}• Creating content that violates intellectual property rights
                    {'\n'}• Attempting to manipulate or abuse the AI system
                    {'\n'}• Using AI for illegal activities or fraud
                    {'\n'}• Sharing or distributing inappropriate AI-generated content
                  </Text>
                </View>
              </View>

              <View style={styles.consequencesBox}>
                <Text style={styles.consequencesTitle}>⚠️ Consequences of Misuse:</Text>
                <Text style={styles.consequencesText}>
                  Violation of these policies may result in:
                  {'\n'}• Immediate account suspension or termination
                  {'\n'}• Legal action if applicable
                  {'\n'}• Permanent ban from Fashion Fit services
                  {'\n'}• Reporting to relevant authorities for serious violations
                </Text>
              </View>

              <View style={styles.checkboxContainer}>
                <TouchableOpacity
                  style={styles.checkbox}
                  onPress={() => {
                    setAcknowledged(!acknowledged);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  {acknowledged ? (
                    <LinearGradient
                      colors={['#ff6b9c', '#7f5dff']}
                      style={styles.checkboxGradient}
                    >
                      <Ionicons name="checkmark" size={scale(16)} color="#fff" />
                    </LinearGradient>
                  ) : (
                    <View style={styles.checkboxEmpty} />
                  )}
                </TouchableOpacity>
                <Text style={styles.checkboxLabel}>
                  I understand and agree to use Fashion Fit's AI features responsibly. 
                  I acknowledge that misuse may result in serious penalties including 
                  account termination and legal consequences.
                </Text>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[
                styles.button,
                !acknowledged && styles.buttonDisabled,
              ]}
              onPress={handleAcknowledge}
              disabled={!acknowledged}
              activeOpacity={0.7}
            >
              {acknowledged ? (
                <LinearGradient
                  colors={['#ff6b9c', '#7f5dff']}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.buttonText}>I Understand & Continue</Text>
                </LinearGradient>
              ) : (
                <View style={styles.buttonDisabledView}>
                  <Text style={styles.buttonTextDisabled}>
                    Please acknowledge to continue
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
};

// Check if user has already acknowledged the warning
export const hasAcknowledgedWarning = async (): Promise<boolean> => {
  try {
    const acknowledged = await AsyncStorage.getItem(WARNING_STORAGE_KEY);
    return acknowledged === 'true';
  } catch {
    return false;
  }
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
  },
  blur: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: SCREEN_WIDTH * 0.9,
    maxWidth: 450,
    maxHeight: '85%',
    backgroundColor: colors.card,
    borderRadius: scale(24),
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 10,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconGradient: {
    width: scale(80),
    height: scale(80),
    borderRadius: scale(40),
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...typography.title,
    fontSize: scale(24),
    textAlign: 'center',
    marginBottom: spacing.md,
    color: '#ef4444',
  },
  scrollContent: {
    maxHeight: scale(400),
  },
  message: {
    ...typography.body,
    fontSize: scale(15),
    textAlign: 'center',
    color: colors.textSecondary,
    lineHeight: scale(22),
    marginBottom: spacing.lg,
  },
  warningBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: scale(12),
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  warningItem: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  warningText: {
    ...typography.body,
    fontSize: scale(14),
    color: colors.textPrimary,
    flex: 1,
    lineHeight: scale(20),
  },
  bold: {
    fontWeight: '700',
    color: '#ef4444',
  },
  consequencesBox: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderRadius: scale(12),
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  consequencesTitle: {
    ...typography.bodyBold,
    fontSize: scale(15),
    color: '#fbbf24',
    marginBottom: spacing.xs,
  },
  consequencesText: {
    ...typography.body,
    fontSize: scale(14),
    color: colors.textPrimary,
    lineHeight: scale(20),
  },
  checkboxContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    alignItems: 'flex-start',
  },
  checkbox: {
    width: scale(24),
    height: scale(24),
    borderRadius: scale(6),
    borderWidth: 2,
    borderColor: colors.borderSubtle,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: scale(2),
  },
  checkboxGradient: {
    width: '100%',
    height: '100%',
    borderRadius: scale(4),
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxEmpty: {
    width: '100%',
    height: '100%',
    borderRadius: scale(4),
  },
  checkboxLabel: {
    ...typography.body,
    fontSize: scale(13),
    color: colors.textSecondary,
    flex: 1,
    lineHeight: scale(18),
  },
  button: {
    borderRadius: scale(12),
    overflow: 'hidden',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonGradient: {
    paddingVertical: scale(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabledView: {
    paddingVertical: scale(16),
    backgroundColor: colors.cardSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  buttonText: {
    ...typography.bodyBold,
    fontSize: scale(16),
    color: '#fff',
  },
  buttonTextDisabled: {
    ...typography.body,
    fontSize: scale(14),
    color: colors.textMuted,
  },
});

