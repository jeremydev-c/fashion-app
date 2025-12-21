import { apiRequest } from './apiClient';

export type WardrobeAnalytics = {
  totalItems: number;
  categoryDistribution: Record<string, number>;
  colorDistribution: Record<string, number>;
  styleDistribution: Record<string, number>;
  mostWorn: Array<{
    id: string;
    name: string;
    category: string;
    color: string;
    imageUrl?: string;
    wearCount: number;
  }>;
  unusedItems: Array<{
    id: string;
    name: string;
    category: string;
    color: string;
    imageUrl?: string;
    daysSinceAdded: number;
  }>;
  utilizationRate: number;
  avgItemsPerOutfit: number;
  totalOutfits: number;
  usedItemsCount: number;
};

export type OutfitAnalytics = {
  totalOutfits: number;
  occasionDistribution: Record<string, number>;
  mostWornOutfits: Array<{
    id: string;
    name: string;
    occasion: string;
    wearCount: number;
    lastWorn?: Date;
    favorite: boolean;
    items: number;
  }>;
  favoriteOutfits: number;
  recentOutfits: number;
  avgRating: number;
};

export type Insight = {
  type: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  itemId?: string;
};

export type InsightsData = {
  insights: Insight[];
};

/**
 * Get wardrobe analytics
 */
export async function getWardrobeAnalytics(userId: string): Promise<WardrobeAnalytics> {
  return apiRequest<WardrobeAnalytics>(`/analytics/wardrobe?userId=${userId}`);
}

/**
 * Get outfit analytics
 */
export async function getOutfitAnalytics(userId: string): Promise<OutfitAnalytics> {
  return apiRequest<OutfitAnalytics>(`/analytics/outfits?userId=${userId}`);
}

/**
 * Get personalized insights
 */
export async function getInsights(userId: string): Promise<InsightsData> {
  return apiRequest<InsightsData>(`/analytics/insights?userId=${userId}`);
}

