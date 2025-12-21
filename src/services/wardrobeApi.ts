import { apiRequest } from './apiClient';

export type ClothingCategory =
  | 'top'
  | 'bottom'
  | 'dress'
  | 'shoes'
  | 'outerwear'
  | 'accessory'
  | 'other';

export type ClothingItem = {
  _id: string;
  userId: string;
  name: string;
  category: ClothingCategory;
  subcategory?: string;
  color?: string;
  colorPalette?: string[];
  brand?: string;
  size?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  mediumUrl?: string;
  cloudinaryPublicId?: string;
  tags?: string[];
  style?: string;
  pattern?: string;
  fit?: string;
  occasion?: string[];
  favorite?: boolean;
  wearCount?: number;
  lastWorn?: string;
  aiConfidence?: number;
  aiProcessed?: boolean;
};

type WardrobeItemsResponse = {
  items: ClothingItem[];
};

export async function fetchWardrobeItems(userId: string): Promise<ClothingItem[]> {
  const res = await apiRequest<WardrobeItemsResponse>(`/wardrobe/items?userId=${encodeURIComponent(userId)}`);
  return res.items;
}

export type CreateClothingItemInput = Omit<ClothingItem, '_id' | 'wearCount'>;

export async function createClothingItem(
  input: CreateClothingItemInput,
): Promise<ClothingItem> {
  const res = await apiRequest<{ item: ClothingItem }>('/wardrobe/items', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.item;
}

export async function deleteClothingItem(id: string): Promise<void> {
  await apiRequest<void>(`/wardrobe/items/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// Alias for convenience - fetches all items (no userId filter for now)
export async function fetchClothingItems(): Promise<ClothingItem[]> {
  const res = await apiRequest<WardrobeItemsResponse>('/wardrobe/items');
  return res.items;
}


