import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
  Alert,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { apiClient } from '../services/apiClient';
import { useUserId } from '../hooks/useUserId';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { scale } from '../utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CameraScreenProps {
  onClose: () => void;
  onSave: () => void;
}

export default function CameraScreen({ onClose, onSave }: CameraScreenProps) {
  const userId = useUserId();
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedBase64, setCapturedBase64] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();

  const takePicture = async () => {
    if (!cameraRef.current) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.8,
      });

      if (photo) {
        setCapturedImage(photo.uri);
        setCapturedBase64(photo.base64 || null);
        analyzeImage(photo.base64!);
      }
    } catch (error) {
      console.error('Failed to take picture:', error);
      Alert.alert('Error', 'Failed to take picture');
    }
  };

  const analyzeImage = async (base64: string) => {
    setIsAnalyzing(true);
    try {
      // Use the correct endpoint: /ai/categorize-image
      const response = await apiClient.post('/ai/categorize-image', {
        imageBase64: base64,
      });

      setAnalysis(response.data);
    } catch (error: any) {
      console.error('Analysis failed:', error);
      
      // Check if item was rejected (not clothing)
      if (error?.status === 400 && error?.data?.error === 'INVALID_ITEM') {
        Alert.alert(
          '⚠️ Invalid Item',
          error.data.message || 'Only clothing items and fashion accessories can be added to your wardrobe.\n\nPlease take a photo of the item itself, not a person wearing it.',
          [
            {
              text: 'Retake Photo',
              onPress: retakePicture,
            },
          ]
        );
      } else {
        Alert.alert('Analysis Error', error.message || 'Please try again');
        retakePicture();
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveToWardrobe = async () => {
    if (!analysis || !capturedBase64 || !userId) return;

    setIsSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      // Upload image to Cloudinary using /upload/image-base64
      const uploadResponse = await apiClient.post('/upload/image-base64', {
        imageBase64: capturedBase64,
      });

      const imageData = uploadResponse.data.image;

      // Save to wardrobe using /wardrobe/items
      await apiClient.post('/wardrobe/items', {
        userId,
        name: analysis.subcategory || analysis.category,
        category: analysis.category,
        color: analysis.color,
        brand: analysis.brand,
        imageUrl: imageData.url,
        tags: analysis.tags || [],
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSave();
    } catch (error: any) {
      console.error('Failed to save:', error);
      Alert.alert('Save Error', error.message || 'Please try again');
    } finally {
      setIsSaving(false);
    }
  };

  const retakePicture = () => {
    setCapturedImage(null);
    setCapturedBase64(null);
    setAnalysis(null);
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <LinearGradient colors={['#020617', '#050816']} style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={scale(64)} color={colors.textMuted} />
          <Text style={styles.permissionTitle}>Camera Permission</Text>
          <Text style={styles.permissionText}>We need camera access to photograph your clothes</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  if (capturedImage) {
    return (
      <LinearGradient colors={['#020617', '#050816']} style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={retakePicture} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={scale(24)} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Review</Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView contentContainerStyle={styles.reviewContent}>
          <Image source={{ uri: capturedImage }} style={styles.previewImage} />

          {isAnalyzing ? (
            <View style={styles.analyzingContainer}>
              <LoadingSpinner size="large" message="Analyzing with AI..." />
            </View>
          ) : analysis ? (
            <View style={styles.analysisContainer}>
              <Text style={styles.analysisTitle}>Detected Details</Text>
              <View style={styles.analysisGrid}>
                <View style={styles.analysisItem}>
                  <Text style={styles.analysisLabel}>Category</Text>
                  <Text style={styles.analysisValue}>{analysis.category}</Text>
                </View>
                <View style={styles.analysisItem}>
                  <Text style={styles.analysisLabel}>Type</Text>
                  <Text style={styles.analysisValue}>{analysis.subcategory}</Text>
                </View>
                <View style={styles.analysisItem}>
                  <Text style={styles.analysisLabel}>Color</Text>
                  <Text style={styles.analysisValue}>{analysis.color}</Text>
                </View>
                <View style={styles.analysisItem}>
                  <Text style={styles.analysisLabel}>Style</Text>
                  <Text style={styles.analysisValue}>{analysis.style}</Text>
                </View>
                <View style={styles.analysisItem}>
                  <Text style={styles.analysisLabel}>Pattern</Text>
                  <Text style={styles.analysisValue}>{analysis.pattern}</Text>
                </View>
                <View style={styles.analysisItem}>
                  <Text style={styles.analysisLabel}>Fit</Text>
                  <Text style={styles.analysisValue}>{analysis.fit}</Text>
                </View>
              </View>

              {analysis.tags && analysis.tags.length > 0 && (
                <View style={styles.tagsContainer}>
                  <Text style={styles.analysisLabel}>Tags</Text>
                  <View style={styles.tagsRow}>
                    {analysis.tags.map((tag: string, i: number) => (
                      <View key={i} style={styles.tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.retakeButton} onPress={retakePicture}>
                  <Ionicons name="refresh" size={scale(20)} color={colors.textPrimary} />
                  <Text style={styles.retakeButtonText}>Retake</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                  onPress={saveToWardrobe}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={scale(20)} color="#fff" />
                      <Text style={styles.saveButtonText}>Save to Wardrobe</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </LinearGradient>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      
      {/* Overlay */}
      <View style={styles.overlay}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing['3xl']) }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={scale(28)} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitleLight}>Capture Clothing</Text>
          <View style={styles.headerButton} />
        </View>

        <View style={styles.cameraGuide}>
          <View style={styles.guideCorner} />
          <Text style={styles.guideText}>Position clothing item in frame</Text>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
  },
  headerButton: {
    width: scale(44),
    height: scale(44),
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.bodyBold,
    fontSize: scale(18),
    color: colors.textPrimary,
  },
  headerTitleLight: {
    ...typography.bodyBold,
    fontSize: scale(18),
    color: '#fff',
  },
  cameraGuide: {
    alignItems: 'center',
  },
  guideCorner: {
    width: scale(250),
    height: scale(300),
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: scale(20),
  },
  guideText: {
    ...typography.caption,
    color: '#fff',
    marginTop: spacing.md,
  },
  controls: {
    alignItems: 'center',
    paddingBottom: spacing['3xl'],
  },
  captureButton: {
    width: scale(80),
    height: scale(80),
    borderRadius: scale(40),
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    backgroundColor: '#fff',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  permissionTitle: {
    ...typography.bodyBold,
    fontSize: scale(20),
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  permissionText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  permissionButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: scale(12),
  },
  permissionButtonText: {
    ...typography.bodyBold,
    color: '#fff',
  },
  closeButton: {
    marginTop: spacing.lg,
  },
  closeButtonText: {
    ...typography.body,
    color: colors.textMuted,
  },
  reviewContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  previewImage: {
    width: '100%',
    height: scale(400),
    borderRadius: scale(20),
    marginBottom: spacing.lg,
  },
  analyzingContainer: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  analyzingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  analysisContainer: {
    backgroundColor: colors.card,
    borderRadius: scale(20),
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  analysisTitle: {
    ...typography.bodyBold,
    fontSize: scale(18),
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  analysisGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  analysisItem: {
    width: '48%',
    backgroundColor: colors.cardSoft,
    padding: spacing.md,
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  analysisLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  analysisValue: {
    ...typography.body,
    color: colors.textPrimary,
    textTransform: 'capitalize',
  },
  tagsContainer: {
    marginTop: spacing.md,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  tag: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: scale(4),
    borderRadius: scale(12),
  },
  tagText: {
    ...typography.caption,
    color: colors.primary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  retakeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardSoft,
    padding: spacing.md,
    borderRadius: scale(12),
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  retakeButtonText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: scale(12),
    gap: spacing.sm,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    ...typography.bodyBold,
    color: '#fff',
  },
});
