import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Modal,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  Share,
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import StyleDNACard from '../components/StyleDNACard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { colors } from '../theme/colors';
import { useTheme, useThemeColors } from '../theme/ThemeProvider';
import { spacing } from '../theme/spacing';
import { CustomAlert } from '../components/CustomAlert';
import { updateUser } from '../services/authService';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { scale, verticalScale } from '../utils/responsive';
import { useAuth } from '../context/AuthContext';
import { useUserId } from '../hooks/useUserId';
import { AnalyticsScreen } from './AnalyticsScreen';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';
import { updateNotificationPreference, getNotificationPreference } from '../services/notificationService';
import { apiClient, apiRequest } from '../services/apiClient';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { RootTabParamList } from '../navigation/TabNavigator';

interface StyleDNA {
  primaryStyle: string;
  styleArchetype?: string;
  styleMantra?: string;
  styleInsight?: string;
  capsuleEssentials?: string[];
  secondaryStyles: string[];
  colorPreferences: {
    dominantColors: { color: string; name?: string; percentage: number }[];
    colorPalette: string[];
    seasonalColors: {
      spring: string[];
      summer: string[];
      fall: string[];
      winter: string[];
    };
  };
  brandAffinity: { brand: string; count: number; score: number }[];
  categoryDistribution: Record<string, number>;
  uniquenessScore: number;
  styleConsistency: number;
  trendAlignment: number;
}

interface WardrobeStats {
  totalItems: number;
  savedOutfits: number;
  plannedOutfits: number;
  categories: { name: string; count: number }[];
}

type ProfileScreenNavigationProp = BottomTabNavigationProp<RootTabParamList, 'Profile'>;

export const ProfileScreen: React.FC = () => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { mode: themeMode, isDark, setMode: setThemeMode } = useTheme();
  const { t } = useTranslation();
  const { user, logout, setUser } = useAuth();
  const userId = useUserId();
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const [showStyleDNA, setShowStyleDNA] = useState(false);
  const [showDNAModal, setShowDNAModal] = useState(false);
  const [sharingDNA, setSharingDNA] = useState(false);
  const dnaCardRef = useRef<ViewShot>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showLanguageSwitcher, setShowLanguageSwitcher] = useState(false);
  const [styleDNA, setStyleDNA] = useState<StyleDNA | null>(null);
  const [stats, setStats] = useState<WardrobeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const themeModeLabel = themeMode === 'dark' ? 'Dark' : themeMode === 'light' ? 'Light' : 'Auto';
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message: string;
    buttons: Array<{ text: string; onPress: () => void; style?: 'default' | 'destructive' | 'primary' }>;
    icon?: keyof typeof Ionicons.glyphMap;
  } | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingUsername, setEditingUsername] = useState('');
  const [editingName, setEditingName] = useState('');
  const [profilePictureUri, setProfilePictureUri] = useState<string | null>(null);
  const [profilePictureBase64, setProfilePictureBase64] = useState<string | null>(null);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [logoTapCount, setLogoTapCount] = useState(0);
  const [lastLogoTap, setLastLogoTap] = useState(0);

  useEffect(() => {
    loadData();
  }, [userId]);

  useEffect(() => {
    // Initialize edit form with current user data
    if (user) {
      setEditingName(user.name || '');
      setEditingUsername(user.username || '');
      setProfilePictureUri(user.avatar || null);
    }
  }, [user]);

  const loadData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // Load notification preference from backend
      const notifEnabled = await getNotificationPreference(userId);
      setNotificationsEnabled(notifEnabled);

      // Load Style DNA
      const dnaResponse = await apiClient.get(`/style-dna/${userId}`);
      if (dnaResponse.data?.styleDNA) {
        setStyleDNA(dnaResponse.data.styleDNA);
      }

      // Load wardrobe stats, saved outfits, and planned outfits in parallel
      const [wardrobeResponse, outfitsResponse, plannerResponse] = await Promise.all([
        apiClient.get(`/wardrobe/items?userId=${userId}`),
        apiRequest<{ outfits: any[] }>(`/outfits?userId=${encodeURIComponent(userId)}`).catch(() => ({ outfits: [] })),
        apiRequest<{ plans: any[] }>(`/planner?userId=${encodeURIComponent(userId)}`).catch(() => ({ plans: [] })),
      ]);
      const items = wardrobeResponse.data.items || [];
      
      // Calculate stats
      const categories: Record<string, number> = {};
      items.forEach((item: any) => {
        categories[item.category] = (categories[item.category] || 0) + 1;
      });

      setStats({
        totalItems: items.length,
        savedOutfits: outfitsResponse.outfits?.length || 0,
        plannedOutfits: plannerResponse.plans?.length || 0,
        categories: Object.entries(categories).map(([name, count]) => ({ name, count })),
      });
    } catch (error: any) {
      console.log('Failed to load profile data:', error?.message || error);
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (config: {
    title: string;
    message: string;
    buttons: Array<{ text: string; onPress: () => void; style?: 'default' | 'destructive' | 'primary' }>;
    icon?: keyof typeof Ionicons.glyphMap;
  }) => {
    setAlertConfig(config);
    setAlertVisible(true);
  };

  const handleNotifications = () => {
    showAlert({
      title: t('profile.notifications'),
      message: notificationsEnabled
        ? t('profile.notificationsDisableTitle')
        : t('profile.notificationsEnableTitle'),
      icon: 'notifications-outline',
      buttons: [
        { text: t('common.cancel'), onPress: () => {} },
        {
          text: notificationsEnabled ? t('common.disable') : t('common.enable'),
          onPress: async () => {
            const newValue = !notificationsEnabled;
            setNotificationsEnabled(newValue);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            try {
              await updateNotificationPreference(userId!, newValue);
            } catch (e) {
              // Revert on failure
              setNotificationsEnabled(!newValue);
            }
            showAlert({
              title: t('profile.notifications'),
              message: newValue ? t('profile.notificationsEnabled') : t('profile.notificationsDisabled'),
              icon: newValue ? 'notifications' : 'notifications-off-outline',
              buttons: [{ text: t('profile.gotIt'), onPress: () => {}, style: 'primary' }],
            });
          },
          style: 'primary',
        },
      ],
    });
  };

  const handleThemeToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = themeMode === 'dark' ? 'light' : themeMode === 'light' ? 'system' : 'dark';
    setThemeMode(next);
  };

  const handleHelp = () => {
    showAlert({
      title: t('profile.helpTitle'),
      message: t('profile.helpMessage'),
      icon: 'help-circle',
      buttons: [
        {
          text: t('common.ok'),
          onPress: () => {},
        },
        {
          text: t('common.emailSupport'),
          onPress: () => {
            Linking.openURL('mailto:support@fashionfit.app?subject=Fashion Fit Support');
          },
          style: 'primary',
        },
      ],
    });
  };

  const handlePrivacy = () => {
    showAlert({
      title: t('profile.privacyTitle'),
      message: t('profile.privacyMessage'),
      icon: 'lock-closed',
      buttons: [
        {
          text: t('common.ok'),
          onPress: () => {},
        },
        {
          text: t('profile.emailPrivacy'),
          onPress: () => {
            Linking.openURL('mailto:privacy@fashionfit.app?subject=Privacy Question');
          },
          style: 'primary',
        },
      ],
    });
  };

  const handleTerms = () => {
    showAlert({
      title: t('profile.termsTitle'),
      message: t('profile.termsMessage'),
      icon: 'shield-checkmark',
      buttons: [
        {
          text: t('common.ok'),
          onPress: () => {},
        },
        {
          text: t('profile.emailLegal'),
          onPress: () => {
            Linking.openURL('mailto:legal@fashionfit.app?subject=Terms Question');
          },
          style: 'primary',
        },
      ],
    });
  };

  const handleLogout = () => {
    showAlert({
      title: t('profile.logout'),
      message: t('profile.logoutConfirm'),
      icon: 'log-out-outline',
      buttons: [
        {
          text: t('common.cancel'),
          onPress: () => {},
        },
        {
          text: t('common.logOut'),
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            await logout();
          },
          style: 'destructive',
        },
      ],
    });
  };

  const toggleStyleDNA = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowDNAModal(true);
  };

  const handleShareDNA = async () => {
    if (!dnaCardRef.current || sharingDNA) return;
    try {
      setSharingDNA(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const uri = await (dnaCardRef.current as any).capture();
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your Style DNA' });
      } else {
        await Share.share({ message: `My Style DNA: ${styleDNA?.styleArchetype || styleDNA?.primaryStyle} — ${styleDNA?.styleMantra || ''}` });
      }
    } catch (e) {
      console.error('Share error', e);
    } finally {
      setSharingDNA(false);
    }
  };

  const toggleAnalytics = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowAnalytics(!showAnalytics);
  };

  const [showFullAnalytics, setShowFullAnalytics] = useState(false);

  const handlePickProfilePicture = async () => {
    // Close modal first to free up memory
    setEditModalVisible(false);
    
    // Wait for modal to fully close
    await new Promise(resolve => setTimeout(resolve, 300));
    
    try {
      // Request media library permissions first
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setEditModalVisible(true);
        showAlert({
          title: 'Permission Required',
          message: 'Media library permission is required to select a profile picture.',
          icon: 'image-outline',
          buttons: [{ text: 'OK', onPress: () => {} }],
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.1, // Very low quality to minimize memory
        base64: true, // Get base64 immediately to upload right away
        exif: false,
        allowsMultipleSelection: false,
      });

      // Wait for picker to fully close
      await new Promise(resolve => setTimeout(resolve, 300));

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        
        if (asset.base64) {
          // Upload immediately without storing in state
          setUpdatingProfile(true);
          try {
            const updatedUser = await updateUser({
              profilePictureBase64: asset.base64,
            });
            
            setUser(updatedUser);
            setProfilePictureUri(updatedUser.avatar || null);
            setProfilePictureBase64(null);
            
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showAlert({
              title: 'Success',
              message: 'Profile picture updated!',
              icon: 'checkmark-circle',
              buttons: [{ text: 'OK', onPress: () => {}, style: 'primary' }],
            });
          } catch (uploadError: any) {
            console.log('Failed to upload profile picture:', uploadError);
            showAlert({
              title: 'Error',
              message: uploadError?.data?.error || uploadError?.message || 'Failed to upload profile picture.',
              icon: 'alert-circle',
              buttons: [{ text: 'OK', onPress: () => {} }],
            });
          } finally {
            setUpdatingProfile(false);
            setEditModalVisible(true);
          }
        } else {
          // No base64 - reopen modal
          setEditModalVisible(true);
        }
      } else {
        // User canceled - reopen modal
        setEditModalVisible(true);
      }
    } catch (error: any) {
      console.log('Failed to pick image:', error);
      setEditModalVisible(true);
      if (error?.code !== 'E_PICKER_CANCELLED') {
        showAlert({
          title: 'Error',
          message: 'Failed to pick image. Please try again.',
          icon: 'alert-circle',
          buttons: [{ text: 'OK', onPress: () => {} }],
        });
      }
    }
  };

  const handleTakeProfilePicture = async () => {
    // Close modal first to free up memory
    setEditModalVisible(false);
    
    // Wait for modal to fully close
    await new Promise(resolve => setTimeout(resolve, 300));
    
    try {
      // Request camera permissions first
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        setEditModalVisible(true);
        showAlert({
          title: 'Camera Permission',
          message: 'Camera permission is required to take a profile picture.',
          icon: 'camera-outline',
          buttons: [{ text: 'OK', onPress: () => {} }],
        });
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.1, // Very low quality to minimize memory
        base64: true, // Get base64 immediately to upload right away
        exif: false,
        allowsMultipleSelection: false,
      });

      // Wait for camera to fully close
      await new Promise(resolve => setTimeout(resolve, 500));

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        
        if (asset.base64) {
          // Upload immediately without storing in state
          setUpdatingProfile(true);
          try {
            const updatedUser = await updateUser({
              profilePictureBase64: asset.base64,
            });
            
            setUser(updatedUser);
            setProfilePictureUri(updatedUser.avatar || null);
            setProfilePictureBase64(null);
            
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showAlert({
              title: 'Success',
              message: 'Profile picture updated!',
              icon: 'checkmark-circle',
              buttons: [{ text: 'OK', onPress: () => {}, style: 'primary' }],
            });
          } catch (uploadError: any) {
            console.log('Failed to upload profile picture:', uploadError);
            showAlert({
              title: 'Error',
              message: uploadError?.data?.error || uploadError?.message || 'Failed to upload profile picture.',
              icon: 'alert-circle',
              buttons: [{ text: 'OK', onPress: () => {} }],
            });
          } finally {
            setUpdatingProfile(false);
            setEditModalVisible(true);
          }
        } else {
          // No base64 - reopen modal
          setEditModalVisible(true);
        }
      } else {
        // User canceled - reopen modal
        setEditModalVisible(true);
      }
    } catch (error: any) {
      console.log('Failed to take picture:', error);
      setEditModalVisible(true);
      if (error?.code !== 'E_PICKER_CANCELLED') {
        showAlert({
          title: 'Error',
          message: 'Failed to take picture. Please try again.',
          icon: 'alert-circle',
          buttons: [{ text: 'OK', onPress: () => {} }],
        });
      }
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    setUpdatingProfile(true);
    try {
      const updateData: any = {
        name: editingName.trim(),
      };

      if (editingUsername.trim()) {
        // Validate username format
        const usernameRegex = /^[a-z0-9_]+$/;
        if (!usernameRegex.test(editingUsername.trim().toLowerCase())) {
          showAlert({
            title: 'Invalid Username',
            message: 'Username can only contain lowercase letters, numbers, and underscores.',
            icon: 'alert-circle',
            buttons: [{ text: 'OK', onPress: () => {} }],
          });
          setUpdatingProfile(false);
          return;
        }
        if (editingUsername.trim().length < 3 || editingUsername.trim().length > 30) {
          showAlert({
            title: 'Invalid Username',
            message: 'Username must be between 3 and 30 characters.',
            icon: 'alert-circle',
            buttons: [{ text: 'OK', onPress: () => {} }],
          });
          setUpdatingProfile(false);
          return;
        }
        updateData.username = editingUsername.trim().toLowerCase();
      } else {
        updateData.username = ''; // Clear username
      }

      // Only convert to base64 if it's a local file (not a remote URL)
      // Remote URLs (Cloudinary) are already uploaded, so we don't need to process them
      if (profilePictureUri && !profilePictureBase64) {
        // Check if it's a local file (starts with file:// or doesn't start with http)
        const isLocalFile = profilePictureUri.startsWith('file://') || 
                           profilePictureUri.startsWith('content://') ||
                           (!profilePictureUri.startsWith('http://') && !profilePictureUri.startsWith('https://'));
        
        if (isLocalFile) {
          try {
            // Check if file exists before reading
            const fileInfo = await FileSystem.getInfoAsync(profilePictureUri);
            if (!fileInfo.exists) {
              throw new Error('Image file not found');
            }

            // Read the image file and convert to base64
            const base64 = await FileSystem.readAsStringAsync(profilePictureUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            
            // Validate base64 is not too large (max ~2MB)
            if (base64.length > 3000000) {
              throw new Error('Image is too large. Please choose a smaller image.');
            }
            
            updateData.profilePictureBase64 = base64;
          } catch (convertError: any) {
            console.log('Failed to convert image to base64:', convertError);
            showAlert({
              title: 'Error',
              message: convertError?.message || 'Failed to process image. Please try again with a smaller image.',
              icon: 'alert-circle',
              buttons: [{ text: 'OK', onPress: () => {} }],
            });
            setUpdatingProfile(false);
            return;
          }
        }
        // If it's a remote URL, it's already uploaded, so we don't need to do anything
      } else if (profilePictureBase64) {
        // Use existing base64 if available
        updateData.profilePictureBase64 = profilePictureBase64;
      }

      const updatedUser = await updateUser(updateData);
      
      // Update user in context
      setUser(updatedUser);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditModalVisible(false);
      showAlert({
        title: 'Success',
        message: 'Profile updated successfully!',
        icon: 'checkmark-circle',
        buttons: [{ text: 'OK', onPress: () => {}, style: 'primary' }],
      });
    } catch (error: any) {
      console.log('Failed to update profile:', error);
      const errorMessage = error?.data?.error || error?.message || 'Failed to update profile';
      showAlert({
        title: 'Error',
        message: errorMessage,
        icon: 'alert-circle',
        buttons: [{ text: 'OK', onPress: () => {} }],
      });
    } finally {
      setUpdatingProfile(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.editButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setEditModalVisible(true);
            }}
          >
            <Ionicons name="create-outline" size={scale(20)} color={colors.textPrimary} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setEditModalVisible(true);
            }}
            activeOpacity={0.8}
          >
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.profileAvatar} />
            ) : (
              <LinearGradient
                colors={[colors.primary, colors.secondary]}
                style={styles.avatarGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="person" size={scale(40)} color="#fff" />
              </LinearGradient>
            )}
          </TouchableOpacity>
          <Text style={styles.name}>{user?.name || 'Style Explorer'}</Text>
          {user?.username && (
            <Text style={styles.username}>@{user.username}</Text>
          )}
          <Text style={styles.email}>{user?.email}</Text>
          <TouchableOpacity
            style={styles.memberBadge}
            onPress={() => {
              const now = Date.now();
              // Reset if more than 2 seconds passed
              if (now - lastLogoTap > 2000) {
                setLogoTapCount(1);
              } else {
                setLogoTapCount(prev => prev + 1);
              }
              setLastLogoTap(now);
              
              // Secret: Tap 7 times to open admin dashboard
              if (logoTapCount + 1 >= 7) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                navigation.navigate('AdminDashboard');
                setLogoTapCount(0);
              } else {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="sparkles" size={scale(14)} color={colors.accent} />
            <Text style={styles.memberText}>Fashion Fit Member</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Stats */}
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loadingIndicator} />
        ) : (
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats?.totalItems || 0}</Text>
              <Text style={styles.statLabel}>Items</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats?.savedOutfits || 0}</Text>
              <Text style={styles.statLabel}>Outfits</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats?.categories?.length || 0}</Text>
              <Text style={styles.statLabel}>Categories</Text>
            </View>
          </View>
        )}

        {/* Style DNA Card */}
        <TouchableOpacity style={styles.featureCard} onPress={toggleStyleDNA} activeOpacity={0.8}>
          <LinearGradient
            colors={[colors.primarySoft, 'transparent']}
            style={styles.featureGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.featureHeader}>
              <View style={styles.featureIconContainer}>
                <Ionicons name="finger-print" size={24} color={colors.primary} />
              </View>
              <View style={styles.featureInfo}>
                <Text style={styles.featureTitle}>Style DNA</Text>
                <Text style={styles.featureSubtitle}>
                  {styleDNA?.styleArchetype || 'Your personalized style profile'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </View>
            {styleDNA?.colorPreferences?.colorPalette && styleDNA.colorPreferences.colorPalette.length > 0 && (
              <View style={styles.colorPalette}>
                {styleDNA.colorPreferences.colorPalette.slice(0, 6).map((color, i) => (
                  <View key={i} style={[styles.colorDot, { backgroundColor: color }]} />
                ))}
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Style DNA Modal */}
        <Modal
          visible={showDNAModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowDNAModal(false)}
        >
          <View style={styles.dnaModalContainer}>
            {/* Modal Header */}
            <View style={styles.dnaModalHeader}>
              <TouchableOpacity onPress={() => setShowDNAModal(false)} style={styles.dnaModalClose}>
                <Ionicons name="close" size={scale(22)} color={colors.textSecondary} />
              </TouchableOpacity>
              <Text style={styles.dnaModalTitle}>Style DNA</Text>
              {styleDNA && (
                <TouchableOpacity onPress={handleShareDNA} style={styles.dnaShareBtn} disabled={sharingDNA}>
                  {sharingDNA
                    ? <ActivityIndicator size="small" color={colors.primary} />
                    : <Ionicons name="share-outline" size={scale(22)} color={colors.primary} />
                  }
                </TouchableOpacity>
              )}
            </View>

            <ScrollView
              contentContainerStyle={styles.dnaModalScroll}
              showsVerticalScrollIndicator={false}
            >
              {styleDNA ? (
                <ViewShot ref={dnaCardRef} options={{ format: 'png', quality: 1 }}>
                  <StyleDNACard dna={styleDNA} username={user?.username} />
                </ViewShot>
              ) : (
                <View style={styles.dnaEmptyState}>
                  <Ionicons name="finger-print-outline" size={scale(48)} color={colors.textMuted} />
                  <Text style={styles.noDataText}>Add items to your wardrobe to unlock your Style DNA</Text>
                </View>
              )}

              {/* Share CTA below the card */}
              {styleDNA && (
                <TouchableOpacity
                  style={[styles.dnaShareCta, { backgroundColor: colors.primary }]}
                  onPress={handleShareDNA}
                  disabled={sharingDNA}
                  activeOpacity={0.85}
                >
                  {sharingDNA
                    ? <ActivityIndicator size="small" color={colors.textOnPrimary} />
                    : <>
                        <Ionicons name="share-social-outline" size={scale(18)} color={colors.textOnPrimary} />
                        <Text style={[styles.dnaShareCtaText, { color: colors.textOnPrimary }]}>Share My Style DNA</Text>
                      </>
                  }
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </Modal>

        {/* Analytics Card */}
        <TouchableOpacity style={styles.featureCard} onPress={toggleAnalytics} activeOpacity={0.8}>
          <LinearGradient
            colors={['rgba(232,213,183,0.15)', 'transparent']}
            style={styles.featureGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.featureHeader}>
              <View style={[styles.featureIconContainer, { backgroundColor: 'rgba(232,213,183,0.15)' }]}>
                <Ionicons name="analytics" size={24} color={colors.secondary} />
              </View>
              <View style={styles.featureInfo}>
                <Text style={styles.featureTitle}>Style Analytics</Text>
                <Text style={styles.featureSubtitle}>Insights about your wardrobe</Text>
              </View>
              <Ionicons name={showAnalytics ? "chevron-down" : "chevron-forward"} size={20} color={colors.textMuted} />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Analytics Expanded */}
        {showAnalytics && (
          <View style={styles.expandedCard}>
            {stats ? (
              <>
                <Text style={styles.expandedTitle}>Wardrobe Overview</Text>
                <View style={styles.analyticsGrid}>
                  <View style={styles.analyticsItem}>
                    <Ionicons name="shirt" size={28} color={colors.primary} />
                    <Text style={styles.analyticsNumber}>{stats.totalItems}</Text>
                    <Text style={styles.analyticsLabel}>Total Items</Text>
                  </View>
                  <View style={styles.analyticsItem}>
                    <Ionicons name="heart" size={28} color={colors.primary} />
                    <Text style={styles.analyticsNumber}>{stats.savedOutfits}</Text>
                    <Text style={styles.analyticsLabel}>Saved Outfits</Text>
                  </View>
                  <View style={styles.analyticsItem}>
                    <Ionicons name="calendar" size={28} color={colors.secondary} />
                    <Text style={styles.analyticsNumber}>{stats.plannedOutfits}</Text>
                    <Text style={styles.analyticsLabel}>Planned</Text>
                  </View>
                </View>

                {stats.categories?.length > 0 && (
                  <>
                    <Text style={styles.expandedTitle}>Categories</Text>
                    {stats.categories.map((cat, i) => (
                      <View key={i} style={styles.categoryItem}>
                        <Text style={styles.categoryName}>{cat.name}</Text>
                        <Text style={styles.categoryCount}>{cat.count} items</Text>
                      </View>
                    ))}
                  </>
                )}

                <TouchableOpacity
                  style={styles.viewFullAnalyticsBtn}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowFullAnalytics(true); }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="bar-chart" size={scale(16)} color={colors.textOnPrimary} />
                  <Text style={styles.viewFullAnalyticsBtnText}>View Full Analytics</Text>
                  <Ionicons name="arrow-forward" size={scale(16)} color={colors.textOnPrimary} />
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.noDataText}>Add items to your wardrobe to see analytics</Text>
            )}
          </View>
        )}

        {/* Settings Section */}
        <Text style={styles.sectionTitle}>{t('profile.settings')}</Text>

        <TouchableOpacity activeOpacity={0.75} style={styles.menuItem} onPress={handleNotifications}>
          <View style={styles.menuIcon}>
            <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
          </View>
          <Text style={styles.menuText}>{t('profile.notifications')}</Text>
          <View style={[styles.toggleOn, !notificationsEnabled && styles.toggleOff]}>
            <Text style={styles.toggleText}>{notificationsEnabled ? t('common.yes') : t('common.no')}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.75} style={styles.menuItem} onPress={handleThemeToggle}>
          <View style={styles.menuIcon}>
            <Ionicons name={isDark ? 'moon-outline' : themeMode === 'system' ? 'phone-portrait-outline' : 'sunny-outline'} size={20} color={colors.textSecondary} />
          </View>
          <Text style={styles.menuText}>{t('profile.darkMode')}</Text>
          <View style={[styles.toggleOn, !isDark && { backgroundColor: colors.secondary }]}>
            <Text style={styles.toggleText}>{themeModeLabel}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.75} style={styles.menuItem} onPress={() => setShowLanguageSwitcher(true)}>
          <View style={styles.menuIcon}>
            <Ionicons name="language-outline" size={20} color={colors.textSecondary} />
          </View>
          <Text style={styles.menuText}>{t('profile.changeLanguage')}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Support Section */}
        <Text style={styles.sectionTitle}>{t('profile.about')}</Text>

        <TouchableOpacity activeOpacity={0.75} style={styles.menuItem} onPress={handleHelp}>
          <View style={styles.menuIcon}>
            <Ionicons name="help-circle-outline" size={20} color={colors.textSecondary} />
          </View>
          <Text style={styles.menuText}>{t('profile.help')}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.75} style={styles.menuItem} onPress={handlePrivacy}>
          <View style={styles.menuIcon}>
            <Ionicons name="document-text-outline" size={20} color={colors.textSecondary} />
          </View>
          <Text style={styles.menuText}>{t('profile.privacy')}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.75} style={styles.menuItem} onPress={handleTerms}>
          <View style={styles.menuIcon}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.textSecondary} />
          </View>
          <Text style={styles.menuText}>{t('profile.terms')}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Analytics */}
        <TouchableOpacity activeOpacity={0.75} style={[styles.menuItem, { marginTop: spacing.lg }]} onPress={() => setShowFullAnalytics(true)}>
          <View style={[styles.menuIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="diamond-outline" size={20} color={colors.primary} />
          </View>
          <Text style={[styles.menuText, { color: colors.primary, fontWeight: '700' }]}>{t('profile.analytics')}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity activeOpacity={0.75} style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={colors.primary} />
          <Text style={styles.logoutText}>{t('profile.logout')}</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.version}>Fashion Fit v2.0.0</Text>
      </ScrollView>

      {/* Language Switcher Modal */}
      <LanguageSwitcher
        visible={showLanguageSwitcher}
        onClose={() => setShowLanguageSwitcher(false)}
      />

      {/* Full Analytics Modal */}
      <Modal visible={showFullAnalytics} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.analyticsModalClose}
            onPress={() => setShowFullAnalytics(false)}
          >
            <Ionicons name="close" size={scale(28)} color={colors.textPrimary} />
          </TouchableOpacity>
          <AnalyticsScreen />
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <LinearGradient colors={[...colors.gradientCard]} style={styles.modalGradient}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Profile</Text>
                <TouchableOpacity
                  onPress={() => setEditModalVisible(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={scale(28)} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {/* Profile Picture Section */}
              <View style={styles.profilePictureSection}>
                <TouchableOpacity
                  onPress={handlePickProfilePicture}
                  style={styles.profilePictureContainer}
                >
                  {profilePictureUri ? (
                    <Image 
                      source={{ uri: profilePictureUri }} 
                      style={styles.profilePicturePreview}
                      resizeMode="cover"
                      cache="force-cache"
                    />
                  ) : (
                    <LinearGradient
                      colors={[colors.primary, colors.secondary]}
                      style={styles.profilePicturePlaceholder}
                    >
                      <Ionicons name="person" size={scale(50)} color="#fff" />
                    </LinearGradient>
                  )}
                  <View style={styles.profilePictureEditBadge}>
                    <Ionicons name="camera" size={scale(16)} color="#fff" />
                  </View>
                </TouchableOpacity>
                <View style={styles.profilePictureButtons}>
                  <TouchableOpacity
                    style={styles.pictureButton}
                    onPress={handlePickProfilePicture}
                  >
                    <Ionicons name="image-outline" size={scale(18)} color={colors.textPrimary} />
                    <Text style={styles.pictureButtonText}>Choose from Gallery</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Name Input */}
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  value={editingName}
                  onChangeText={setEditingName}
                  placeholder="Enter your name"
                  placeholderTextColor={colors.textMuted}
                  maxLength={50}
                />
              </View>

              {/* Username Input */}
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Username (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={editingUsername}
                  onChangeText={(text) => {
                    // Only allow lowercase letters, numbers, and underscores
                    const filtered = text.replace(/[^a-z0-9_]/gi, '').toLowerCase();
                    setEditingUsername(filtered);
                  }}
                  placeholder="username"
                  placeholderTextColor={colors.textMuted}
                  maxLength={30}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={styles.inputHint}>
                  Only lowercase letters, numbers, and underscores. 3-30 characters.
                </Text>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={[styles.saveButton, updatingProfile && styles.saveButtonDisabled]}
                onPress={handleSaveProfile}
                disabled={updatingProfile}
              >
                {updatingProfile ? (
                  <LoadingSpinner size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={scale(20)} color="#fff" />
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </LinearGradient>
        </KeyboardAvoidingView>
      </Modal>

      {/* Custom Alert */}
      {alertConfig && (
        <CustomAlert
          visible={alertVisible}
          title={alertConfig.title}
          message={alertConfig.message}
          buttons={alertConfig.buttons}
          icon={alertConfig.icon}
          onClose={() => setAlertVisible(false)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background,
  },
  loadingIndicator: {
    marginVertical: verticalScale(20),
  },
  scroll: { 
    padding: spacing.lg, 
    paddingBottom: verticalScale(120),
  },
  header: { 
    alignItems: 'center', 
    marginBottom: spacing.xl,
    paddingTop: spacing.lg,
  },
  avatarGradient: {
    width: scale(90),
    height: scale(90),
    borderRadius: scale(45),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  name: { 
    fontSize: scale(22),
    fontWeight: '700',
    color: colors.textPrimary,
  },
  email: { 
    fontSize: scale(14),
    color: colors.textMuted, 
    marginTop: verticalScale(4),
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: scale(20),
    marginTop: spacing.sm,
  },
  memberText: {
    fontSize: scale(12),
    color: colors.accent,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: scale(16),
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: scale(1),
    borderColor: colors.borderSubtle,
  },
  statNumber: {
    fontSize: scale(24),
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: scale(12),
    color: colors.textMuted,
    marginTop: verticalScale(4),
  },
  featureCard: {
    marginBottom: spacing.md,
    borderRadius: scale(16),
    overflow: 'hidden',
  },
  featureGradient: {
    padding: spacing.lg,
    borderRadius: scale(16),
    borderWidth: scale(1),
    borderColor: colors.borderSubtle,
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIconContainer: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(12),
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  featureTitle: {
    fontSize: scale(16),
    fontWeight: '600',
    color: colors.textPrimary,
  },
  featureSubtitle: {
    fontSize: scale(13),
    color: colors.textMuted,
    marginTop: verticalScale(2),
  },
  colorPalette: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  colorDot: {
    width: scale(24),
    height: scale(24),
    borderRadius: scale(12),
    borderWidth: scale(2),
    borderColor: colors.borderMedium,
  },
  sectionTitle: {
    fontSize: scale(12),
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: scale(1),
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: scale(12),
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: scale(1),
    borderColor: colors.borderSubtle,
  },
  menuIcon: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(10),
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: {
    flex: 1,
    fontSize: scale(15),
    color: colors.textPrimary,
    marginLeft: spacing.md,
  },
  toggleOn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: verticalScale(4),
    borderRadius: scale(10),
  },
  toggleOff: {
    backgroundColor: colors.textMuted,
  },
  toggleText: {
    fontSize: scale(11),
    color: colors.textOnPrimary,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  planBadge: {
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(3),
    borderRadius: scale(8),
    marginRight: scale(4),
  },
  planBadgeText: {
    fontSize: scale(11),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: scale(12),
    padding: spacing.md,
    marginTop: spacing.xl,
    borderWidth: scale(1),
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  logoutText: {
    fontSize: scale(14),
    fontWeight: '600',
    color: colors.danger,
    letterSpacing: 0.3,
  },
  version: {
    fontSize: scale(12),
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  expandedCard: {
    backgroundColor: colors.card,
    borderRadius: scale(16),
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: scale(1),
    borderColor: colors.borderSubtle,
  },
  expandedTitle: {
    fontSize: scale(14),
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  colorPaletteExpanded: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  colorItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  colorDotLarge: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    borderWidth: scale(2),
    borderColor: colors.borderSubtle,
  },
  colorName: {
    fontSize: scale(11),
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tag: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: scale(20),
  },
  tagText: {
    fontSize: scale(12),
    color: colors.primary,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  balanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  balanceCategory: {
    fontSize: scale(12),
    color: colors.textSecondary,
    width: scale(80),
    textTransform: 'capitalize',
  },
  balanceBar: {
    flex: 1,
    height: verticalScale(8),
    backgroundColor: colors.primarySoft,
    borderRadius: scale(4),
    marginHorizontal: spacing.sm,
  },
  balanceFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: scale(4),
  },
  balancePercent: {
    fontSize: scale(12),
    color: colors.textMuted,
    width: scale(40),
    textAlign: 'right',
  },
  analyticsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.lg,
  },
  analyticsItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  analyticsNumber: {
    fontSize: scale(24),
    fontWeight: '700',
    color: colors.textPrimary,
  },
  analyticsLabel: {
    fontSize: scale(12),
    color: colors.textMuted,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: scale(1),
    borderBottomColor: colors.borderSubtle,
  },
  categoryName: {
    fontSize: scale(14),
    color: colors.textPrimary,
    textTransform: 'capitalize',
  },
  categoryCount: {
    fontSize: scale(13),
    color: colors.textSecondary,
  },
  noDataText: {
    fontSize: scale(14),
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  primaryStyleContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderBottomWidth: scale(1),
    borderBottomColor: colors.borderSubtle,
    marginBottom: spacing.md,
  },
  primaryStyleLabel: {
    fontSize: scale(11),
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: scale(1),
  },
  primaryStyleValue: {
    fontSize: scale(28),
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'capitalize',
    marginTop: spacing.xs,
  },
  scoresRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
    borderBottomWidth: scale(1),
    borderBottomColor: colors.borderSubtle,
  },
  scoreItem: {
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: scale(20),
    fontWeight: '700',
    color: colors.textPrimary,
  },
  scoreLabel: {
    fontSize: scale(11),
    color: colors.textMuted,
    marginTop: verticalScale(2),
  },
  colorPercent: {
    fontSize: scale(10),
    color: colors.textMuted,
  },
  brandsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  brandTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(232,213,183,0.15)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: scale(20),
    gap: spacing.xs,
  },
  brandText: {
    fontSize: scale(12),
    color: colors.secondary,
    fontWeight: '600',
  },
  brandCount: {
    fontSize: scale(10),
    color: colors.textMuted,
  },
  seasonalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  seasonItem: {
    alignItems: 'center',
    flex: 1,
  },
  seasonName: {
    fontSize: scale(11),
    color: colors.textSecondary,
    textTransform: 'capitalize',
    marginBottom: spacing.xs,
  },
  seasonColors: {
    flexDirection: 'row',
    gap: scale(4),
  },
  seasonColorDot: {
    width: scale(16),
    height: scale(16),
    borderRadius: scale(8),
    borderWidth: scale(1),
    borderColor: colors.borderMedium,
  },
  // Style DNA Modal Styles
  dnaModalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  dnaModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: scale(1),
    borderBottomColor: colors.borderSubtle,
  },
  dnaModalTitle: {
    fontSize: scale(16),
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: scale(0.5),
  },
  dnaModalClose: {
    padding: spacing.xs,
    width: scale(36),
  },
  dnaShareBtn: {
    padding: spacing.xs,
    width: scale(36),
    alignItems: 'flex-end',
  },
  dnaModalScroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  dnaEmptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
    gap: spacing.md,
  },
  dnaShareCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: verticalScale(14),
    borderRadius: scale(14),
    marginTop: spacing.md,
  },
  dnaShareCtaText: {
    fontSize: scale(15),
    fontWeight: '700',
    letterSpacing: scale(0.3),
  },
  // Edit Profile Modal Styles
  editButton: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    padding: spacing.sm,
    backgroundColor: colors.cardSoft,
    borderRadius: scale(20),
    borderWidth: scale(1),
    borderColor: colors.borderSubtle,
  },
  profileAvatar: {
    width: scale(90),
    height: scale(90),
    borderRadius: scale(45),
    borderWidth: scale(3),
    borderColor: colors.primary,
  },
  username: {
    fontSize: scale(16),
    color: colors.primary,
    fontWeight: '600',
    marginTop: verticalScale(4),
  },
  modalContainer: {
    flex: 1,
  },
  modalGradient: {
    flex: 1,
  },
  modalContent: {
    padding: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingTop: Platform.OS === 'ios' ? spacing['3xl'] : spacing.lg,
  },
  modalTitle: {
    fontSize: scale(24),
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  profilePictureSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  profilePictureContainer: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  profilePicturePreview: {
    width: scale(120),
    height: scale(120),
    borderRadius: scale(60),
    borderWidth: scale(3),
    borderColor: colors.primary,
  },
  profilePicturePlaceholder: {
    width: scale(120),
    height: scale(120),
    borderRadius: scale(60),
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePictureEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: scale(3),
    borderColor: colors.background,
  },
  profilePictureButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  pictureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.cardSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: scale(20),
    borderWidth: scale(1),
    borderColor: colors.borderSubtle,
  },
  pictureButtonText: {
    fontSize: scale(14),
    color: colors.textPrimary,
    fontWeight: '500',
  },
  inputSection: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: scale(14),
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.cardSoft,
    borderRadius: scale(12),
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: scale(16),
    color: colors.textPrimary,
    borderWidth: scale(1),
    borderColor: colors.borderSubtle,
  },
  inputHint: {
    fontSize: scale(12),
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: scale(12),
    marginTop: spacing.xl,
    minHeight: scale(50),
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: scale(14),
    fontWeight: '600',
    color: colors.textOnPrimary,
    letterSpacing: 0.5,
  },
  viewFullAnalyticsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: scale(12),
    marginTop: spacing.lg,
  },
  viewFullAnalyticsBtnText: {
    fontSize: scale(13),
    fontWeight: '600',
    color: colors.textOnPrimary,
    letterSpacing: 0.3,
  },
  analyticsModalClose: {
    position: 'absolute',
    top: verticalScale(16),
    right: spacing.lg,
    zIndex: 10,
    padding: spacing.sm,
    backgroundColor: colors.cardSoft,
    borderRadius: scale(20),
    borderWidth: scale(1),
    borderColor: colors.borderSubtle,
  },
});

export default ProfileScreen;
