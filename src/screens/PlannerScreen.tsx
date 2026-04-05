import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useThemeColors } from '../theme/ThemeProvider';
import { scale, verticalScale } from '../utils/responsive';
import {
  fetchPlannedOutfits,
  createPlannedOutfit,
  deletePlannedOutfit,
  PlannedOutfit,
} from '../services/plannerApi';
import { fetchWardrobeItems, ClothingItem } from '../services/wardrobeApi';
import { getRecommendations } from '../services/recommendationsService';
import { submitOutfitFeedback } from '../services/stylistFeedback';
import { useUserId } from '../hooks/useUserId';
import { getCurrentWeather, WeatherData } from '../services/weatherService';
import * as Location from 'expo-location';

const OCCASIONS = ['Casual', 'Work', 'Date', 'Party', 'Gym', 'Formal'];
const TIMES = ['Morning', 'Afternoon', 'Evening', 'Night'];

const getWeekDates = () => {
  const today = new Date();
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d);
  }
  return dates;
};

const formatDate = (d: Date) => d.toISOString().split('T')[0];
const dayName = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short' });
const dayNum = (d: Date) => d.getDate();

export const PlannerScreen: React.FC = () => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const userId = useUserId();
  const [weekDates] = useState(getWeekDates());
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [occasion, setOccasion] = useState('Casual');
  const [timeOfDay, setTimeOfDay] = useState('Morning');
  const [planned, setPlanned] = useState<PlannedOutfit[]>([]);
  const [wardrobe, setWardrobe] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [upgradeWall, setUpgradeWall] = useState(false);

  useEffect(() => {
    load();
    loadWeather();
  }, [userId]);

  const load = async () => {
    try {
      const [outfits, items] = await Promise.all([userId ? fetchPlannedOutfits(userId) : Promise.resolve([]), userId ? fetchWardrobeItems(userId) : Promise.resolve([])]);
      setPlanned(outfits);
      setWardrobe(items);
      setUpgradeWall(false);
    } catch (err: any) {
      if (err?.status === 403 && (err?.data?.error === 'upgrade_required' || err?.message?.includes('upgrade'))) {
        setUpgradeWall(true);
      }
      console.log(err);
    }
  };

  const loadWeather = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const location = await Location.getCurrentPositionAsync({});
      const data = await getCurrentWeather(location.coords.latitude, location.coords.longitude);
      setWeather(data);
    } catch {
      // Weather is optional for planner
    }
  };

  const planOutfit = async () => {
    if (wardrobe.length < 2) {
      Alert.alert('Add more items', 'You need at least 2 items in your wardrobe.');
      return;
    }
    if (!userId) {
      Alert.alert('Error', 'Please log in to plan outfits.');
      return;
    }
    setLoading(true);
    try {
      const rainConditions = ['rain', 'drizzle', 'thunderstorm', 'shower'];
      const recommendations = await getRecommendations({
        userId,
        occasion: occasion.toLowerCase(),
        timeOfDay: timeOfDay.toLowerCase(),
        weather: weather ? (weather.temperature > 25 ? 'hot' : weather.temperature > 20 ? 'warm' : weather.temperature > 10 ? 'cool' : 'cold') : undefined,
        limit: 1,
        forecast: weather ? {
          needsLayers: weather.temperature < 15,
          hasRainRisk: rainConditions.some(r => weather.condition?.toLowerCase().includes(r)),
        } : undefined,
        weatherDetail: weather ? {
          category: weather.weatherCategory,
          temperature: weather.temperature,
          condition: weather.condition,
          humidity: weather.humidity,
          windSpeed: weather.windSpeed,
        } : undefined,
      });

      if (recommendations.length === 0) {
        Alert.alert('No Outfits Found', 'Could not generate an outfit for this combination. Try a different occasion or time.');
        return;
      }

      const rec = recommendations[0];
      const itemIds = rec.items
        .map(item => {
          const match = wardrobe.find(
            w => w._id?.toString() === item.id || w._id === item.id
          );
          return match?._id;
        })
        .filter(Boolean) as string[];

      if (itemIds.length === 0) {
        Alert.alert('Matching Failed', 'Could not match recommended items to your wardrobe. Try again.');
        return;
      }

      await createPlannedOutfit({
        userId,
        date: selectedDate,
        title: (rec as any).title || `${occasion} outfit`,
        occasion,
        timeOfDay,
        itemIds,
      });
      submitOutfitFeedback({
        userId,
        outfitId: rec.id || `planned_${Date.now()}`,
        itemIds,
        occasion: occasion.toLowerCase(),
        timeOfDay: timeOfDay.toLowerCase(),
        action: 'saved',
      }).catch(() => {});
      await load();
    } catch (err) {
      console.log(err);
      Alert.alert('Error', 'Could not plan outfit.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Remove Planned Outfit',
      'Are you sure you want to remove this planned outfit?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePlannedOutfit(id);
              await load();
            } catch (err) {
              Alert.alert('Error', 'Could not delete this outfit. Please try again.');
            }
          },
        },
      ],
    );
  };

  const plannedForDate = planned.filter((p) => p.date === selectedDate);

  const getItemById = (id: string) => wardrobe.find((w) => w._id === id);

  if (upgradeWall) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top, justifyContent: 'center', alignItems: 'center', paddingHorizontal: scale(32) }]}>
        <Ionicons name="lock-closed" size={scale(48)} color={colors.primary} />
        <Text style={[styles.title, { textAlign: 'center', marginTop: verticalScale(16) }]}>Outfit Planner</Text>
        <Text style={[styles.subtitle, { textAlign: 'center', marginTop: verticalScale(8) }]}>
          Plan your outfits for the week ahead. Upgrade to Pro to unlock this feature.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Outfit Planner</Text>
        <Text style={styles.subtitle}>Plan your looks for the week</Text>

        {/* Week Strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekStrip}>
          {weekDates.map((d) => {
            const dateStr = formatDate(d);
            const isSelected = dateStr === selectedDate;
            return (
              <TouchableOpacity
                key={dateStr}
                style={[styles.dayCard, isSelected && styles.dayCardActive]}
                onPress={() => setSelectedDate(dateStr)}
              >
                <Text style={[styles.dayName, isSelected && styles.dayTextActive]}>
                  {dayName(d)}
                </Text>
                <Text style={[styles.dayNum, isSelected && styles.dayTextActive]}>{dayNum(d)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

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

        {/* Plan Button */}
        <TouchableOpacity style={styles.planBtn} onPress={planOutfit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.textOnPrimary} />
          ) : (
            <>
              <Ionicons name="sparkles" size={scale(16)} color={colors.textOnPrimary} />
              <Text style={[styles.planBtnText, { color: colors.textOnPrimary }]}>PLAN AI OUTFIT</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Planned Outfits */}
        <Text style={styles.sectionTitle}>Planned for {selectedDate}</Text>
        {plannedForDate.length === 0 ? (
          <Text style={styles.emptyText}>No outfits planned yet.</Text>
        ) : (
          plannedForDate.map((p) => (
            <View key={p._id} style={[styles.plannedCard, { backgroundColor: colors.card }]}>
              <View style={styles.plannedHeader}>
                <Text style={styles.plannedTitle}>{p.title}</Text>
                <TouchableOpacity onPress={() => handleDelete(p._id)}>
                  <Ionicons name="trash-outline" size={scale(18)} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              <View style={styles.itemsRow}>
                {p.itemIds.map((id) => {
                  const item = getItemById(id);
                  return (
                    <View key={id} style={styles.itemThumb}>
                      {item?.imageUrl ? (
                        <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
                      ) : (
                        <View style={styles.itemPlaceholder}>
                          <Ionicons name="shirt-outline" size={scale(24)} color={colors.textMuted} />
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: {
    paddingHorizontal: scale(18),
    paddingTop: verticalScale(12),
    paddingBottom: verticalScale(120),
  },
  title: {
    fontSize: scale(24),
    fontWeight: '300',
    letterSpacing: -0.5,
    color: colors.textPrimary,
    marginBottom: verticalScale(2),
  },
  subtitle: { fontSize: scale(12), color: colors.textMuted, letterSpacing: 0.2, marginBottom: verticalScale(18) },
  weekStrip: { marginBottom: verticalScale(22) },
  dayCard: {
    width: scale(52),
    paddingVertical: verticalScale(12),
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: scale(14),
    marginRight: scale(8),
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  dayCardActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayName: { fontSize: scale(10), color: colors.textMuted, letterSpacing: 0.8, fontWeight: '500', marginBottom: verticalScale(4) },
  dayNum: { fontSize: scale(17), fontWeight: '300', color: colors.textPrimary, letterSpacing: -0.3 },
  dayTextActive: { color: colors.textOnPrimary },
  label: {
    fontSize: scale(10),
    color: colors.textMuted,
    fontWeight: '600',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: verticalScale(8),
    marginTop: verticalScale(10),
  },
  pillRow: { flexDirection: 'row', marginBottom: verticalScale(6) },
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
  planBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: verticalScale(14),
    borderRadius: scale(12),
    marginTop: verticalScale(18),
    gap: scale(8),
  },
  planBtnText: { color: colors.textOnPrimary, fontSize: scale(13), fontWeight: '600', letterSpacing: 0.8 },
  sectionTitle: {
    fontSize: scale(10),
    fontWeight: '600',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginTop: verticalScale(28),
    marginBottom: verticalScale(14),
  },
  emptyText: { color: colors.textMuted, fontSize: scale(13), letterSpacing: 0.2 },
  plannedCard: {
    backgroundColor: colors.card,
    borderRadius: scale(14),
    padding: scale(16),
    marginBottom: verticalScale(10),
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  plannedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(12),
  },
  plannedTitle: { fontSize: scale(15), fontWeight: '600', letterSpacing: -0.1, color: colors.textPrimary },
  itemsRow: { flexDirection: 'row', gap: scale(8) },
  itemThumb: { width: scale(50), height: scale(50) },
  itemImage: { width: scale(50), height: scale(50), borderRadius: scale(10), backgroundColor: colors.surface },
  itemPlaceholder: {
    width: scale(50),
    height: scale(50),
    borderRadius: scale(10),
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default PlannerScreen;
