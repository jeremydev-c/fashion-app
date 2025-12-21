import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = (size: number) => Math.round((SCREEN_WIDTH / 393) * size);

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  buttons: Array<{
    text: string;
    onPress: () => void;
    style?: 'default' | 'destructive' | 'primary';
  }>;
  onClose: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}

export const CustomAlert: React.FC<CustomAlertProps> = ({
  visible,
  title,
  message,
  buttons,
  onClose,
  icon,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <BlurView intensity={20} style={styles.blur}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.container}>
            {icon && (
              <View style={styles.iconContainer}>
                <LinearGradient
                  colors={['#ff6b9c', '#7f5dff']}
                  style={styles.iconGradient}
                >
                  <Ionicons name={icon} size={scale(32)} color="#fff" />
                </LinearGradient>
              </View>
            )}
            
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
            
            <View style={styles.buttonContainer}>
              {buttons.map((button, index) => {
                const isPrimary = button.style === 'primary' || (index === buttons.length - 1 && buttons.length === 1);
                const isDestructive = button.style === 'destructive';
                const isCancel = button.text.toLowerCase().includes('cancel');
                
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.button,
                      isPrimary && styles.buttonPrimary,
                      isDestructive && styles.buttonDestructive,
                      buttons.length > 1 && !isPrimary && !isDestructive && styles.buttonSecondary,
                    ]}
                    onPress={() => {
                      button.onPress();
                      onClose();
                    }}
                    activeOpacity={0.7}
                  >
                    {isPrimary ? (
                      <LinearGradient
                        colors={['#ff6b9c', '#7f5dff']}
                        style={styles.buttonGradient}
                      >
                        <Text style={[styles.buttonText, styles.buttonTextPrimary]}>
                          {button.text}
                        </Text>
                      </LinearGradient>
                    ) : (
                      <Text
                        style={[
                          styles.buttonText,
                          isDestructive && styles.buttonTextDestructive,
                        ]}
                      >
                        {button.text}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          </TouchableOpacity>
        </BlurView>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
  },
  blur: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: SCREEN_WIDTH * 0.85,
    maxWidth: 400,
    backgroundColor: colors.card,
    borderRadius: scale(24),
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 10,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconGradient: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...typography.title,
    fontSize: scale(22),
    textAlign: 'center',
    marginBottom: spacing.sm,
    color: colors.textPrimary,
  },
  message: {
    ...typography.body,
    fontSize: scale(15),
    textAlign: 'center',
    color: colors.textSecondary,
    lineHeight: scale(22),
    marginBottom: spacing.xl,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    borderRadius: scale(12),
    overflow: 'hidden',
  },
  buttonPrimary: {
    // Gradient handled inside
  },
  buttonDestructive: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  buttonSecondary: {
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  buttonGradient: {
    paddingVertical: scale(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    ...typography.bodyBold,
    fontSize: scale(15),
    textAlign: 'center',
    paddingVertical: scale(14),
    color: colors.textPrimary,
  },
  buttonTextPrimary: {
    color: '#fff',
  },
  buttonTextDestructive: {
    color: '#ef4444',
  },
});

