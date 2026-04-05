import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useThemeColors } from '../theme/ThemeProvider';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { apiRequest } from '../services/apiClient';
import { scale } from '../utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  email: string;
  onVerified: (user: any, token: string) => void;
  onBack: () => void;
};

export const VerifyScreen: React.FC<Props> = ({ email, onVerified, onBack }) => {
  const colors = useThemeColors();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const insets = useSafeAreaInsets();
  
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    // Focus first input on mount
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    // Cooldown timer
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleCodeChange = (text: string, index: number) => {
    // Only allow numbers
    const cleaned = text.replace(/[^0-9]/g, '');
    
    if (cleaned.length <= 1) {
      const newCode = [...code];
      newCode[index] = cleaned;
      setCode(newCode);
      setError('');

      // Auto-focus next input
      if (cleaned && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }

      // Auto-submit when complete
      if (cleaned && index === 5) {
        const fullCode = newCode.join('');
        if (fullCode.length === 6) {
          handleVerify(fullCode);
        }
      }
    } else if (cleaned.length === 6) {
      // Pasted full code
      const newCode = cleaned.split('');
      setCode(newCode);
      handleVerify(cleaned);
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (fullCode?: string) => {
    const codeToVerify = fullCode || code.join('');
    
    if (codeToVerify.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await apiRequest<any>('/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email, code: codeToVerify }),
      });

      onVerified(response.user, response.token);
    } catch (err: any) {
      setError(err.message || 'Invalid code');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;

    setIsResending(true);
    setError('');

    try {
      await apiRequest('/auth/resend-code', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setResendCooldown(60); // 60 second cooldown
    } catch (err: any) {
      setError(err.message || 'Failed to resend code');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={[...colors.gradient]}
        style={StyleSheet.absoluteFillObject}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.container, { paddingTop: scale(60) }]}
      >
        {/* Back button */}
        <TouchableOpacity style={[styles.backButton, { top: scale(60) }]} onPress={onBack}>
          <Ionicons name="arrow-back" size={scale(24)} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Icon */}
        <View style={styles.iconContainer}>
          <LinearGradient
            colors={[colors.primary, colors.secondary]}
            style={styles.iconGradient}
          >
            <Ionicons name="mail" size={scale(32)} color="#fff" />
          </LinearGradient>
        </View>

        {/* Header */}
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to{'\n'}
          <Text style={styles.email}>{email}</Text>
        </Text>

        {/* Code inputs */}
        <View style={styles.codeContainer}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputRefs.current[index] = ref)}
              style={[
                styles.codeInput,
                digit && styles.codeInputFilled,
                error && styles.codeInputError,
              ]}
              value={digit}
              onChangeText={(text) => handleCodeChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={scale(16)} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Verify button */}
        <TouchableOpacity
          style={[styles.verifyButton, isLoading && styles.verifyButtonDisabled]}
          onPress={() => handleVerify()}
          disabled={isLoading || code.join('').length !== 6}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.verifyButtonText}>Verify Email</Text>
          )}
        </TouchableOpacity>

        {/* Resend */}
        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>Didn't receive the code? </Text>
          {resendCooldown > 0 ? (
            <Text style={styles.resendCooldown}>Resend in {resendCooldown}s</Text>
          ) : (
            <TouchableOpacity onPress={handleResend} disabled={isResending}>
              {isResending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.resendLink}>Resend</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    left: spacing.lg,
    padding: spacing.sm,
  },
  iconContainer: {
    marginTop: scale(40),
    marginBottom: spacing.xl,
  },
  iconGradient: {
    width: scale(80),
    height: scale(80),
    borderRadius: scale(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.display,
    fontSize: scale(28),
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  email: {
    color: colors.primary,
    fontWeight: '600',
  },
  codeContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  codeInput: {
    width: scale(48),
    height: scale(56),
    backgroundColor: colors.card,
    borderRadius: scale(12),
    borderWidth: 2,
    borderColor: colors.borderSubtle,
    color: colors.textPrimary,
    fontSize: scale(24),
    fontWeight: '600',
    textAlign: 'center',
  },
  codeInputFilled: {
    borderColor: colors.primary,
  },
  codeInputError: {
    borderColor: colors.danger,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
  },
  verifyButton: {
    backgroundColor: colors.primary,
    borderRadius: scale(12),
    height: scale(52),
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  verifyButtonDisabled: {
    opacity: 0.7,
  },
  verifyButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.background,
  },
  resendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resendText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  resendLink: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  resendCooldown: {
    ...typography.body,
    color: colors.textMuted,
  },
});

