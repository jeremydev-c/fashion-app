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
    apiRequest('/learning/interaction', {
      method: 'POST',
      body: JSON.stringify(data),
    }).catch(() => {});
  } catch {
    // Silent fail - learning should never break the app
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

