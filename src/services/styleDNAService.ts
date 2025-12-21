import { apiRequest } from './apiClient';

export type StyleDNA = {
  _id: string;
  userId: string;
  primaryStyle: string;
  secondaryStyles: string[];
  colorPreferences: {
    dominantColors: Array<{ color: string; percentage: number }>;
    colorPalette: string[];
    seasonalColors: {
      spring: string[];
      summer: string[];
      fall: string[];
      winter: string[];
    };
  };
  brandAffinity: Array<{
    brand: string;
    count: number;
    score: number;
  }>;
  categoryDistribution: {
    top: number;
    bottom: number;
    dress: number;
    shoes: number;
    outerwear: number;
    accessory: number;
  };
  uniquenessScore: number;
  styleConsistency: number;
  trendAlignment: number;
  lastCalculated: string;
  createdAt: string;
  updatedAt: string;
};

type StyleDNAResponse = {
  styleDNA: StyleDNA;
};

/**
 * Get Style DNA for a user
 */
export async function getStyleDNA(userId: string): Promise<StyleDNA> {
  const res = await apiRequest<StyleDNAResponse>(`/style-dna/${encodeURIComponent(userId)}`);
  return res.styleDNA;
}

/**
 * Recalculate Style DNA for a user
 */
export async function recalculateStyleDNA(userId: string): Promise<StyleDNA> {
  const res = await apiRequest<StyleDNAResponse>(
    `/style-dna/${encodeURIComponent(userId)}/recalculate`,
    {
      method: 'POST',
    }
  );
  return res.styleDNA;
}

