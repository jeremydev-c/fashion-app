import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = (size: number) => Math.round((SCREEN_WIDTH / 393) * size);

import { fetchClothingItems, ClothingItem } from '../services/wardrobeApi';
import { getRecommendations } from '../services/recommendationsService';
import { submitOutfitFeedback } from '../services/stylistFeedback';
import { useUserId } from '../hooks/useUserId';
import { getCurrentWeather, WeatherData, WeatherForecast } from '../services/weatherService';
import { DestinationPicker } from '../components/DestinationPicker';
import { AIMisuseWarning, hasAcknowledgedWarning } from '../components/AIMisuseWarning';
import { LoadingSpinner } from '../components/LoadingSpinner';

const OCCASIONS = ['Casual', 'Work', 'Date', 'Party', 'Gym', 'Formal'];
const TIMES = ['Morning', 'Afternoon', 'Evening', 'Night'];

interface OutfitSuggestion {
  id: string;
  items: ClothingItem[];
  occasion: string;
  reasoning: string;
}

export const StylistScreen: React.FC = () => {
  const userId = useUserId();
  const [wardrobe, setWardrobe] = useState<ClothingItem[]>([]);
  const [outfits, setOutfits] = useState<OutfitSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [occasion, setOccasion] = useState('Casual');
  const [showWarning, setShowWarning] = useState(false);
  const [pendingGenerate, setPendingGenerate] = useState(false);
  
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
  }, []);

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
      console.error('Failed to get weather:', error);
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
      const items = await fetchClothingItems();
      setWardrobe(items);
    } catch (err) {
      console.error('Failed to load wardrobe', err);
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
    await performGeneration();
  };

  const performGeneration = async () => {
    if (wardrobe.length < 2) {
      alert('Add more items to your wardrobe first!');
      return;
    }
    if (!userId) {
      alert('Please log in to generate outfits');
      return;
    }
    setLoading(true);
    try {
      // Get weather context for forecast
      const weatherContext = weather ? {
        needsLayers: weather.temperature < 15,
        hasRainRisk: weather.condition === 'rain',
        tempSwing: forecast?.tempSwing || 0,
      } : undefined;

      const recommendations = await getRecommendations({
        userId,
        occasion: occasion.toLowerCase(),
        timeOfDay: timeOfDay.toLowerCase(),
        weather: weather ? (weather.temperature > 20 ? 'warm' : weather.temperature > 10 ? 'cool' : 'cold') : undefined,
        limit: 3,
        forecast: weatherContext,
      });

      // Map backend response to frontend format
      const mappedOutfits: OutfitSuggestion[] = recommendations.map((rec) => {
        // Map items - backend returns items with id, we need to find them in wardrobe
        const mappedItems: ClothingItem[] = rec.items.map((item) => {
          // Try to find the item in wardrobe by ID
          const fullItem = wardrobe.find(w => 
            w._id?.toString() === item.id || 
            w._id === item.id ||
            (w.name === item.name && w.category === item.category)
          );
          
          if (fullItem) {
            return fullItem;
          }
          
          // If not found, create a minimal item from the recommendation
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
          reasoning: rec.reasons?.join('. ') || 'Perfectly styled outfit for you',
        };
      });

      setOutfits(mappedOutfits);
    } catch (err: any) {
      console.error('Failed to generate outfits', err);
      console.error('Error details:', {
        message: err?.message,
        status: err?.status,
        data: err?.data,
        stack: err?.stack,
      });
      
      // More detailed error message
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
      
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (outfit: OutfitSuggestion) => {
    setSavedOutfits((prev) => new Set(prev).add(outfit.id));
    setSavedOutfitsList((prev) => {
      if (prev.find(o => o.id === outfit.id)) return prev;
      return [...prev, outfit];
    });
    await submitOutfitFeedback({
      outfitId: outfit.id,
      itemIds: outfit.items.map((i) => i._id),
      occasion,
      timeOfDay,
      action: 'saved',
    });
  };

  const handleReject = async (outfit: OutfitSuggestion) => {
    setOutfits((prev) => prev.filter((o) => o.id !== outfit.id));
    await submitOutfitFeedback({
      outfitId: outfit.id,
      itemIds: outfit.items.map((i) => i._id),
      occasion,
      timeOfDay,
      action: 'rejected',
    });
  };

  const handleRate = async (outfit: OutfitSuggestion, rating: number) => {
    setRatings((prev) => ({ ...prev, [outfit.id]: rating }));
    await submitOutfitFeedback({
      outfitId: outfit.id,
      itemIds: outfit.items.map((i) => i._id),
      occasion,
      timeOfDay,
      action: 'rated',
      rating,
    });
  };

  const handleWarningAcknowledge = () => {
    setShowWarning(false);
    if (pendingGenerate) {
      setPendingGenerate(false);
      performGeneration();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* AI Misuse Warning */}
      <AIMisuseWarning
        visible={showWarning}
        onAcknowledge={handleWarningAcknowledge}
      />
      
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>AI Stylist</Text>
            <Text style={styles.subtitle}>Get outfit suggestions from your wardrobe</Text>
          </View>
          {savedOutfitsList.length > 0 && (
            <TouchableOpacity 
              style={styles.savedButton} 
              onPress={() => setShowSaved(!showSaved)}
            >
              <Ionicons name={showSaved ? "sparkles" : "heart"} size={18} color="#fff" />
              <Text style={styles.savedButtonText}>
                {showSaved ? 'New' : `Saved (${savedOutfitsList.length})`}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Weather Card */}
        <TouchableOpacity 
          style={styles.weatherCard} 
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
              <Text style={styles.forecastText}>AM: {forecast.periods.morning?.avgTemp}°</Text>
            </View>
            <View style={styles.forecastItem}>
              <Ionicons name="sunny" size={14} color={colors.warning} />
              <Text style={styles.forecastText}>PM: {forecast.periods.afternoon?.avgTemp}°</Text>
            </View>
            <View style={styles.forecastItem}>
              <Ionicons name="moon-outline" size={14} color={colors.secondary} />
              <Text style={styles.forecastText}>Eve: {forecast.periods.evening?.avgTemp}°</Text>
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
        <Text style={styles.label}>Occasion</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
          {OCCASIONS.map((o) => (
            <TouchableOpacity
              key={o}
              style={[styles.pill, occasion === o && styles.pillActive]}
              onPress={() => setOccasion(o)}
            >
              <Text style={[styles.pillText, occasion === o && styles.pillTextActive]}>{o}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Time Pills */}
        <Text style={styles.label}>Time of Day</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
          {TIMES.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.pill, timeOfDay === t && styles.pillActive]}
              onPress={() => setTimeOfDay(t)}
            >
              <Text style={[styles.pillText, timeOfDay === t && styles.pillTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Generate Button */}
        <TouchableOpacity style={styles.generateBtn} onPress={generateOutfits} disabled={loading}>
          {loading ? (
            <LoadingSpinner size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="sparkles" size={20} color="#fff" />
              <Text style={styles.generateText}>Generate Outfits</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Outfit Cards */}
        {(showSaved ? savedOutfitsList : outfits).map((outfit) => (
          <View key={outfit.id} style={styles.outfitCard}>
            <Text style={styles.outfitTitle}>Outfit for {outfit.occasion}</Text>
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
                            item.category === 'outerwear' ? 'coat-outline' :
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
            <Text style={styles.reasoning}>{outfit.reasoning}</Text>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionBtn, savedOutfits.has(outfit.id) && styles.savedBtn]}
                onPress={() => handleSave(outfit)}
              >
                <Ionicons
                  name={savedOutfits.has(outfit.id) ? 'heart' : 'heart-outline'}
                  size={20}
                  color={savedOutfits.has(outfit.id) ? '#f43f5e' : '#fff'}
                />
                <Text style={styles.actionText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleReject(outfit)}>
                <Ionicons name="close-circle-outline" size={20} color="#fff" />
                <Text style={styles.actionText}>Skip</Text>
              </TouchableOpacity>
            </View>

            {/* Star Rating */}
            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => handleRate(outfit, star)}>
                  <Ionicons
                    name={(ratings[outfit.id] || 0) >= star ? 'star' : 'star-outline'}
                    size={24}
                    color="#facc15"
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {outfits.length === 0 && !loading && (
          <Text style={styles.emptyText}>
            Tap "Generate Outfits" to get AI suggestions based on your wardrobe.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 20, paddingBottom: 100 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  // Weather styles
  weatherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  weatherLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  weatherInfo: {
    marginLeft: spacing.sm,
  },
  weatherTemp: {
    fontSize: scale(20),
    fontWeight: '700',
    color: colors.textPrimary,
  },
  weatherCity: {
    fontSize: scale(13),
    color: colors.textSecondary,
  },
  weatherRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  weatherAction: {
    fontSize: scale(13),
    color: colors.primary,
    fontWeight: '600',
  },
  forecastPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  forecastItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.cardSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  forecastText: {
    fontSize: scale(12),
    color: colors.textSecondary,
  },
  savedButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    backgroundColor: colors.primary, 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 20 
  },
  savedButtonText: { color: '#fff', fontSize: scale(13), fontWeight: '600' },
  title: { fontSize: scale(28), fontWeight: '700', color: colors.textPrimary, marginBottom: scale(4) },
  subtitle: { fontSize: scale(14), color: colors.textMuted, marginBottom: scale(20) },
  label: { fontSize: scale(14), color: colors.textSecondary, marginBottom: scale(8), marginTop: scale(12) },
  pillRow: { flexDirection: 'row', marginBottom: 8 },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(148,163,184,0.15)',
    borderRadius: 20,
    marginRight: 8,
  },
  pillActive: { backgroundColor: colors.primary },
  pillText: { color: colors.textSecondary, fontSize: scale(14) },
  pillTextActive: { color: '#fff', fontWeight: '600' },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 20,
    gap: 8,
  },
  generateText: { color: '#fff', fontSize: scale(16), fontWeight: '600' },
  outfitCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
  },
  outfitTitle: { fontSize: scale(18), fontWeight: '600', color: colors.textPrimary, marginBottom: scale(12) },
  itemsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(12) },
  itemThumb: { alignItems: 'center', width: scale(70) },
  itemImage: { width: scale(60), height: scale(60), borderRadius: scale(8), backgroundColor: '#1e293b' },
  itemPlaceholder: {
    width: scale(60),
    height: scale(60),
    borderRadius: scale(8),
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: { fontSize: scale(11), color: colors.textMuted, marginTop: scale(4), textAlign: 'center' },
  reasoning: { fontSize: scale(13), color: colors.textSecondary, marginTop: scale(12), lineHeight: scale(18) },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(148,163,184,0.15)',
    borderRadius: 20,
  },
  savedBtn: { backgroundColor: 'rgba(244,63,94,0.2)' },
  actionText: { color: '#fff', fontSize: scale(14) },
  ratingRow: { flexDirection: 'row', gap: scale(4), marginTop: scale(12), justifyContent: 'center' },
  emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: scale(40), fontSize: scale(14) },
});

export default StylistScreen;
