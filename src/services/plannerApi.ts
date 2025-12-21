import { apiRequest } from './apiClient';

export type PlannedOutfit = {
  _id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  title?: string;
  occasion?: string;
  timeOfDay?: string;
  itemIds: string[];
  notes?: string;
};

type PlannedOutfitResponse = {
  plans: PlannedOutfit[];
};

export async function fetchPlannedOutfits(userId: string): Promise<PlannedOutfit[]> {
  const res = await apiRequest<PlannedOutfitResponse>(
    `/planner?userId=${encodeURIComponent(userId)}`,
  );
  return res.plans;
}

export async function createPlannedOutfit(input: {
  userId: string;
  date: string;
  title?: string;
  occasion?: string;
  timeOfDay?: string;
  itemIds: string[];
  notes?: string;
}): Promise<PlannedOutfit> {
  const res = await apiRequest<{ plan: PlannedOutfit }>('/planner', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.plan;
}

export async function deletePlannedOutfit(id: string): Promise<void> {
  await apiRequest<void>(`/planner/${encodeURIComponent(id)}`, { method: 'DELETE' });
}



