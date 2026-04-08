import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { useThemeColors } from '../theme/ThemeProvider';
import { spacing } from '../theme/spacing';
import { scale, verticalScale, SCREEN_WIDTH } from '../utils/responsive';

const CONTENT_WIDTH = SCREEN_WIDTH - scale(32);
const ITEM_SIZE = Math.min(scale(70), Math.floor((CONTENT_WIDTH - scale(36)) / 4));

import { fetchWardrobeItems, ClothingItem } from '../services/wardrobeApi';
import { getRecommendations } from '../services/recommendationsService';
import { submitOutfitFeedback } from '../services/stylistFeedback';
import { createOutfit, fetchOutfits } from '../services/outfitApi';
import { useUserId } from '../hooks/useUserId';
import { getCurrentWeather, WeatherData, WeatherForecast } from '../services/weatherService';
import { DestinationPicker } from '../components/DestinationPicker';
import { AIMisuseWarning, hasAcknowledgedWarning } from '../components/AIMisuseWarning';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useTranslation } from 'react-i18next';


const OCCASION_KEYS = ['Casual', 'Work', 'Date', 'Party', 'Gym', 'Formal'];
const TIME_KEYS = ['Morning', 'Afternoon', 'Evening', 'Night'];

interface OutfitSuggestion {
  id: string;
  items: ClothingItem[];
  occasion: string;
  reasoning: string;
  title?: string;
  description?: string;
}

const STYLING_TIPS = [
  'Analyzing your wardrobe palette...',
  'Matching colors & textures...',
  'Scoring outfit combinations...',
  'Checking weather compatibility...',
  'Finding your perfect look...',
  'Curating with AI styling engine...',
  'Balancing patterns & silhouettes...',
  'Personalizing to your Style DNA...',
];

const StylingLoader: React.FC<{ occasion: string; timeOfDay: string; done: boolean; onFinished: () => void }> = ({ occasion, timeOfDay, done, onFinished }) => {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const iconRotate = useRef(new Animated.Value(0)).current;
  const [tipIndex, setTipIndex] = useState(0);
  const tipFade = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const [doneText, setDoneText] = useState(false);
  const dotAnims = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(shimmerAnim, { toValue: 1, duration: 1800, easing: Easing.linear, useNativeDriver: true })
    ).start();

    Animated.loop(
      Animated.timing(iconRotate, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true })
    ).start();

    // Progress creeps to 70% slowly — waits for the real data
    Animated.timing(progressAnim, { toValue: 0.7, duration: 15000, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();

    dotAnims.forEach((anim, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(anim, { toValue: 1, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 400, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ])
      ).start();
    });

    const interval = setInterval(() => {
      Animated.timing(tipFade, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
        setTipIndex(prev => (prev + 1) % STYLING_TIPS.length);
        Animated.timing(tipFade, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      });
    }, 2800);

    return () => clearInterval(interval);
  }, []);

  // When data arrives: snap bar to 100%, show "Done!", then fade out and reveal results
  useEffect(() => {
    if (!done) return;
    progressAnim.stopAnimation(() => {
      Animated.timing(progressAnim, { toValue: 1, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: false }).start(() => {
        setDoneText(true);
        setTimeout(() => {
          Animated.timing(containerOpacity, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => {
            onFinished();
          });
        }, 600);
      });
    });
  }, [done]);

  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 1, 0.6] });
  const spin = iconRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const shimmerTranslate = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH] });

  return (
    <Animated.View style={[loaderStyles.container, { opacity: containerOpacity }]}>
      {/* Central icon */}
      <View style={loaderStyles.iconArea}>
        <Animated.View style={[loaderStyles.outerRing, { borderColor: doneText ? colors.success : colors.primary, transform: [{ scale: pulseScale }], opacity: pulseOpacity }]} />
        <Animated.View style={[loaderStyles.iconCircle, { backgroundColor: colors.primarySoft, transform: [{ rotate: doneText ? '0deg' : spin }] }]}>
          <Ionicons name={doneText ? 'checkmark-circle' : 'sparkles'} size={scale(28)} color={doneText ? colors.success : colors.primary} />
        </Animated.View>
      </View>

      {/* Status text */}
      <Text style={[loaderStyles.title, { color: colors.textPrimary }]}>
        {doneText ? t('stylist.outfitsReady') : `Styling for ${occasion.toLowerCase()} ${timeOfDay.toLowerCase()}`}
      </Text>

      {/* Rotating tips */}
      {!doneText && (
        <Animated.Text style={[loaderStyles.tip, { color: colors.textMuted, opacity: tipFade }]}>
          {STYLING_TIPS[tipIndex]}
        </Animated.Text>
      )}

      {/* Bouncing dots */}
      {!doneText && (
        <View style={loaderStyles.dotsRow}>
          {dotAnims.map((anim, i) => (
            <Animated.View
              key={i}
              style={[
                loaderStyles.dot,
                { backgroundColor: colors.primary, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }] },
              ]}
            />
          ))}
        </View>
      )}

      {/* Progress bar */}
      <View style={[loaderStyles.progressTrack, { backgroundColor: colors.borderSubtle }]}>
        <Animated.View
          style={[
            loaderStyles.progressFill,
            { backgroundColor: doneText ? colors.success : colors.primary, width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
          ]}
        />
        {!doneText && (
          <Animated.View style={[loaderStyles.shimmer, { transform: [{ translateX: shimmerTranslate }] }]}>
            <LinearGradient
              colors={['transparent', colors.surface, 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={loaderStyles.shimmerGradient}
            />
          </Animated.View>
        )}
      </View>

      {/* Skeleton outfit cards */}
      {!doneText && [0, 1, 2].map(i => (
        <Animated.View
          key={i}
          style={[
            loaderStyles.skeletonCard,
            { backgroundColor: colors.card, borderColor: colors.borderSubtle, opacity: pulseOpacity },
          ]}
        >
          <View style={[loaderStyles.skeletonLine, { backgroundColor: colors.borderSubtle, width: '55%' }]} />
          <View style={loaderStyles.skeletonItemsRow}>
            {[0, 1, 2, 3].map(j => (
              <View key={j} style={[loaderStyles.skeletonThumb, { backgroundColor: colors.surface }]} />
            ))}
          </View>
          <View style={[loaderStyles.skeletonLine, { backgroundColor: colors.borderSubtle, width: '80%', marginTop: scale(10) }]} />
        </Animated.View>
      ))}
    </Animated.View>
  );
};

const loaderStyles = StyleSheet.create({
  container: { alignItems: 'center', paddingTop: verticalScale(24), paddingBottom: verticalScale(40) },
  iconArea: { alignItems: 'center', justifyContent: 'center', marginBottom: verticalScale(16), width: scale(72), height: scale(72) },
  outerRing: { position: 'absolute', width: scale(72), height: scale(72), borderRadius: scale(36), borderWidth: 2 },
  iconCircle: { width: scale(52), height: scale(52), borderRadius: scale(26), alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: scale(16), fontWeight: '600', letterSpacing: 0.2, marginBottom: verticalScale(6) },
  tip: { fontSize: scale(13), letterSpacing: 0.3, marginBottom: verticalScale(14), textAlign: 'center' },
  dotsRow: { flexDirection: 'row', gap: scale(6), marginBottom: verticalScale(16) },
  dot: { width: scale(7), height: scale(7), borderRadius: scale(4) },
  progressTrack: { width: '80%', height: verticalScale(4), borderRadius: scale(2), overflow: 'hidden', marginBottom: verticalScale(20) },
  progressFill: { height: '100%', borderRadius: scale(2) },
  shimmer: { position: 'absolute', top: 0, bottom: 0, width: scale(60) },
  shimmerGradient: { flex: 1 },
  skeletonCard: { width: '100%', borderRadius: scale(16), padding: scale(16), marginBottom: verticalScale(12), borderWidth: 1 },
  skeletonLine: { height: verticalScale(12), borderRadius: scale(6) },
  skeletonItemsRow: { flexDirection: 'row', gap: scale(10), marginTop: verticalScale(12) },
  skeletonThumb: { width: ITEM_SIZE - scale(8), height: ITEM_SIZE - scale(8), borderRadius: scale(10) },
});

export const StylistScreen: React.FC = () => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const userId = useUserId();
  const { t } = useTranslation();
  const [wardrobe, setWardrobe] = useState<ClothingItem[]>([]);
  const [outfits, setOutfits] = useState<OutfitSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [showResults, setShowResults] = useState(true);
  const [occasion, setOccasion] = useState('Casual');
  const [showWarning, setShowWarning] = useState(false);
  const [pendingGenerate, setPendingGenerate] = useState(false);
  const [generationVariant, setGenerationVariant] = useState(0);
  
  // Auto-detect time of day
  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Morning';
    if (hour >= 12 && hour < 17) return 'Afternoon';
    if (hour >= 17 && hour < 21) return 'Evening';
    return 'Night';
  };
  const [timeOfDay, setTimeOfDay] = useState(getTimeOfDay());
  const [savedOutfits, setSavedOutfits] = useState<Set<string>>(new Set());
  const [savedOutfitsList, setSavedOutfitsList] = useState<OutfitSuggestion[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  
  // Weather & Destination
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [currentLocationWeather, setCurrentLocationWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [isCurrentLocation, setIsCurrentLocation] = useState(true);
  const [showDestinationPicker, setShowDestinationPicker] = useState(false);
  const [loadingWeather, setLoadingWeather] = useState(true);

  useEffect(() => {
    loadWardrobe();
    loadCurrentLocationWeather();
    loadSavedOutfitsFromDB();
  }, [userId]);

  const loadCurrentLocationWeather = async () => {
    try {
      setLoadingWeather(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission denied');
        setLoadingWeather(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const weatherData = await getCurrentWeather(location.coords.latitude, location.coords.longitude);
      setWeather(weatherData);
      setCurrentLocationWeather(weatherData);
      setIsCurrentLocation(true);
    } catch (error) {
      console.log('Weather unavailable, continuing without it');
    } finally {
      setLoadingWeather(false);
    }
  };

  const handleSelectDestination = (weatherData: WeatherData, isCurrent: boolean, forecastData?: WeatherForecast) => {
    setWeather(weatherData);
    setIsCurrentLocation(isCurrent);
    if (forecastData) {
      setForecast(forecastData);
    }
  };

  const loadWardrobe = async () => {
    try {
      if (!userId) return;
      const items = await fetchWardrobeItems(userId);
      setWardrobe(items);
    } catch (err) {
      console.log('Failed to load wardrobe', err);
    }
  };

  const loadSavedOutfitsFromDB = async () => {
    try {
      if (!userId) return;
      const dbOutfits = await fetchOutfits(userId);
      if (dbOutfits.length > 0) {
        const ids = new Set<string>();
        const mapped: OutfitSuggestion[] = [];
        for (const o of dbOutfits) {
          ids.add(o._id);
          mapped.push({
            id: o._id,
            items: o.items.map((i: any) => {
              const populated = i.itemId;
              if (populated && typeof populated === 'object') {
                return { ...populated, _id: populated._id?.toString?.() || i.itemId } as ClothingItem;
              }
              return { _id: i.itemId?.toString?.() || i.itemId, category: i.category, name: i.category } as ClothingItem;
            }),
            occasion: o.occasion || 'casual',
            reasoning: o.description || 'Saved outfit',
            title: o.name,
          });
        }
        setSavedOutfits(ids);
        setSavedOutfitsList(mapped);
      }
    } catch {
      // Saved outfits are optional
    }
  };

  const generateOutfits = async () => {
    // Check if user has acknowledged AI misuse warning
    const acknowledged = await hasAcknowledgedWarning();
    if (!acknowledged) {
      setPendingGenerate(true);
      setShowWarning(true);
      return;
    }
    
    // Proceed with generation
    const nextVariant = generationVariant + 1;
    setGenerationVariant(nextVariant);
    await performGeneration(nextVariant);
  };

  const performGeneration = async (variant: number) => {
    if (wardrobe.length < 2) {
      Alert.alert(t('stylist.emptyTitle'), t('stylist.addMoreItemsFirst'));
      return;
    }
    if (!userId) {
      Alert.alert(t('common.error'), t('stylist.loginToGenerate'));
      return;
    }
    setLoading(true);
    setDataReady(false);
    setShowResults(false);
    try {
      const rainConditions = ['rain', 'drizzle', 'thunderstorm', 'shower'];
      const fSummary = forecast?.summary;
      const weatherContext = weather ? {
        needsLayers: weather.temperature < 15 || !!(fSummary?.tempSwing && fSummary.tempSwing > 8),
        hasRainRisk: rainConditions.some(r => weather.condition?.toLowerCase().includes(r)) || (fSummary?.hasRainRisk ?? false),
        tempSwing: fSummary?.tempSwing || 0,
      } : undefined;

      const recommendations = await getRecommendations({
        userId,
        occasion: occasion.toLowerCase(),
        timeOfDay: timeOfDay.toLowerCase(),
        weather: weather ? (weather.temperature > 25 ? 'hot' : weather.temperature > 20 ? 'warm' : weather.temperature > 10 ? 'cool' : 'cold') : undefined,
        limit: 3,
        variant: `${occasion.toLowerCase()}-${timeOfDay.toLowerCase()}-${variant}`,
        forecast: weatherContext,
        weatherDetail: weather ? {
          category: weather.weatherCategory,
          temperature: weather.temperature,
          condition: weather.condition,
          humidity: weather.humidity,
          windSpeed: weather.windSpeed,
        } : undefined,
      });

      const mappedOutfits: OutfitSuggestion[] = recommendations.map((rec) => {
        const mappedItems: ClothingItem[] = rec.items.map((item) => {
          const fullItem = wardrobe.find(w => 
            w._id?.toString() === item.id || 
            w._id === item.id ||
            (w.name === item.name && w.category === item.category)
          );
          
          if (fullItem) return fullItem;
          
          return {
            _id: item.id,
            name: item.name || 'Unknown Item',
            category: item.category,
            color: item.color,
            imageUrl: item.imageUrl,
            style: item.style,
            pattern: item.pattern,
            subcategory: item.category,
          } as ClothingItem;
        }).filter(Boolean) as ClothingItem[];

        return {
          id: rec.id,
          items: mappedItems,
          occasion: rec.occasion || occasion,
          reasoning: rec.description || rec.reasons?.join('. ') || 'Perfectly styled outfit for you',
          title: rec.title,
          description: rec.description,
        };
      });

      setOutfits(mappedOutfits);
      // Signal the loader that data is ready — it will animate to 100% then reveal
      setDataReady(true);
    } catch (err: any) {
      console.log('Failed to generate outfits', err);
      console.log('Error details:', {
        message: err?.message,
        status: err?.status,
        data: err?.data,
        stack: err?.stack,
      });
      
      if (err?.status === 403 && (err?.data?.error === 'daily_limit_reached' || err?.data?.error === 'upgrade_required')) {
        Alert.alert(
          t('stylist.dailyLimitTitle'),
          err?.data?.message || 'You\'ve used all your free recommendations for today. Upgrade to Pro for unlimited.',
        );
      } else {
        let errorMessage = 'Could not generate outfits. Try again.';
        if (err?.data?.error) {
          errorMessage = err.data.error;
        } else if (err?.message) {
          errorMessage = err.message;
        } else if (err?.status === 500) {
          errorMessage = 'Server error. Please try again later.';
        } else if (err?.status === 400) {
          errorMessage = 'Invalid request. Please check your wardrobe.';
        } else if (err?.status === 401) {
          errorMessage = 'Please log in again.';
        }
        Alert.alert('Oops', errorMessage);
      }
      // On error, immediately clear loading
      setLoading(false);
      setShowResults(true);
    }
  };

  const getItemIds = (outfit: OutfitSuggestion): string[] =>
    outfit.items.map((i: any) => i._id || i.id).filter(Boolean);

  const handleSave = async (outfit: OutfitSuggestion) => {
    if (!userId) return;
    setSavedOutfits((prev) => new Set(prev).add(outfit.id));
    setSavedOutfitsList((prev) => {
      if (prev.find(o => o.id === outfit.id)) return prev;
      return [...prev, outfit];
    });

    const itemIds = getItemIds(outfit);

    // Persist to database so outfit survives navigation
    try {
      await createOutfit({
        userId,
        name: outfit.title || `${outfit.occasion} outfit`,
        description: outfit.reasoning,
        items: outfit.items.map(i => ({
          itemId: i._id,
          category: i.category,
        })),
        occasion: occasion.toLowerCase(),
        weather: weather?.weatherCategory,
        tags: [timeOfDay.toLowerCase()],
      });
    } catch (err: any) {
      if (err?.status !== 409) {
        console.log('Failed to persist outfit:', err?.message);
      }
    }

    // Record feedback for ML learning
    submitOutfitFeedback({
      userId,
      outfitId: outfit.id,
      itemIds,
      occasion: occasion.toLowerCase(),
      timeOfDay: timeOfDay.toLowerCase(),
      action: 'saved',
    }).catch(() => {});
  };

  const handleReject = async (outfit: OutfitSuggestion) => {
    if (!userId) return;
    setOutfits((prev) => prev.filter((o) => o.id !== outfit.id));
    await submitOutfitFeedback({
      userId,
      outfitId: outfit.id,
      itemIds: getItemIds(outfit),
      occasion: occasion.toLowerCase(),
      timeOfDay: timeOfDay.toLowerCase(),
      action: 'rejected',
    });
  };

  const handleRate = async (outfit: OutfitSuggestion, rating: number) => {
    if (!userId) return;
    setRatings((prev) => ({ ...prev, [outfit.id]: rating }));
    await submitOutfitFeedback({
      userId,
      outfitId: outfit.id,
      itemIds: getItemIds(outfit),
      occasion: occasion.toLowerCase(),
      timeOfDay: timeOfDay.toLowerCase(),
      action: 'rated',
      rating,
    });
  };

  const handleWarningAcknowledge = () => {
    setShowWarning(false);
    if (pendingGenerate) {
      setPendingGenerate(false);
      const nextVariant = generationVariant + 1;
      setGenerationVariant(nextVariant);
      void performGeneration(nextVariant);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* AI Misuse Warning */}
      <AIMisuseWarning
        visible={showWarning}
        onAcknowledge={handleWarningAcknowledge}
      />
      
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{t('stylist.title')}</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('stylist.subtitle')}</Text>
          </View>
          {savedOutfitsList.length > 0 && (
            <TouchableOpacity 
              style={styles.savedButton} 
              onPress={() => setShowSaved(!showSaved)}
            >
              <Ionicons name={showSaved ? "sparkles" : "heart"} size={16} color={colors.primary} />
              <Text style={styles.savedButtonText}>
                {showSaved ? 'New' : `Saved (${savedOutfitsList.length})`}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Weather Card */}
        <TouchableOpacity 
          style={[styles.weatherCard, { backgroundColor: colors.card }]} 
          onPress={() => setShowDestinationPicker(true)}
        >
          <View style={styles.weatherLeft}>
            {loadingWeather ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : weather ? (
              <>
                <Ionicons 
                  name={weather.condition === 'rain' ? 'rainy' : weather.condition === 'clouds' ? 'cloudy' : 'sunny'} 
                  size={28} 
                  color={colors.accent} 
                />
                <View style={styles.weatherInfo}>
                  <Text style={styles.weatherTemp}>{weather.temperature}°C</Text>
                  <Text style={styles.weatherCity}>
                    {isCurrentLocation ? '📍 ' : '✈️ '}{weather.city}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <Ionicons name="location-outline" size={28} color={colors.textMuted} />
                <Text style={styles.weatherCity}>Add location</Text>
              </>
            )}
          </View>
          <View style={styles.weatherRight}>
            <Text style={styles.weatherAction}>
              {isCurrentLocation ? 'Traveling?' : 'Change'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </View>
        </TouchableOpacity>

        {/* Forecast Preview */}
        {forecast && !isCurrentLocation && (
          <View style={styles.forecastPreview}>
            <View style={styles.forecastItem}>
              <Ionicons name="sunny-outline" size={14} color={colors.accent} />
              <Text style={styles.forecastText}>AM: {forecast.periods.morning?.avgTemp ?? '—'}°</Text>
            </View>
            <View style={styles.forecastItem}>
              <Ionicons name="sunny" size={14} color={colors.warning} />
              <Text style={styles.forecastText}>PM: {forecast.periods.afternoon?.avgTemp ?? '—'}°</Text>
            </View>
            <View style={styles.forecastItem}>
              <Ionicons name="moon-outline" size={14} color={colors.secondary} />
              <Text style={styles.forecastText}>Eve: {forecast.periods.evening?.avgTemp ?? '—'}°</Text>
            </View>
            {forecast.summary.hasRainRisk && (
              <View style={styles.forecastItem}>
                <Ionicons name="rainy" size={14} color={colors.secondary} />
                <Text style={styles.forecastText}>Rain likely</Text>
              </View>
            )}
          </View>
        )}

        {/* Destination Picker Modal */}
        <DestinationPicker
          visible={showDestinationPicker}
          onClose={() => setShowDestinationPicker(false)}
          onSelectDestination={handleSelectDestination}
          currentLocationWeather={currentLocationWeather}
        />

        {/* Occasion Pills */}
        <Text style={styles.label}>{t('planner.occasion')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled style={styles.pillRow} contentContainerStyle={{ paddingRight: 8 }}>
          {OCCASION_KEYS.map((o) => (
            <TouchableOpacity
              key={o}
              activeOpacity={0.75}
              style={[styles.pill, occasion === o && styles.pillActive]}
              onPress={() => setOccasion(o)}
            >
              <Text style={[styles.pillText, occasion === o && styles.pillTextActive]}>{o}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Time Pills */}
        <Text style={styles.label}>{t('planner.timeOfDay')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled style={styles.pillRow} contentContainerStyle={{ paddingRight: 8 }}>
          {TIME_KEYS.map((timeKey) => (
            <TouchableOpacity
              key={timeKey}
              activeOpacity={0.75}
              style={[styles.pill, timeOfDay === timeKey && styles.pillActive]}
              onPress={() => setTimeOfDay(timeKey)}
            >
              <Text style={[styles.pillText, timeOfDay === timeKey && styles.pillTextActive]}>{timeKey}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Generate Button */}
        <TouchableOpacity
          style={[styles.generateBtn, { backgroundColor: loading ? colors.textMuted : colors.primary }]}
          onPress={generateOutfits}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Ionicons name="sparkles" size={18} color={colors.textOnPrimary} />
          <Text style={[styles.generateText, { color: colors.textOnPrimary }]}>
            {loading ? t('stylist.generating').toUpperCase() : t('stylist.generateOutfits').toUpperCase()}
          </Text>
        </TouchableOpacity>

        {/* Loading Animation */}
        {loading && (
          <StylingLoader
            occasion={occasion}
            timeOfDay={timeOfDay}
            done={dataReady}
            onFinished={() => { setLoading(false); setShowResults(true); }}
          />
        )}

        {/* Outfit Cards */}
        {showResults && (showSaved ? savedOutfitsList : outfits).map((outfit) => (
          <View key={outfit.id} style={[styles.outfitCard, { backgroundColor: colors.card }]}>
            <Text style={styles.outfitTitle} numberOfLines={2} ellipsizeMode="tail">{outfit.title || `Outfit for ${outfit.occasion}`}</Text>
            <View style={styles.itemsRow}>
              {outfit.items.map((item) => {
                // Try multiple image sources in order of preference
                const imageSource = item.imageUrl || item.thumbnailUrl || item.mediumUrl || null;
                const hasValidImage = imageSource && 
                  (imageSource.startsWith('http') || imageSource.startsWith('https')) &&
                  !failedImages.has(item._id);
                
                return (
                  <View key={item._id} style={styles.itemThumb}>
                    {hasValidImage ? (
                      <Image 
                        source={{ uri: imageSource }} 
                        style={styles.itemImage}
                        onError={() => {
                          // Mark this image as failed so we show placeholder
                          setFailedImages(prev => new Set(prev).add(item._id));
                          console.log('Failed to load image for item:', item._id, imageSource);
                        }}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.itemPlaceholder}>
                        <Ionicons 
                          name={
                            item.category === 'top' ? 'shirt-outline' :
                            item.category === 'bottom' ? 'body-outline' :
                            item.category === 'shoes' ? 'footsteps-outline' :
                            item.category === 'dress' ? 'shirt-outline' :
                            item.category === 'outerwear' ? 'shirt-outline' :
                            item.category === 'accessory' ? 'diamond-outline' :
                            'cube-outline'
                          } 
                          size={28} 
                          color={colors.textMuted} 
                        />
                      </View>
                    )}
                    <Text style={styles.itemName} numberOfLines={1}>
                      {item.name || item.subcategory || item.category}
                    </Text>
                  </View>
                );
              })}
            </View>
            <Text style={styles.reasoning} numberOfLines={4} ellipsizeMode="tail">{outfit.reasoning}</Text>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                activeOpacity={0.75}
                style={[styles.actionBtn, savedOutfits.has(outfit.id) && styles.savedBtn]}
                onPress={() => handleSave(outfit)}
              >
                <Ionicons
                  name={savedOutfits.has(outfit.id) ? 'heart' : 'heart-outline'}
                  size={18}
                  color={savedOutfits.has(outfit.id) ? colors.primary : colors.textSecondary}
                />
                <Text style={styles.actionText}>Save</Text>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.75} style={styles.actionBtn} onPress={() => handleReject(outfit)}>
                <Ionicons name="close-circle-outline" size={18} color={colors.textMuted} />
                <Text style={styles.actionText}>Skip</Text>
              </TouchableOpacity>
            </View>

            {/* Star Rating */}
            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }} onPress={() => handleRate(outfit, star)}>
                  <Ionicons
                    name={(ratings[outfit.id] || 0) >= star ? 'star' : 'star-outline'}
                    size={24}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {outfits.length === 0 && !loading && showResults && (
          <Text style={styles.emptyText}>
            {t('stylist.tapToGenerate')}
          </Text>
        )}
      </ScrollView>

    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: scale(18), paddingTop: verticalScale(12), paddingBottom: verticalScale(120) },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: verticalScale(18) },
  weatherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: scale(14),
    padding: scale(14),
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  weatherLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
  },
  weatherInfo: {
    marginLeft: scale(4),
  },
  weatherTemp: {
    fontSize: scale(18),
    fontWeight: '300',
    letterSpacing: -0.3,
    color: colors.textPrimary,
  },
  weatherCity: {
    fontSize: scale(12),
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
  weatherRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  weatherAction: {
    fontSize: scale(11),
    color: colors.primary,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  forecastPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(6),
    marginBottom: spacing.md,
  },
  forecastItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    backgroundColor: colors.cardSoft,
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(5),
    borderRadius: scale(10),
  },
  forecastText: {
    fontSize: scale(11),
    color: colors.textSecondary,
    letterSpacing: 0.1,
  },
  savedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    backgroundColor: colors.primarySoft,
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(7),
    borderRadius: scale(20),
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  savedButtonText: { color: colors.primary, fontSize: scale(12), fontWeight: '600', letterSpacing: 0.3 },
  title: { fontSize: scale(22), fontWeight: '300', letterSpacing: -0.5, color: colors.textPrimary, marginBottom: verticalScale(2) },
  subtitle: { fontSize: scale(12), color: colors.textMuted, letterSpacing: 0.2, marginBottom: verticalScale(14) },
  label: { fontSize: scale(10), color: colors.textMuted, fontWeight: '600', letterSpacing: 1.8, textTransform: 'uppercase', marginBottom: verticalScale(8), marginTop: verticalScale(14) },
  pillRow: { flexDirection: 'row', marginBottom: verticalScale(6), flexGrow: 0 },
  pill: {
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(8),
    backgroundColor: 'transparent',
    borderRadius: scale(20),
    marginRight: scale(6),
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { color: colors.textMuted, fontSize: scale(13), fontWeight: '500', letterSpacing: 0.1 },
  pillTextActive: { color: colors.textOnPrimary, fontWeight: '600' },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: verticalScale(14),
    borderRadius: scale(12),
    marginTop: verticalScale(18),
    marginBottom: verticalScale(4),
    gap: scale(8),
  },
  generateText: { color: colors.textOnPrimary, fontSize: scale(14), fontWeight: '600', letterSpacing: 0.8 },
  outfitCard: {
    backgroundColor: colors.card,
    borderRadius: scale(16),
    padding: scale(16),
    marginTop: verticalScale(18),
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  outfitTitle: { fontSize: scale(16), fontWeight: '600', letterSpacing: -0.2, color: colors.textPrimary, marginBottom: verticalScale(12) },
  itemsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(10) },
  itemThumb: { alignItems: 'center', width: ITEM_SIZE },
  itemImage: { width: ITEM_SIZE - scale(8), height: ITEM_SIZE - scale(8), borderRadius: scale(10), backgroundColor: colors.surface },
  itemPlaceholder: {
    width: ITEM_SIZE - scale(8),
    height: ITEM_SIZE - scale(8),
    borderRadius: scale(10),
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: { fontSize: scale(10), color: colors.textMuted, marginTop: verticalScale(4), textAlign: 'center', letterSpacing: 0.1 },
  reasoning: { fontSize: scale(12), color: colors.textSecondary, marginTop: verticalScale(14), lineHeight: scale(18), letterSpacing: 0.1 },
  actions: { flexDirection: 'row', gap: scale(10), marginTop: verticalScale(16) },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    paddingVertical: verticalScale(9),
    paddingHorizontal: scale(18),
    backgroundColor: 'transparent',
    borderRadius: scale(20),
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  savedBtn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  actionText: { color: colors.textSecondary, fontSize: scale(13), fontWeight: '500', letterSpacing: 0.2 },
  ratingRow: { flexDirection: 'row', gap: scale(6), marginTop: verticalScale(14), justifyContent: 'center' },
  emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: verticalScale(48), fontSize: scale(13), letterSpacing: 0.2, lineHeight: scale(20) },
});

export default StylistScreen;
