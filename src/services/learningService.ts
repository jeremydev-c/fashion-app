import { apiRequest } from './apiClient';

/**
 * Record any user interaction for continuous learning
 * This is called for EVERY action - the engine never stops learning!
 */
export async function recordInteraction(data: {
  userId: string;
  interactionType: 'view' | 'swipe_left' | 'swipe_right' | 'save' | 'reject' | 'rate' | 'regenerate' | 'refine';
  recommendationId?: string;
  itemIds?: string[];
  occasion?: string;
  timeOfDay?: string;
  weather?: string;
  rating?: number;
  confidence?: number;
  sessionId?: string;
}): Promise<void> {
  try {
    // Fire and forget - learning should never block the UI
    fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.104:4000'}/learning/interaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(err => {
      console.error('Learning recording failed (non-blocking):', err);
    });
  } catch (error) {
    // Silent fail - learning should never break the app
    console.error('Error recording interaction:', error);
  }
}

export type LearningInsights = {
  totalInteractions: number;
  learningRate: number;
  improvementTrend: 'improving' | 'stable' | 'declining';
  confidence: number;
  recentPositiveRate: number;
  olderPositiveRate: number;
};

export type LearningData = {
  insights: LearningInsights;
  patterns: {
    bestOccasions: Record<string, number>;
    bestTimeOfDay: Record<string, number>;
    bestWeather: Record<string, number>;
    bestColorCombos: Record<string, number>;
    bestStyleCombos: Record<string, number>;
  };
};

/**
 * Get learning insights
 */
export async function getLearningInsights(userId: string): Promise<LearningData> {
  return apiRequest<LearningData>(`/learning/insights?userId=${userId}`);
}

