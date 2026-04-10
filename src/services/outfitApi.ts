import { apiRequest } from './apiClient';

export type OutfitItem = {
  itemId: string;
  category: string;
};

export type Outfit = {
  _id: string;
  userId: string;
  name: string;
  description?: string;
  items: OutfitItem[];
  occasion?: string;
  season?: string;
  weather?: string;
  rating?: number;
  wearCount?: number;
  lastWorn?: string;
  favorite?: boolean;
  imageUrl?: string;
  tags?: string[];
  aiAnalysis?: {
    styleScore: number;
    colorHarmony: number;
    compatibilityScore: number;
    suggestions: string[];
  };
  createdAt: string;
  updatedAt: string;
};

type OutfitsResponse = {
  outfits: Outfit[];
};

type OutfitResponse = {
  outfit: Outfit;
};

/**
 * Get all outfits for a user
 */
export async function fetchOutfits(userId: string): Promise<Outfit[]> {
  const res = await apiRequest<OutfitsResponse>(`/outfits?userId=${encodeURIComponent(userId)}`);
  return res.outfits;
}

/**
 * Get a single outfit by ID
 */
export async function fetchOutfit(outfitId: string): Promise<Outfit> {
  const res = await apiRequest<OutfitResponse>(`/outfits/${encodeURIComponent(outfitId)}`);
  return res.outfit;
}

export type CreateOutfitInput = {
  userId: string;
  name: string;
  description?: string;
  items: OutfitItem[];
  occasion?: string;
  season?: string;
  weather?: string;
  tags?: string[];
  imageUrl?: string;
};

/**
 * Create a new outfit
 */
export async function createOutfit(input: CreateOutfitInput): Promise<Outfit> {
  const res = await apiRequest<OutfitResponse>('/outfits', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.outfit;
}

/**
 * Update an outfit
 */
export async function updateOutfit(outfitId: string, updates: Partial<Outfit>): Promise<Outfit> {
  const res = await apiRequest<OutfitResponse>(`/outfits/${encodeURIComponent(outfitId)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return res.outfit;
}

/**
 * Delete an outfit
 */
export async function deleteOutfit(outfitId: string): Promise<void> {
  await apiRequest<void>(`/outfits/${encodeURIComponent(outfitId)}`, {
    method: 'DELETE',
  });
}

/**
 * Mark an outfit as worn today.
 * Increments wearCount on the outfit and all its clothing items.
 */
export async function markOutfitWorn(outfitId: string): Promise<void> {
  await apiRequest<void>(`/outfits/${encodeURIComponent(outfitId)}/wear`, {
    method: 'POST',
  });
}

