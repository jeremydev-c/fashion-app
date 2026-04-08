import { apiRequest } from './apiClient';
import type { SemanticProfile } from './wardrobeApi';

type AiCategorizationResponse = {
  category: string;
  color: string;
  tags: string[];
};

export type EnhancedAiCategorizationResponse = {
  category: string;
  subcategory: string;
  color: string;
  colorPalette: string[];
  style: string;
  pattern: string;
  fit: string;
  occasion: string[];
  brand: string | null;
  tags: string[];
  confidence: number;
  semanticProfile: SemanticProfile;
};

export async function smartCategorize(name: string, notes?: string) {
  const res = await apiRequest<AiCategorizationResponse>('/ai/categorize', {
    method: 'POST',
    body: JSON.stringify({ name, notes }),
  });

  return res;
}

/**
 * Enhanced AI categorization with comprehensive analysis
 * Returns category, subcategory, color, style, pattern, fit, occasion, brand, tags, and confidence
 */
export async function smartCategorizeImage(imageBase64: string): Promise<EnhancedAiCategorizationResponse> {
  const res = await apiRequest<EnhancedAiCategorizationResponse>('/ai/categorize-image', {
    method: 'POST',
    body: JSON.stringify({ imageBase64 }),
  });

  return res;
}


