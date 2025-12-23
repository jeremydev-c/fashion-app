import { apiRequest } from './apiClient';

export type RecommendationItem = {
  id: string;
  name: string;
  category: string;
  color?: string;
  imageUrl?: string;
  style?: string;
  pattern?: string;
};

export type OutfitRecommendation = {
  id: string;
  items: RecommendationItem[];
  score: number;
  confidence: number;
  reasons: string[];
  occasion: string;
  timeOfDay: string;
  weather: string;
};

type RecommendationsResponse = {
  recommendations: OutfitRecommendation[];
};

export type ForecastContext = {
  needsLayers?: boolean;
  hasRainRisk?: boolean;
  tempSwing?: number;
  minTemp?: number;
  maxTemp?: number;
};

/**
 * Get AI-powered outfit recommendations
 */
export async function getRecommendations(params: {
  userId: string;
  occasion?: string;
  timeOfDay?: string;
  weather?: string;
  limit?: number;
  forecast?: ForecastContext;
}): Promise<OutfitRecommendation[]> {
  const queryParams = new URLSearchParams({
    userId: params.userId,
    ...(params.occasion && { occasion: params.occasion }),
    ...(params.timeOfDay && { timeOfDay: params.timeOfDay }),
    ...(params.weather && { weather: params.weather }),
    limit: (params.limit || 3).toString(),
    // Add forecast context
    ...(params.forecast?.needsLayers !== undefined && { needsLayers: params.forecast.needsLayers.toString() }),
    ...(params.forecast?.hasRainRisk !== undefined && { hasRainRisk: params.forecast.hasRainRisk.toString() }),
    ...(params.forecast?.tempSwing !== undefined && { tempSwing: params.forecast.tempSwing.toString() }),
  });

  try {
    const res = await apiRequest<RecommendationsResponse>(
      `/recommendations?${queryParams.toString()}`
    );
    return res.recommendations;
  } catch (error: any) {
    console.error('getRecommendations error:', error);
    console.error('Request params:', params);
    console.error('Error status:', error?.status);
    console.error('Error data:', error?.data);
    throw error; // Re-throw to let caller handle
  }
}

