import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';
import { useThemeColors } from '../theme/ThemeProvider';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { scale, verticalScale } from '../utils/responsive';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/apiClient';
import { VerifyScreen } from './VerifyScreen';
import { useTranslation } from 'react-i18next';

type Mode = 'login' | 'signup';

export const AuthScreen: React.FC = () => {
  const colors = useThemeColors();
  const { login, setUser } = useAuth();
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showVerification, setShowVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async () => {
    setError('');

    // Validation
    if (mode === 'signup' && !name.trim()) {
      setError('Please enter your name');
      return;
    }

    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email');
      return;
    }

    if (!password) {
      setError('Please enter your password');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'login') {
        try {
          await login(email.trim(), password);
        } catch (err: any) {
          // Check if needs verification
          if (err.message?.includes('verify') || err.status === 403) {
            setVerificationEmail(email.trim());
            setShowVerification(true);
            return;
          }
          throw err;
        }
      } else {
        // Sign up - always requires verification now
        const response = await apiRequest<any>('/auth/signup', {
          method: 'POST',
          body: JSON.stringify({ email: email.trim(), password, name: name.trim() }),
        });

        if (response.requiresVerification) {
          setVerificationEmail(response.email);
          setShowVerification(true);
          return;
        }
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerified = async (user: any, token: string) => {
    // Save token and user
    await AsyncStorage.setItem('auth_token', token);
    await AsyncStorage.setItem('auth_user', JSON.stringify(user));
    setUser(user);
  };

  if (showVerification) {
    return (
      <VerifyScreen
        email={verificationEmail}
        onVerified={handleVerified}
        onBack={() => setShowVerification(false)}
      />
    );
  }

  const toggleMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[...colors.gradient]}
        style={StyleSheet.absoluteFillObject}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              style={styles.logoGradient}
            >
              <Ionicons name="sparkles" size={32} color="#fff" />
            </LinearGradient>
            <Text style={styles.logoText}>Fashion Fit</Text>
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {mode === 'login' ? t('auth.welcome') : t('auth.createAccount')}
            </Text>
            <Text style={styles.subtitle}>
              {mode === 'login' ? t('auth.tagline') : t('onboarding.letsGetStarted')}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {mode === 'signup' && (
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('auth.fullName')}
                  placeholderTextColor={colors.textMuted}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            )}

            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('auth.email')}
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('auth.password')}
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity activeOpacity={0.7} onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>

            {mode === 'signup' && (
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('auth.confirmPassword')}
                  placeholderTextColor={colors.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
              </View>
            )}

            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.submitButtonText}>
                  {mode === 'login' ? t('auth.signIn') : t('auth.createAccount')}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Toggle Mode */}
          <View style={styles.toggleContainer}>
            <Text style={styles.toggleText}>
              {mode === 'login' ? t('auth.noAccount') : t('auth.hasAccount')}
            </Text>
            <TouchableOpacity activeOpacity={0.7} onPress={toggleMode}>
              <Text style={styles.toggleLink}>
                {mode === 'login' ? t('auth.signup') : t('auth.signIn')}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: verticalScale(80),
    paddingBottom: verticalScale(40),
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoGradient: {
    width: scale(70),
    height: scale(70),
    borderRadius: scale(35),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logoText: {
    ...typography.display,
    fontSize: scale(28),
    color: colors.textPrimary,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.display,
    fontSize: scale(32),
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  form: {
    gap: spacing.md,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    height: scale(52),
    color: colors.textPrimary,
    ...typography.body,
  },
  eyeIcon: {
    padding: spacing.xs,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: scale(12),
    height: scale(52),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.background,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xl,
  },
  toggleText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  toggleLink: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
});

