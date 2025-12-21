import { apiRequest } from './apiClient';

export type WeatherData = {
  temperature: number;
  condition: string;
  description: string;
  weatherCategory: 'hot' | 'warm' | 'cool' | 'cold';
  humidity: number;
  windSpeed: number;
  city: string;
  country?: string;
  lat?: number;
  lon?: number;
};

type WeatherResponse = {
  weather: WeatherData;
};

/**
 * Get current weather by coordinates
 */
export async function getCurrentWeather(
  lat: number,
  lon: number
): Promise<WeatherData> {
  const res = await apiRequest<WeatherResponse>(
    `/weather/current?lat=${lat}&lon=${lon}`
  );
  return res.weather;
}

/**
 * Get current weather by city name
 */
export async function getWeatherByCity(city: string): Promise<WeatherData> {
  const res = await apiRequest<WeatherResponse>(
    `/weather/city?city=${encodeURIComponent(city)}`
  );
  return res.weather;
}

// Forecast types
export type PeriodForecast = {
  minTemp: number;
  maxTemp: number;
  avgTemp: number;
  condition: string;
  weatherCategory: 'hot' | 'warm' | 'cool' | 'cold';
  rainChance: number;
} | null;

export type ForecastSummary = {
  minTemp: number;
  maxTemp: number;
  tempSwing: number;
  needsLayers: boolean;
  hasRainRisk: boolean;
  recommendation: string;
  weatherCategory: 'hot' | 'warm' | 'cool' | 'cold';
};

export type WeatherForecast = {
  city: string;
  country: string;
  lat: number;
  lon: number;
  periods: {
    morning: PeriodForecast;
    afternoon: PeriodForecast;
    evening: PeriodForecast;
  };
  summary: ForecastSummary;
};

type ForecastResponse = {
  forecast: WeatherForecast;
};

/**
 * Get weather forecast for a city (morning, afternoon, evening)
 */
export async function getWeatherForecast(city: string): Promise<WeatherForecast> {
  const res = await apiRequest<ForecastResponse>(
    `/weather/forecast?city=${encodeURIComponent(city)}`
  );
  return res.forecast;
}

