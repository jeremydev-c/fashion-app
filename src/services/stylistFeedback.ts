import { apiRequest } from './apiClient';

export type FeedbackAction = 'saved' | 'rejected' | 'rated';

export type OutfitFeedback = {
  userId: string;
  outfitId: string;
  itemIds: string[];
  occasion?: string;
  timeOfDay?: string;
  action: FeedbackAction;
  rating?: number; // 1-5, only if action is 'rated'
};

export async function submitOutfitFeedback(feedback: OutfitFeedback): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>('/stylist/feedback', {
    method: 'POST',
    body: JSON.stringify(feedback),
  });
}

export type UserPreferences = {
  preferredColors: string[];
  preferredStyles: string[];
  avoidedCombinations: string[];
  preferredOccasions: string[];
  feedbackCount: number;
};

export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  const res = await apiRequest<{ preferences: UserPreferences }>(
    `/stylist/preferences?userId=${encodeURIComponent(userId)}`,
  );
  return res.preferences;
}


