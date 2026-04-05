import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
  Alert,
  FlatList,
  Animated,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { useThemeColors } from '../theme/ThemeProvider';
import { spacing } from '../theme/spacing';
import { apiClient } from '../services/apiClient';
import { useUserId } from '../hooks/useUserId';
import { useAuth } from '../context/AuthContext';
import { scale, verticalScale } from '../utils/responsive';

interface CapturedItem {
  id: string;
  uri: string;
  base64: string;
  status: 'pending' | 'analyzing' | 'ready' | 'saving' | 'saved' | 'error' | 'rejected';
  analysis?: any;
  error?: string;
  rejectionMessage?: string;
}

interface BulkCameraScreenProps {
  onClose: () => void;
  onComplete: () => void;
}

// Slideshow content - Complete feature showcase of Fashion Fit
// First slide is dynamic with user's name, handled separately
const SLIDESHOW_CONTENT = [
  { icon: '📸', title: "AI Wardrobe Management", subtitle: "We auto-detect category, color, style, pattern, fit & brand", tip: "Bulk import up to 30 items at once! Rapid-fire camera or gallery import. Cloud storage with Cloudinary CDN.", gradientKey: 'primary' as const },
  { icon: '🧠', title: "12 Style Algorithms", subtitle: "Color Harmony • Pattern Mixing • Texture Compatibility", tip: "Plus: Occasion Rules, Seasonal Palettes, Style Coherence, Trend Alignment, Wow Factor & more. Your outfits are SCIENTIFICALLY styled!", gradientKey: 'secondary' as const },
  { icon: '✨', title: "AI Outfit Recommendations", subtitle: "Swipe right to save, left to reject. We learn from YOU", tip: "3-color rule enforced. Pattern mixing done right. Every outfit uses YOUR actual clothes!", gradientKey: 'accent' as const },
  { icon: '🌤️', title: "Weather-Smart Styling", subtitle: "Current location OR destination weather forecast", tip: "Traveling? Get morning, afternoon & evening forecasts with rain probability. We dress you for ANY weather!", gradientKey: 'primary' as const },
  { icon: '👑', title: "Your Personal Style Coach", subtitle: "AI that SEES your wardrobe and knows YOUR style", tip: "Wardrobe audits, style education, trend insights, shopping advice. Named after YOU. No judgment, only celebration!", gradientKey: 'secondary' as const },
  { icon: '🧬', title: "Style DNA & Analytics", subtitle: "Your unique style profile, scientifically analyzed", tip: "Primary style, color preferences, brand affinity, uniqueness score, style consistency & trend alignment. Know yourself!", gradientKey: 'accent' as const },
  { icon: '📅', title: "Outfit Planner", subtitle: "Plan outfits for future dates, track what you've worn", tip: "Save outfits, mark as worn, see your most-worn pieces. Never repeat the same look twice (unless you want to)!", gradientKey: 'primary' as const },
  { icon: '🌍', title: "30 Languages Supported", subtitle: "English, Spanish, Chinese, French, Arabic, Hindi & 24 more", tip: "Full UI translation + AI Coach responds in YOUR language. Style has no borders!", gradientKey: 'secondary' as const },
  { icon: '📈', title: "AI That Learns From You", subtitle: "Every swipe, save & reject makes us smarter", tip: "Jaccard similarity, item freshness scoring, outfit variety tracking. The more you use it, the better it gets!", gradientKey: 'accent' as const },
  { icon: '💎', title: "Premium Experience", subtitle: "Glassmorphism, haptic feedback, smooth animations", tip: "Custom fonts, skeleton loaders, pull-to-refresh, animated tab bar, floating orbs. You deserve the BEST!", gradientKey: 'primary' as const },
  { icon: '🔥', title: "You're About to SHINE", subtitle: "Everybody should see your amazing style", tip: "Fashion Fit doesn't change you - we help you become MORE of yourself. Confident, sexy, unstoppable!", gradientKey: 'secondary' as const },
];

export default function BulkCameraScreen({ onClose, onComplete }: BulkCameraScreenProps) {
  const colors = useThemeColors();
  const userId = useUserId();
  const { user } = useAuth();
  const userName = user?.name?.split(' ')[0] || 'Friend';
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<'select' | 'camera' | 'review' | 'processing'>('select');
  const [capturedItems, setCapturedItems] = useState<CapturedItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingPhase, setProcessingPhase] = useState<'analyzing' | 'readyToSave' | 'saving' | 'complete'>('analyzing');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [progress, setProgress] = useState(0);
  const cameraRef = useRef<CameraView>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Muted by default
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Load and manage background music
  useEffect(() => {
    let isMounted = true;

    const loadAndPlaySound = async () => {
      try {
        // Configure audio mode
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
        
        // Unload previous sound if exists
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
        }
        
        console.log('Loading sound...');
        const { sound } = await Audio.Sound.createAsync(
          require('../../sound/desires-rnb-type-beat-277125.mp3'),
          { 
            isLooping: true, 
            volume: 0.6,
            shouldPlay: !isMuted // Play immediately if not muted
          }
        );
        
        console.log('Sound loaded successfully');
        
        if (isMounted) {
          soundRef.current = sound;
        }
      } catch (error: any) {
        console.log('Error loading sound:', error?.message || error);
        // Don't crash if sound fails to load - it's optional
      }
    };

    if (mode === 'processing') {
      loadAndPlaySound();
    }

    return () => {
      isMounted = false;
      if (soundRef.current) {
        soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    };
  }, [mode]);

  // Play/pause based on mute state
  const toggleMute = async () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (soundRef.current) {
      try {
        if (newMutedState) {
          await soundRef.current.pauseAsync();
          console.log('Sound paused');
        } else {
          await soundRef.current.playAsync();
          console.log('Sound playing');
        }
      } catch (error: any) {
        console.log('Error toggling sound:', error?.message || error);
        // Don't crash if sound fails - it's optional
      }
    } else {
      console.log('Sound not loaded yet');
    }
  };

  // Stop music when leaving processing mode
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.stopAsync();
      }
    };
  }, []);

  // Slideshow animation - pauses on tap, slower pace
  useEffect(() => {
    if (mode === 'processing' && processingPhase !== 'complete' && !isPaused) {
      const totalSlides = SLIDESHOW_CONTENT.length + 1; // +1 for welcome slide
      
      const interval = setInterval(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }).start(() => {
          setCurrentSlide(prev => (prev + 1) % totalSlides);
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }).start();
        });
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [mode, processingPhase, isPaused]);

  const togglePause = () => {
    setIsPaused(prev => !prev);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const goToNextSlide = () => {
    const totalSlides = SLIDESHOW_CONTENT.length + 1;
    setCurrentSlide(prev => (prev + 1) % totalSlides);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const goToPrevSlide = () => {
    const totalSlides = SLIDESHOW_CONTENT.length + 1;
    setCurrentSlide(prev => (prev - 1 + totalSlides) % totalSlides);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const takePicture = async () => {
    if (!cameraRef.current || capturedItems.length >= 30) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
      });

      if (photo && photo.base64) {
        const newItem: CapturedItem = {
          id: Date.now().toString(),
          uri: photo.uri,
          base64: photo.base64,
          status: 'pending',
        };
        setCapturedItems(prev => [...prev, newItem]);
      }
    } catch (error: any) {
      console.log('Failed to take picture:', error?.message || error);
    }
  };

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      base64: true,
      quality: 0.7,
      selectionLimit: 30,
    });

    if (!result.canceled && result.assets) {
      const newItems: CapturedItem[] = result.assets
        .filter(asset => asset.base64)
        .map((asset, index) => ({
          id: `${Date.now()}-${index}`,
          uri: asset.uri,
          base64: asset.base64!,
          status: 'pending' as const,
        }));

      setCapturedItems(prev => [...prev, ...newItems].slice(0, 30));
      setMode('review');
    }
  };

  const removeItem = (id: string) => {
    setCapturedItems(prev => prev.filter(item => item.id !== id));
  };

  const toggleSelectItem = (id: string) => {
    setSelectedForDelete(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const deleteSelected = () => {
    setCapturedItems(prev => prev.filter(item => !selectedForDelete.has(item.id)));
    setSelectedForDelete(new Set());
    setIsSelectMode(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const selectAll = () => {
    setSelectedForDelete(new Set(capturedItems.map(item => item.id)));
  };

  const clearSelection = () => {
    setSelectedForDelete(new Set());
    setIsSelectMode(false);
  };

  const startProcessing = async () => {
    setMode('processing');
    setProcessingPhase('analyzing');
    setIsProcessing(true);
    setProgress(0);

    const total = capturedItems.length;
    let completed = 0;

    // Analyze all items
    for (let i = 0; i < capturedItems.length; i++) {
      const item = capturedItems[i];
      if (item.status !== 'pending') continue;

      setCapturedItems(prev =>
        prev.map(p => (p.id === item.id ? { ...p, status: 'analyzing' } : p))
      );

      try {
        const response = await apiClient.post('/ai/categorize-image', {
          imageBase64: item.base64,
        });

        setCapturedItems(prev =>
          prev.map(p =>
            p.id === item.id ? { ...p, status: 'ready', analysis: response.data } : p
          )
        );
      } catch (error: any) {
        // Safely extract error information
        const errorStatus = error?.status;
        const errorData = error?.data;
        const isInvalidItem = errorStatus === 400 && errorData && typeof errorData === 'object' && errorData.error === 'INVALID_ITEM';
        
        // Check if item was rejected (not clothing)
        if (isInvalidItem) {
          setCapturedItems(prev =>
            prev.map(p =>
              p.id === item.id
                ? {
                    ...p,
                    status: 'rejected',
                    error: (errorData && typeof errorData === 'object' && errorData.rejectionReason) || 'Not a clothing item',
                    rejectionMessage: (errorData && typeof errorData === 'object' && errorData.message) || 'This item is not recognized as clothing or accessories',
                  }
                : p
            )
          );
        } else {
          // Extract error message safely
          let errorMessage = 'Failed to analyze item';
          if (error) {
            if (typeof error === 'string') {
              errorMessage = error;
            } else if (error.message) {
              errorMessage = error.message;
            } else if (errorData && typeof errorData === 'object' && errorData.error) {
              errorMessage = errorData.error;
            } else {
              errorMessage = String(error);
            }
          }
          
          setCapturedItems(prev =>
            prev.map(p =>
              p.id === item.id ? { 
                ...p, 
                status: 'error', 
                error: errorMessage
              } : p
            )
          );
        }
      }

      completed++;
      setProgress((completed / total) * 50); // First 50% is analyzing
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Show ready to save popup
    setProcessingPhase('readyToSave');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const saveAllItems = async () => {
    if (!userId) return;
    setProcessingPhase('saving');

    const readyItems = capturedItems.filter(item => item.status === 'ready');
    const total = readyItems.length;
    let completed = 0;

    for (const item of readyItems) {
      setCapturedItems(prev =>
        prev.map(p => (p.id === item.id ? { ...p, status: 'saving' } : p))
      );

      try {
        const uploadResponse = await apiClient.post('/upload/image-base64', {
          imageBase64: item.base64,
        });

        const imageData = uploadResponse.data.image;

        await apiClient.post('/wardrobe/items', {
          userId,
          name: item.analysis.subcategory || item.analysis.category,
          category: item.analysis.category,
          color: item.analysis.color,
          brand: item.analysis.brand,
          imageUrl: imageData.url,
          tags: item.analysis.tags || [],
        });

        setCapturedItems(prev =>
          prev.map(p => (p.id === item.id ? { ...p, status: 'saved' } : p))
        );
      } catch (error: any) {
        // Extract error message safely
        let errorMessage = 'Failed to save item';
        if (error) {
          if (typeof error === 'string') {
            errorMessage = error;
          } else if (error.message) {
            errorMessage = error.message;
          } else if (error.data && typeof error.data === 'object' && error.data.error) {
            errorMessage = error.data.error;
          } else {
            errorMessage = String(error);
          }
        }
        
        setCapturedItems(prev =>
          prev.map(p =>
            p.id === item.id ? { 
              ...p, 
              status: 'error', 
              error: errorMessage
            } : p
          )
        );
      }

      completed++;
      setProgress(50 + (completed / total) * 50); // Second 50% is saving
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    setProcessingPhase('complete');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const finishAndClose = () => {
    onComplete();
  };

  // Permission loading
  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: colors.card }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // PROCESSING MODE - Full screen immersive slideshow experience!
  if (mode === 'processing') {
    const gradientMap: Record<string, [string, string]> = {
      primary: [colors.primary, colors.secondary],
      secondary: [colors.secondary, colors.accent],
      accent: [colors.accent, colors.primary],
    };

    const welcomeSlide = {
      icon: '👋',
      title: `Hey ${userName}!`,
      subtitle: "Jump in to see what we got in store for you as you wait",
      tip: "Your wardrobe is about to get a serious upgrade. Let's make magic together!",
      gradient: [colors.primary, colors.secondary] as [string, string],
    };
    
    const allSlides = [welcomeSlide, ...SLIDESHOW_CONTENT.map(slide => ({
      ...slide,
      gradient: gradientMap[slide.gradientKey] || gradientMap.primary,
    }))];
    const slide = allSlides[currentSlide % allSlides.length];
    const savedCount = capturedItems.filter(i => i.status === 'saved').length;
    const readyCount = capturedItems.filter(i => i.status === 'ready').length;
    const rejectedCount = capturedItems.filter(i => i.status === 'rejected').length;
    const analyzedCount = capturedItems.filter(i => i.status === 'ready' || i.status === 'saved').length;

    return (
      <View style={styles.processingContainer}>
        {/* Full screen gradient background that changes with slides */}
        <LinearGradient
          colors={[slide.gradient[0], slide.gradient[1], colors.card]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        {/* Animated background shapes */}
        <View style={styles.shapesContainer}>
          <Animated.View style={[styles.shape, styles.shape1, { opacity: fadeAnim }]} />
          <Animated.View style={[styles.shape, styles.shape2, { opacity: fadeAnim }]} />
          <Animated.View style={[styles.shape, styles.shape3, { opacity: fadeAnim }]} />
        </View>

        {/* Top section - Progress + Mute button */}
        <View style={styles.topSection}>
          {/* Mute/Unmute button */}
          <TouchableOpacity style={styles.muteButton} onPress={toggleMute}>
            <View style={styles.muteButtonInner}>
              <Ionicons 
                name={isMuted ? "volume-mute" : "volume-high"} 
                size={20} 
                color="#fff" 
              />
            </View>
          </TouchableOpacity>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: '#fff' }]} />
            </View>
            <Text style={styles.progressText}>
              {processingPhase === 'analyzing' && `✨ Analyzing ${analyzedCount}/${capturedItems.length} items`}
              {processingPhase === 'saving' && `☁️ Saving ${savedCount}/${readyCount} items`}
              {processingPhase === 'readyToSave' && `🎉 ${readyCount} items ready to save!`}
              {processingPhase === 'complete' && `✅ ${savedCount} items in your wardrobe!`}
            </Text>
          </View>
        </View>

        {/* Center section - Main slideshow content - TAP TO PAUSE */}
        <TouchableOpacity 
          style={styles.centerSection} 
          activeOpacity={0.9}
          onPress={togglePause}
        >
          <Animated.View style={[styles.slideContentInner, { opacity: fadeAnim }]}>
            <View style={styles.iconContainer}>
              <Text style={styles.bigIcon}>{slide.icon}</Text>
            </View>
            
            <Text style={[styles.bigTitle, { color: colors.textOnPrimary }]}>{slide.title}</Text>
            <Text style={styles.bigSubtitle}>{slide.subtitle}</Text>
            
            {/* Tip card */}
            <View style={styles.tipCard}>
              <Ionicons name="bulb" size={20} color="#fbbf24" />
              <Text style={styles.tipText}>{slide.tip}</Text>
            </View>
          </Animated.View>
          
          {/* Pause indicator */}
          {isPaused && (
            <View style={styles.pauseIndicator}>
              <Ionicons name="pause-circle" size={24} color="rgba(255,255,255,0.7)" />
              <Text style={styles.pauseText}>Paused - Tap to resume</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Navigation arrows */}
        <View style={styles.navArrows}>
          <TouchableOpacity onPress={goToPrevSlide} style={styles.navArrow}>
            <Ionicons name="chevron-back" size={28} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
          <TouchableOpacity onPress={goToNextSlide} style={styles.navArrow}>
            <Ionicons name="chevron-forward" size={28} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        </View>

        {/* Bottom section - Indicators & Actions */}
        <View style={styles.bottomSection}>
          {/* Slide indicators */}
          <View style={styles.slideIndicators}>
            {allSlides.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.indicator,
                  (currentSlide % allSlides.length) === index && styles.indicatorActive,
                ]}
              />
            ))}
          </View>

          {/* Action buttons based on phase */}
          <View style={styles.actionContainer}>
            {processingPhase === 'readyToSave' && (
              <TouchableOpacity style={styles.bigButton} onPress={saveAllItems}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.85)']}
                  style={styles.bigButtonGradient}
                >
                  <Text style={styles.bigButtonEmoji}>☁️</Text>
                  <View>
                    <Text style={styles.bigButtonTitle}>Time to Save!</Text>
                    <Text style={styles.bigButtonSubtitle}>
                      Tap to add {readyCount} items to your wardrobe
                      {rejectedCount > 0 && ` (${rejectedCount} invalid items excluded)`}
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {processingPhase === 'complete' && (
              <TouchableOpacity style={styles.bigButton} onPress={finishAndClose}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.85)']}
                  style={styles.bigButtonGradient}
                >
                  <Text style={styles.bigButtonEmoji}>🚀</Text>
                  <View>
                    <Text style={styles.bigButtonTitle}>You're All Set!</Text>
                    <Text style={styles.bigButtonSubtitle}>Tap to explore your new wardrobe</Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {(processingPhase === 'analyzing' || processingPhase === 'saving') && (
              <View style={styles.loadingContainer}>
                <View style={styles.loadingDots}>
                  <Animated.View style={[styles.loadingDot, { opacity: fadeAnim }]} />
                  <Animated.View style={[styles.loadingDot, { opacity: fadeAnim }]} />
                  <Animated.View style={[styles.loadingDot, { opacity: fadeAnim }]} />
                </View>
                <Text style={styles.loadingText}>
                  {processingPhase === 'analyzing' ? 'AI is working its magic...' : 'Almost there...'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  }

  // SELECT MODE
  if (mode === 'select') {
    return (
      <LinearGradient colors={[colors.card, colors.surface]} style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textOnPrimary }]}>Bulk Add</Text>
          <View style={styles.headerButton} />
        </View>

        <View style={styles.selectContainer}>
          <TouchableOpacity
            style={styles.selectOption}
            onPress={() => {
              if (permission.granted) {
                setMode('camera');
              } else {
                requestPermission();
              }
            }}
          >
            <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.selectIcon}>
              <Ionicons name="camera" size={32} color="#fff" />
            </LinearGradient>
            <Text style={[styles.selectTitle, { color: colors.textOnPrimary }]}>Rapid Fire Camera</Text>
            <Text style={[styles.selectSubtitle, { color: colors.textMuted }]}>Take multiple photos quickly</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.selectOption} onPress={pickImages}>
            <LinearGradient colors={[colors.secondary, colors.accent]} style={styles.selectIcon}>
              <Ionicons name="images" size={32} color="#fff" />
            </LinearGradient>
            <Text style={[styles.selectTitle, { color: colors.textOnPrimary }]}>Import from Gallery</Text>
            <Text style={[styles.selectSubtitle, { color: colors.textMuted }]}>Select up to 30 photos</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  // CAMERA MODE
  if (mode === 'camera') {
    return (
      <View style={[styles.container, { backgroundColor: colors.card }]}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />
        
        <View style={styles.overlay}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setMode('select')} style={styles.headerButton}>
              <Ionicons name="arrow-back" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={[styles.headerTitleLight, { color: colors.textOnPrimary }]}>
              {capturedItems.length}/30 items
            </Text>
            <TouchableOpacity
              onPress={() => setMode('review')}
              style={styles.headerButton}
              disabled={capturedItems.length === 0}
            >
              <Text style={[styles.doneText, { color: colors.primary }, capturedItems.length === 0 && styles.doneTextDisabled]}>
                Done
              </Text>
            </TouchableOpacity>
          </View>

          {capturedItems.length > 0 && (
            <ScrollView horizontal style={styles.thumbnailStrip} showsHorizontalScrollIndicator={false}>
              {capturedItems.map(item => (
                <Image key={item.id} source={{ uri: item.uri }} style={styles.thumbnail} />
              ))}
            </ScrollView>
          )}

          <View style={styles.controls}>
            <TouchableOpacity
              style={[styles.captureButton, capturedItems.length >= 30 && styles.captureButtonDisabled]}
              onPress={takePicture}
              disabled={capturedItems.length >= 30}
            >
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // REVIEW MODE
  const pendingCount = capturedItems.filter(i => i.status === 'pending').length;
  const rejectedCount = capturedItems.filter(i => i.status === 'rejected').length;

  return (
    <LinearGradient colors={[colors.card, colors.surface]} style={styles.container}>
      {/* Warning banner for rejected items */}
      {rejectedCount > 0 && (
        <View style={styles.rejectedBanner}>
          <Ionicons name="warning" size={20} color="#fff" />
          <Text style={[styles.rejectedBannerText, { color: colors.textOnPrimary }]}>
            {rejectedCount} item{rejectedCount > 1 ? 's' : ''} rejected - Only clothing and accessories allowed
          </Text>
        </View>
      )}
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setMode('select')} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textOnPrimary }]}>Review ({capturedItems.length} items)</Text>
        <TouchableOpacity 
          onPress={() => setIsSelectMode(!isSelectMode)} 
          style={styles.headerButton}
        >
          <Text style={[styles.selectModeText, isSelectMode && { color: colors.primary }]}>
            {isSelectMode ? 'Cancel' : 'Select'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Select mode toolbar */}
      {isSelectMode && (
        <View style={styles.selectToolbar}>
          <TouchableOpacity onPress={selectAll} style={styles.selectToolbarBtn}>
            <Text style={[styles.selectToolbarText, { color: colors.secondary }]}>Select All</Text>
          </TouchableOpacity>
          <Text style={styles.selectedCount}>{selectedForDelete.size} selected</Text>
          <TouchableOpacity 
            onPress={deleteSelected} 
            style={[styles.selectToolbarBtn, styles.deleteBtn]}
            disabled={selectedForDelete.size === 0}
          >
            <Ionicons name="trash" size={18} color="#fff" />
            <Text style={[styles.deleteBtnText, { color: colors.textOnPrimary }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={capturedItems}
        numColumns={3}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.gridContent}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.gridItem}
            onPress={() => {
              if (isSelectMode) {
                toggleSelectItem(item.id);
              }
            }}
            onLongPress={() => {
              setIsSelectMode(true);
              toggleSelectItem(item.id);
            }}
            delayLongPress={300}
            activeOpacity={0.7}
          >
            <Image source={{ uri: item.uri }} style={styles.gridImage} />
            
            {/* Rejected badge */}
            {item.status === 'rejected' && (
              <View style={styles.rejectedBadge}>
                <Ionicons name="warning" size={16} color="#fff" />
                <Text style={[styles.rejectedBadgeText, { color: colors.textOnPrimary }]}>Invalid</Text>
              </View>
            )}
            
            {/* Error badge */}
            {item.status === 'error' && (
              <View style={styles.errorBadge}>
                <Ionicons name="alert-circle" size={16} color="#fff" />
              </View>
            )}
            
            {/* Selection checkbox */}
            {isSelectMode && (
              <View style={[
                styles.selectCheckbox,
                selectedForDelete.has(item.id) && { backgroundColor: colors.primary, borderColor: colors.primary }
              ]}>
                {selectedForDelete.has(item.id) && (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                )}
              </View>
            )}
            
            {/* Regular delete button (when not in select mode) */}
            {!isSelectMode && (
              <TouchableOpacity style={styles.removeButton} onPress={() => removeItem(item.id)}>
                <View style={styles.removeButtonBg}>
                  <Ionicons name="close" size={14} color="#fff" />
                </View>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        )}
      />

      <View style={[styles.bottomActions, { backgroundColor: colors.card }]}>
        <TouchableOpacity
          style={styles.processButton}
          onPress={startProcessing}
          disabled={capturedItems.length === 0}
        >
          <LinearGradient
            colors={capturedItems.length > 0 ? [...colors.gradientAccent] : ['#333333', '#333333']}
            style={styles.processButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="sparkles" size={22} color="#fff" />
            <Text style={[styles.processButtonText, { color: colors.textOnPrimary }]}>
              Analyze & Save ({capturedItems.length})
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
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
    padding: scale(16),
    paddingTop: verticalScale(56),
  },
  headerButton: {
    minWidth: scale(44),
    height: scale(44),
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: scale(18),
    fontWeight: '700',
    color: '#fff',
  },
  headerTitleLight: {
    fontSize: scale(18),
    fontWeight: '700',
    color: '#fff',
  },
  doneText: {
    fontSize: scale(16),
    fontWeight: '600',
    color: '#c9a96e',
  },
  doneTextDisabled: {
    opacity: 0.4,
  },
  selectContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: scale(24),
    gap: scale(16),
  },
  selectOption: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: scale(20),
    padding: scale(28),
    alignItems: 'center',
    borderWidth: scale(1),
    borderColor: 'rgba(255,255,255,0.1)',
  },
  selectIcon: {
    width: scale(72),
    height: scale(72),
    borderRadius: scale(36),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(16),
  },
  selectTitle: {
    fontSize: scale(18),
    fontWeight: '700',
    color: '#fff',
    marginBottom: scale(4),
  },
  selectSubtitle: {
    fontSize: scale(14),
    color: '#a8a29e',
    textAlign: 'center',
  },
  thumbnailStrip: {
    maxHeight: verticalScale(80),
    paddingHorizontal: scale(16),
  },
  thumbnail: {
    width: scale(60),
    height: scale(60),
    borderRadius: scale(8),
    marginRight: scale(8),
  },
  controls: {
    alignItems: 'center',
    paddingBottom: verticalScale(50),
  },
  captureButton: {
    width: scale(80),
    height: scale(80),
    borderRadius: scale(40),
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonDisabled: {
    opacity: 0.4,
  },
  captureButtonInner: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    backgroundColor: '#fff',
  },
  gridContent: {
    padding: scale(8),
    paddingBottom: verticalScale(120),
  },
  gridItem: {
    flex: 1 / 3,
    aspectRatio: 1,
    padding: scale(4),
  },
  gridImage: {
    flex: 1,
    borderRadius: scale(12),
  },
  removeButton: {
    position: 'absolute',
    top: scale(8),
    right: scale(8),
  },
  rejectedBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderBottomWidth: scale(1),
    borderBottomColor: 'rgba(239, 68, 68, 0.4)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(12),
  },
  rejectedBannerText: {
    flex: 1,
    fontSize: scale(13),
    color: '#fff',
    fontWeight: '600',
  },
  rejectedBadge: {
    position: 'absolute',
    top: scale(4),
    left: scale(4),
    backgroundColor: '#ef4444',
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(3),
    borderRadius: scale(8),
    zIndex: 10,
  },
  rejectedBadgeText: {
    fontSize: scale(10),
    fontWeight: '700',
    color: '#fff',
  },
  errorBadge: {
    position: 'absolute',
    top: scale(4),
    left: scale(4),
    backgroundColor: '#f59e0b',
    width: scale(24),
    height: scale(24),
    borderRadius: scale(12),
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  removeButtonBg: {
    width: scale(24),
    height: scale(24),
    borderRadius: scale(12),
    backgroundColor: 'rgba(239,68,68,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectModeText: {
    fontSize: scale(15),
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  selectModeActive: {
    color: '#c9a96e',
  },
  selectToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(12),
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderBottomWidth: scale(1),
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  selectToolbarBtn: {
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(6),
  },
  selectToolbarText: {
    color: '#d4bc94',
    fontSize: scale(14),
    fontWeight: '600',
  },
  selectedCount: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: scale(14),
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    backgroundColor: '#ef4444',
    borderRadius: scale(8),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(8),
  },
  deleteBtnText: {
    color: '#fff',
    fontSize: scale(14),
    fontWeight: '600',
  },
  selectCheckbox: {
    position: 'absolute',
    top: scale(8),
    left: scale(8),
    width: scale(24),
    height: scale(24),
    borderRadius: scale(12),
    borderWidth: scale(2),
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectCheckboxActive: {
    backgroundColor: '#c9a96e',
    borderColor: '#c9a96e',
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: scale(16),
    paddingBottom: verticalScale(40),
    backgroundColor: '#1a1a1a',
  },
  processButton: {
    borderRadius: scale(16),
    overflow: 'hidden',
  },
  processButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(16),
    gap: scale(10),
  },
  processButtonText: {
    fontSize: scale(17),
    fontWeight: '700',
    color: '#fff',
  },
  
  // FULL SCREEN Processing slideshow styles
  processingContainer: {
    flex: 1,
  },
  shapesContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  shape: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: scale(999),
  },
  shape1: {
    width: scale(300),
    height: scale(300),
    top: verticalScale(-100),
    right: scale(-100),
  },
  shape2: {
    width: scale(200),
    height: scale(200),
    bottom: verticalScale(200),
    left: scale(-80),
  },
  shape3: {
    width: scale(150),
    height: scale(150),
    top: '40%',
    right: scale(-50),
  },
  topSection: {
    paddingTop: verticalScale(60),
    paddingHorizontal: scale(24),
  },
  muteButton: {
    position: 'absolute',
    top: verticalScale(60),
    right: scale(20),
    zIndex: 10,
  },
  muteButtonInner: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22),
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: scale(4),
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: scale(2),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: scale(2),
  },
  progressText: {
    fontSize: scale(15),
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginTop: verticalScale(16),
    fontWeight: '600',
  },
  centerSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(28),
  },
  slideContentInner: {
    alignItems: 'center',
  },
  pauseIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginTop: verticalScale(20),
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(8),
    borderRadius: scale(20),
  },
  pauseText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: scale(13),
  },
  navArrows: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: scale(8),
    marginTop: verticalScale(-20),
  },
  navArrow: {
    width: scale(44),
    height: scale(44),
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: scale(120),
    height: scale(120),
    borderRadius: scale(60),
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(32),
  },
  bigIcon: {
    fontSize: scale(60),
  },
  bigTitle: {
    fontSize: scale(32),
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: verticalScale(12),
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: scale(2) },
    textShadowRadius: scale(4),
  },
  bigSubtitle: {
    fontSize: scale(18),
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: scale(26),
    marginBottom: verticalScale(32),
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: scale(16),
    padding: scale(16),
    gap: scale(12),
    maxWidth: scale(340),
  },
  tipText: {
    flex: 1,
    fontSize: scale(14),
    color: 'rgba(255,255,255,0.9)',
    lineHeight: scale(20),
  },
  bottomSection: {
    paddingBottom: verticalScale(50),
    paddingHorizontal: scale(24),
  },
  slideIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: scale(6),
    marginBottom: verticalScale(24),
  },
  indicator: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  indicatorActive: {
    backgroundColor: '#fff',
    width: scale(20),
  },
  actionContainer: {
    minHeight: verticalScale(90),
  },
  bigButton: {
    borderRadius: scale(20),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: verticalScale(8) },
    shadowOpacity: 0.3,
    shadowRadius: scale(16),
    elevation: scale(8),
  },
  bigButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(20),
    paddingHorizontal: scale(24),
    gap: scale(16),
  },
  bigButtonEmoji: {
    fontSize: scale(36),
  },
  bigButtonTitle: {
    fontSize: scale(20),
    fontWeight: '800',
    color: '#2a2a2a',
  },
  bigButtonSubtitle: {
    fontSize: scale(13),
    color: '#78716c',
    marginTop: verticalScale(2),
  },
  loadingContainer: {
    alignItems: 'center',
    gap: verticalScale(16),
  },
  loadingDots: {
    flexDirection: 'row',
    gap: scale(8),
  },
  loadingDot: {
    width: scale(10),
    height: scale(10),
    borderRadius: scale(5),
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  loadingText: {
    fontSize: scale(15),
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
});
