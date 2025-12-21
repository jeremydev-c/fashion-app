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
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = (size: number) => Math.round((SCREEN_WIDTH / 393) * size);
import {
  fetchPlannedOutfits,
  createPlannedOutfit,
  deletePlannedOutfit,
  PlannedOutfit,
} from '../services/plannerApi';
import { fetchClothingItems, ClothingItem } from '../services/wardrobeApi';
import { generateAIOutfits } from '../services/openAiStylist';

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
  const [weekDates] = useState(getWeekDates());
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [occasion, setOccasion] = useState('Casual');
  const [timeOfDay, setTimeOfDay] = useState('Morning');
  const [planned, setPlanned] = useState<PlannedOutfit[]>([]);
  const [wardrobe, setWardrobe] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const [outfits, items] = await Promise.all([fetchPlannedOutfits(), fetchClothingItems()]);
      setPlanned(outfits);
      setWardrobe(items);
    } catch (err) {
      console.error(err);
    }
  };

  const planOutfit = async () => {
    if (wardrobe.length < 2) {
      Alert.alert('Add more items', 'You need at least 2 items in your wardrobe.');
      return;
    }
    setLoading(true);
    try {
      const suggestions = await generateAIOutfits(wardrobe, occasion, timeOfDay);
      if (suggestions.length > 0) {
        const outfit = suggestions[0];
        await createPlannedOutfit({
          date: selectedDate,
          title: `${occasion} outfit`,
          occasion,
          timeOfDay,
          itemIds: outfit.items.map((i) => i._id),
        });
        await load();
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not plan outfit.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deletePlannedOutfit(id);
    await load();
  };

  const plannedForDate = planned.filter((p) => p.date === selectedDate);

  const getItemById = (id: string) => wardrobe.find((w) => w._id === id);

  return (
    <SafeAreaView style={styles.container}>
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
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="sparkles" size={20} color="#fff" />
              <Text style={styles.planBtnText}>Plan AI outfit for this day</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Planned Outfits */}
        <Text style={styles.sectionTitle}>Planned for {selectedDate}</Text>
        {plannedForDate.length === 0 ? (
          <Text style={styles.emptyText}>No outfits planned yet.</Text>
        ) : (
          plannedForDate.map((p) => (
            <View key={p._id} style={styles.plannedCard}>
              <View style={styles.plannedHeader}>
                <Text style={styles.plannedTitle}>{p.title}</Text>
                <TouchableOpacity onPress={() => handleDelete(p._id)}>
                  <Ionicons name="trash-outline" size={20} color="#f43f5e" />
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
                          <Ionicons name="shirt-outline" size={24} color={colors.textMuted} />
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 20, paddingBottom: 100 },
  title: { fontSize: scale(28), fontWeight: '700', color: colors.textPrimary, marginBottom: scale(4) },
  subtitle: { fontSize: scale(14), color: colors.textMuted, marginBottom: scale(16) },
  weekStrip: { marginBottom: scale(20) },
  dayCard: {
    width: scale(56),
    paddingVertical: scale(12),
    alignItems: 'center',
    backgroundColor: 'rgba(148,163,184,0.1)',
    borderRadius: scale(12),
    marginRight: scale(10),
  },
  dayCardActive: { backgroundColor: colors.primary },
  dayName: { fontSize: scale(12), color: colors.textMuted, marginBottom: scale(4) },
  dayNum: { fontSize: scale(18), fontWeight: '600', color: colors.textPrimary },
  dayTextActive: { color: '#fff' },
  label: { fontSize: scale(14), color: colors.textSecondary, marginBottom: scale(8), marginTop: scale(8) },
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
  planBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: scale(14),
    borderRadius: scale(12),
    marginTop: scale(16),
    gap: scale(8),
  },
  planBtnText: { color: '#fff', fontSize: scale(16), fontWeight: '600' },
  sectionTitle: {
    fontSize: scale(18),
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: scale(28),
    marginBottom: scale(12),
  },
  emptyText: { color: colors.textMuted, fontSize: scale(14) },
  plannedCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  plannedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  plannedTitle: { fontSize: scale(16), fontWeight: '600', color: colors.textPrimary },
  itemsRow: { flexDirection: 'row', gap: scale(10) },
  itemThumb: { width: scale(50), height: scale(50) },
  itemImage: { width: scale(50), height: scale(50), borderRadius: scale(8), backgroundColor: '#1e293b' },
  itemPlaceholder: {
    width: scale(50),
    height: scale(50),
    borderRadius: scale(8),
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default PlannerScreen;
