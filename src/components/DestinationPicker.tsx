import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { getWeatherByCity, getWeatherForecast, type WeatherData, type WeatherForecast } from '../services/weatherService';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelectDestination: (weather: WeatherData, isCurrentLocation: boolean, forecast?: WeatherForecast) => void;
  currentLocationWeather: WeatherData | null;
};

// Popular cities for quick selection
const POPULAR_CITIES = [
  'Nairobi',
  'Mombasa',
  'Kisumu',
  'Nakuru',
  'Eldoret',
  'Nyeri',
  'Malindi',
  'Nanyuki',
];

export const DestinationPicker: React.FC<Props> = ({
  visible,
  onClose,
  onSelectDestination,
  currentLocationWeather,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError('');
    setSearchResult(null);
    setForecast(null);

    try {
      // Fetch both current weather and forecast
      const [weather, forecastData] = await Promise.all([
        getWeatherByCity(searchQuery.trim()),
        getWeatherForecast(searchQuery.trim()),
      ]);
      setSearchResult(weather);
      setForecast(forecastData);
    } catch (err: any) {
      setError(err.message || 'City not found');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectCity = async (city: string) => {
    setIsSearching(true);
    setError('');

    try {
      const [weather, forecastData] = await Promise.all([
        getWeatherByCity(city),
        getWeatherForecast(city),
      ]);
      onSelectDestination(weather, false, forecastData);
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to get weather');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = () => {
    if (searchResult) {
      onSelectDestination(searchResult, false, forecast || undefined);
      handleClose();
    }
  };

  const handleUseCurrentLocation = () => {
    if (currentLocationWeather) {
      onSelectDestination(currentLocationWeather, true);
      handleClose();
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setSearchResult(null);
    setForecast(null);
    setError('');
    onClose();
  };

  const getWeatherIcon = (condition: string) => {
    switch (condition) {
      case 'rain':
        return 'rainy';
      case 'snow':
        return 'snow';
      case 'clouds':
        return 'cloudy';
      default:
        return 'sunny';
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Where are you going?</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Get outfit suggestions for your destination's weather
          </Text>

          {/* Current Location Option */}
          {currentLocationWeather && (
            <TouchableOpacity
              style={styles.currentLocationCard}
              onPress={handleUseCurrentLocation}
            >
              <View style={styles.locationIcon}>
                <Ionicons name="navigate" size={20} color={colors.primary} />
              </View>
              <View style={styles.locationInfo}>
                <Text style={styles.locationLabel}>Use current location</Text>
                <Text style={styles.locationCity}>
                  {currentLocationWeather.city} • {currentLocationWeather.temperature}°C
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search city..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoCapitalize="words"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={handleSearch} disabled={isSearching}>
                {isSearching ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="arrow-forward-circle" size={28} color={colors.primary} />
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Error */}
          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Search Result with Forecast */}
          {searchResult && (
            <View style={styles.resultContainer}>
              <TouchableOpacity style={styles.resultCard} onPress={handleSelectSearchResult}>
                <View style={styles.resultLeft}>
                  <Ionicons
                    name={getWeatherIcon(searchResult.condition)}
                    size={32}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.resultInfo}>
                  <Text style={styles.resultCity}>
                    {searchResult.city}
                    {searchResult.country && `, ${searchResult.country}`}
                  </Text>
                  <Text style={styles.resultWeather}>
                    {forecast ? `${forecast.summary.minTemp}°C - ${forecast.summary.maxTemp}°C` : `${searchResult.temperature}°C`}
                  </Text>
                  <View style={styles.resultBadge}>
                    <Text style={styles.resultBadgeText}>{searchResult.weatherCategory}</Text>
                  </View>
                </View>
                <Ionicons name="checkmark-circle" size={24} color={colors.success} />
              </TouchableOpacity>

              {/* Forecast Details */}
              {forecast && (
                <View style={styles.forecastContainer}>
                  {/* Time Periods */}
                  <View style={styles.periodsRow}>
                    {forecast.periods.morning && (
                      <View style={styles.periodCard}>
                        <Ionicons name="sunny-outline" size={16} color={colors.accent} />
                        <Text style={styles.periodLabel}>Morning</Text>
                        <Text style={styles.periodTemp}>{forecast.periods.morning.avgTemp}°C</Text>
                        {forecast.periods.morning.rainChance > 0 && (
                          <Text style={styles.rainChance}>💧 {forecast.periods.morning.rainChance}%</Text>
                        )}
                      </View>
                    )}
                    {forecast.periods.afternoon && (
                      <View style={styles.periodCard}>
                        <Ionicons name="sunny" size={16} color={colors.warning} />
                        <Text style={styles.periodLabel}>Afternoon</Text>
                        <Text style={styles.periodTemp}>{forecast.periods.afternoon.avgTemp}°C</Text>
                        {forecast.periods.afternoon.rainChance > 0 && (
                          <Text style={styles.rainChance}>💧 {forecast.periods.afternoon.rainChance}%</Text>
                        )}
                      </View>
                    )}
                    {forecast.periods.evening && (
                      <View style={styles.periodCard}>
                        <Ionicons name="moon-outline" size={16} color={colors.secondary} />
                        <Text style={styles.periodLabel}>Evening</Text>
                        <Text style={styles.periodTemp}>{forecast.periods.evening.avgTemp}°C</Text>
                        {forecast.periods.evening.rainChance > 0 && (
                          <Text style={styles.rainChance}>💧 {forecast.periods.evening.rainChance}%</Text>
                        )}
                      </View>
                    )}
                  </View>

                  {/* Smart Recommendation */}
                  <View style={styles.recommendationBox}>
                    <Ionicons 
                      name={forecast.summary.needsLayers ? 'layers-outline' : forecast.summary.hasRainRisk ? 'umbrella-outline' : 'checkmark-circle-outline'} 
                      size={18} 
                      color={colors.primary} 
                    />
                    <Text style={styles.recommendationText}>{forecast.summary.recommendation}</Text>
                  </View>

                  {/* Indicators */}
                  <View style={styles.indicatorsRow}>
                    {forecast.summary.needsLayers && (
                      <View style={styles.indicator}>
                        <Ionicons name="layers" size={14} color={colors.accent} />
                        <Text style={styles.indicatorText}>Layers needed</Text>
                      </View>
                    )}
                    {forecast.summary.hasRainRisk && (
                      <View style={styles.indicator}>
                        <Ionicons name="rainy" size={14} color={colors.info || colors.secondary} />
                        <Text style={styles.indicatorText}>Rain possible</Text>
                      </View>
                    )}
                    <View style={styles.indicator}>
                      <Ionicons name="thermometer-outline" size={14} color={colors.textMuted} />
                      <Text style={styles.indicatorText}>{forecast.summary.tempSwing}°C swing</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Popular Cities */}
          {!searchResult && (
            <>
              <Text style={styles.sectionTitle}>Popular destinations</Text>
              <View style={styles.citiesGrid}>
                {POPULAR_CITIES.map((city) => (
                  <TouchableOpacity
                    key={city}
                    style={styles.cityChip}
                    onPress={() => handleSelectCity(city)}
                    disabled={isSearching}
                  >
                    <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                    <Text style={styles.cityChipText}>{city}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.display,
    fontSize: 22,
    color: colors.textPrimary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  currentLocationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  locationInfo: {
    flex: 1,
  },
  locationLabel: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  locationCity: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    height: 48,
    color: colors.textPrimary,
    ...typography.body,
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
  resultContainer: {
    marginBottom: spacing.lg,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.success,
  },
  resultLeft: {
    marginRight: spacing.md,
  },
  resultInfo: {
    flex: 1,
  },
  resultCity: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  resultWeather: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  resultBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  resultBadgeText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  sectionTitle: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  citiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  cityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  cityChipText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  forecastContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  periodsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  periodCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.backgroundAlt || colors.background,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  periodLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
  },
  periodTemp: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  rainChance: {
    ...typography.caption,
    color: colors.secondary,
    marginTop: 2,
  },
  recommendationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    padding: spacing.sm,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  recommendationText: {
    ...typography.caption,
    color: colors.textPrimary,
    flex: 1,
  },
  indicatorsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.cardSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  indicatorText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});

