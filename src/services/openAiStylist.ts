/**
 * Fashion Fit AI Styling Engine v2.0
 * 
 * A production-grade, API-ready outfit recommendation system
 * combining advanced fashion algorithms with AI intelligence.
 * 
 * Features:
 * - 12 Fashion Intelligence Algorithms
 * - Color Theory Engine
 * - Style DNA Integration
 * - Occasion & Context Awareness
 * - Continuous Learning Support
 * - Weather & Season Adaptation
 * 
 * © Fashion Fit - Premium Styling API
 */

import { ClothingItem } from './wardrobeApi';
import { UserPreferences } from './stylistFeedback';

// ============================================
// TYPES & INTERFACES
// ============================================

interface OutfitSuggestion {
  title: string;
  description: string;
  items: number[];
  styleScore?: number;
  colorHarmony?: string;
  occasionMatch?: string;
  confidence?: number;
}

interface StylistResponse {
  outfits: OutfitSuggestion[];
}

interface StylingContext {
  occasion: string;
  timeOfDay: string;
  weather?: WeatherContext;
  season: string;
  userProfile?: UserStyleProfile;
}

interface WeatherContext {
  temp: number;
  condition: string;
  humidity?: number;
  wind?: number;
}

interface UserStyleProfile {
  dominantColors: string[];
  dominantStyles: string[];
  preferredFit: string;
  stylePersonality: string;
  colorSeason?: string;
  preferredPattern?: string;
  topBrands?: string[];
}

interface WardrobeAnalysis {
  totalItems: number;
  categories: Record<string, number>;
  colorDistribution: Record<string, number>;
  styleDistribution: Record<string, number>;
  brandDistribution: Record<string, number>;
  gaps: string[];
  strengths: string[];
}

// ============================================
// FASHION INTELLIGENCE ALGORITHMS
// ============================================

/**
 * Algorithm 1: Color Harmony Analysis
 * Determines color relationships and compatibility
 */
const COLOR_WHEEL: Record<string, string[]> = {
  red: ['orange', 'purple', 'pink'],
  orange: ['red', 'yellow', 'brown', 'coral'],
  yellow: ['orange', 'green', 'gold', 'cream'],
  green: ['yellow', 'blue', 'teal', 'olive'],
  blue: ['green', 'purple', 'navy', 'teal'],
  purple: ['blue', 'red', 'pink', 'lavender'],
  pink: ['red', 'purple', 'coral', 'blush'],
  brown: ['orange', 'tan', 'beige', 'cream', 'camel'],
  black: ['white', 'gray', 'red', 'pink', 'blue', 'gold'], // universal
  white: ['black', 'navy', 'gray', 'beige', 'any'], // universal
  gray: ['black', 'white', 'pink', 'blue', 'purple'], // universal
  navy: ['white', 'cream', 'gold', 'red', 'pink'],
  beige: ['brown', 'white', 'navy', 'black', 'cream'],
};

const NEUTRAL_COLORS = ['black', 'white', 'gray', 'grey', 'navy', 'beige', 'cream', 'tan', 'khaki', 'nude'];

function analyzeColorHarmony(colors: string[]): { score: number; type: string; reasoning: string } {
  const normalizedColors = colors.map(c => c.toLowerCase().trim());
  const neutralCount = normalizedColors.filter(c => NEUTRAL_COLORS.some(n => c.includes(n))).length;
  
  // Monochromatic
  if (new Set(normalizedColors).size === 1 || neutralCount === colors.length) {
    return { score: 90, type: 'monochromatic', reasoning: 'Clean, sophisticated single-tone palette' };
  }
  
  // Mostly neutrals with one pop
  if (neutralCount >= colors.length - 1) {
    return { score: 95, type: 'neutral-pop', reasoning: 'Classic neutrals with a perfect accent' };
  }
  
  // Check complementary relationships
  let harmonyScore = 70;
  for (let i = 0; i < normalizedColors.length; i++) {
    for (let j = i + 1; j < normalizedColors.length; j++) {
      const color1 = normalizedColors[i];
      const color2 = normalizedColors[j];
      
      for (const [base, harmonious] of Object.entries(COLOR_WHEEL)) {
        if (color1.includes(base) && harmonious.some(h => color2.includes(h))) {
          harmonyScore = Math.max(harmonyScore, 85);
        }
      }
    }
  }
  
  return { 
    score: harmonyScore, 
    type: harmonyScore >= 85 ? 'complementary' : 'analogous',
    reasoning: harmonyScore >= 85 ? 'Colors that naturally complement each other' : 'Harmonious color family'
  };
}

/**
 * Algorithm 2: Style Coherence Analysis
 * Ensures items belong together stylistically
 */
const STYLE_FAMILIES: Record<string, string[]> = {
  casual: ['relaxed', 'comfortable', 'everyday', 'laid-back', 'weekend'],
  formal: ['elegant', 'sophisticated', 'dressy', 'polished', 'refined'],
  streetwear: ['urban', 'trendy', 'hip', 'edgy', 'bold'],
  minimalist: ['clean', 'simple', 'modern', 'sleek', 'understated'],
  bohemian: ['boho', 'free-spirited', 'artistic', 'eclectic', 'vintage'],
  sporty: ['athletic', 'active', 'performance', 'gym', 'athleisure'],
  classic: ['timeless', 'preppy', 'traditional', 'conservative'],
  romantic: ['feminine', 'soft', 'delicate', 'flowy', 'pretty'],
};

function analyzeStyleCoherence(items: ClothingItem[]): { score: number; dominantStyle: string } {
  const styleCounts: Record<string, number> = {};
  
  items.forEach(item => {
    const itemStyle = item.style?.toLowerCase() || '';
    const itemTags = item.tags?.map(t => t.toLowerCase()) || [];
    
    for (const [family, keywords] of Object.entries(STYLE_FAMILIES)) {
      if (keywords.some(k => itemStyle.includes(k) || itemTags.some(t => t.includes(k)))) {
        styleCounts[family] = (styleCounts[family] || 0) + 1;
      }
    }
  });
  
  const dominant = Object.entries(styleCounts).sort((a, b) => b[1] - a[1])[0];
  const coherenceScore = dominant ? (dominant[1] / items.length) * 100 : 70;
  
  return {
    score: Math.min(coherenceScore + 20, 100),
    dominantStyle: dominant?.[0] || 'eclectic'
  };
}

/**
 * Algorithm 3: Occasion Appropriateness
 * Matches outfit formality to occasion
 */
const OCCASION_FORMALITY: Record<string, number> = {
  gym: 1, beach: 1, lounging: 1,
  casual: 2, weekend: 2, brunch: 2, shopping: 2,
  'smart-casual': 3, date: 3, dinner: 3,
  work: 4, business: 4, meeting: 4,
  formal: 5, party: 5, wedding: 5, gala: 5,
};

const CATEGORY_FORMALITY: Record<string, number> = {
  activewear: 1, swimwear: 1,
  'casual-top': 2, jeans: 2, sneakers: 2, shorts: 2,
  blouse: 3, chinos: 3, loafers: 3,
  blazer: 4, dress_pants: 4, heels: 4,
  suit: 5, gown: 5, dress_shoes: 5,
};

function analyzeOccasionFit(items: ClothingItem[], occasion: string): { score: number; match: string } {
  const targetFormality = OCCASION_FORMALITY[occasion.toLowerCase()] || 3;
  
  let totalFormality = 0;
  items.forEach(item => {
    const cat = item.category?.toLowerCase() || '';
    const style = item.style?.toLowerCase() || '';
    
    // Estimate formality from category and style
    let itemFormality = 3;
    if (cat.includes('dress') || style.includes('formal')) itemFormality = 4;
    if (cat.includes('active') || style.includes('casual')) itemFormality = 2;
    if (style.includes('elegant') || style.includes('sophisticated')) itemFormality = 5;
    
    totalFormality += itemFormality;
  });
  
  const avgFormality = totalFormality / items.length;
  const formalityDiff = Math.abs(avgFormality - targetFormality);
  
  let score = 100 - (formalityDiff * 15);
  let match = 'perfect';
  
  if (formalityDiff > 1) { match = 'great'; score = Math.max(score, 75); }
  if (formalityDiff > 2) { match = 'good'; score = Math.max(score, 60); }
  
  return { score, match };
}

/**
 * Algorithm 4: Silhouette Balance
 * Ensures proportional outfit structure
 */
function analyzeSilhouette(items: ClothingItem[]): { score: number; advice: string } {
  const fits = items.map(i => i.fit?.toLowerCase() || 'regular');
  
  const hasOversized = fits.some(f => f.includes('oversized') || f.includes('loose') || f.includes('relaxed'));
  const hasFitted = fits.some(f => f.includes('fitted') || f.includes('slim') || f.includes('tailored'));
  
  // Ideal: mix of fitted and relaxed
  if (hasOversized && hasFitted) {
    return { score: 95, advice: 'Perfect balance of fitted and relaxed pieces' };
  }
  
  // All fitted - sleek but could use dimension
  if (hasFitted && !hasOversized) {
    return { score: 85, advice: 'Sleek silhouette' };
  }
  
  // All oversized - needs definition
  if (hasOversized && !hasFitted) {
    return { score: 75, advice: 'Consider adding a fitted piece for definition' };
  }
  
  return { score: 80, advice: 'Balanced proportions' };
}

/**
 * Algorithm 5: Pattern Mixing
 * Validates pattern combinations
 */
const PATTERN_SCALE: Record<string, number> = {
  solid: 0, plain: 0,
  pinstripe: 1, subtle: 1, micro: 1,
  stripe: 2, check: 2, gingham: 2,
  plaid: 3, floral: 3, geometric: 3,
  bold: 4, graphic: 4, animal: 4,
};

function analyzePatterns(items: ClothingItem[]): { score: number; valid: boolean } {
  const patterns = items
    .map(i => i.pattern?.toLowerCase() || 'solid')
    .filter(p => p !== 'solid' && p !== 'plain');
  
  // No patterns or one pattern = always safe
  if (patterns.length <= 1) {
    return { score: 95, valid: true };
  }
  
  // Two patterns - check scale difference
  if (patterns.length === 2) {
    const scales = patterns.map(p => {
      for (const [pattern, scale] of Object.entries(PATTERN_SCALE)) {
        if (p.includes(pattern)) return scale;
      }
      return 2;
    });
    
    const scaleDiff = Math.abs(scales[0] - scales[1]);
    if (scaleDiff >= 2) {
      return { score: 85, valid: true }; // Good scale contrast
    }
    return { score: 65, valid: false }; // Similar scales clash
  }
  
  // 3+ patterns = risky
  return { score: 50, valid: false };
}

/**
 * Algorithm 6: Texture Harmony
 * Ensures fabric compatibility
 */
function analyzeTextures(items: ClothingItem[]): number {
  // This would ideally check fabric types
  // For now, we assume variety is good
  return 85;
}

/**
 * Algorithm 7: Season Appropriateness
 */
function getSeasonScore(items: ClothingItem[], season: string): number {
  const seasonFabrics: Record<string, string[]> = {
    summer: ['linen', 'cotton', 'silk', 'light', 'breathable'],
    winter: ['wool', 'cashmere', 'fleece', 'heavy', 'warm'],
    spring: ['cotton', 'denim', 'light', 'layering'],
    fall: ['wool', 'leather', 'suede', 'layering', 'knit'],
  };
  
  const appropriate = seasonFabrics[season] || [];
  let matches = 0;
  
  items.forEach(item => {
    const tags = item.tags?.join(' ').toLowerCase() || '';
    if (appropriate.some(f => tags.includes(f))) matches++;
  });
  
  return 70 + (matches / items.length) * 30;
}

/**
 * Algorithm 8: Weather Adaptation
 */
function getWeatherScore(items: ClothingItem[], weather?: WeatherContext): number {
  if (!weather) return 85;
  
  const hasOuterwear = items.some(i => i.category === 'outerwear');
  const hasLayers = items.length >= 3;
  
  if (weather.temp < 10) {
    return hasOuterwear && hasLayers ? 95 : 60;
  }
  if (weather.temp > 25) {
    return !hasOuterwear ? 90 : 70;
  }
  
  return 85;
}

/**
 * Algorithm 9: Completeness Score
 * Checks if outfit has all necessary components
 */
function getCompletenessScore(items: ClothingItem[]): { score: number; missing: string[] } {
  const categories = items.map(i => i.category?.toLowerCase());
  const missing: string[] = [];
  
  const hasTop = categories.some(c => c?.includes('top') || c?.includes('shirt') || c?.includes('blouse'));
  const hasBottom = categories.some(c => c?.includes('bottom') || c?.includes('pants') || c?.includes('skirt') || c?.includes('jeans'));
  const hasDress = categories.some(c => c?.includes('dress'));
  const hasShoes = categories.some(c => c?.includes('shoe') || c?.includes('sneaker') || c?.includes('boot') || c?.includes('heel'));
  const hasAccessory = categories.some(c => c?.includes('accessor') || c?.includes('bag') || c?.includes('watch') || c?.includes('jewelry'));
  
  let score = 60;
  
  if (hasDress || (hasTop && hasBottom)) score += 20;
  else if (hasTop || hasBottom) { score += 10; missing.push(hasTop ? 'bottom' : 'top'); }
  else missing.push('top', 'bottom');
  
  if (hasShoes) score += 10;
  else missing.push('shoes');
  
  if (hasAccessory) score += 10;
  
  return { score: Math.min(score, 100), missing };
}

/**
 * Algorithm 10: Trend Alignment
 * How current/trendy is the outfit
 */
function getTrendScore(items: ClothingItem[]): number {
  const trendyKeywords = ['oversized', 'cropped', 'wide-leg', 'chunky', 'minimal', 'vintage', 'sustainable'];
  let trendMatches = 0;
  
  items.forEach(item => {
    const allText = `${item.style} ${item.tags?.join(' ')} ${item.fit}`.toLowerCase();
    if (trendyKeywords.some(t => allText.includes(t))) trendMatches++;
  });
  
  return 70 + (trendMatches / items.length) * 30;
}

/**
 * Remove duplicate accessories - ensures only one of each accessory type
 */
function removeDuplicateAccessories(items: ClothingItem[]): ClothingItem[] {
  const accessoryTypes: Record<string, ClothingItem[]> = {};
  const nonAccessories: ClothingItem[] = [];
  
  // Categorize items
  items.forEach(item => {
    const category = item.category?.toLowerCase() || '';
    if (category === 'accessory') {
      const name = (item.name || item.subcategory || '').toLowerCase();
      
      // Determine accessory type
      let type = 'other';
      if (name.includes('watch') || name.includes('timepiece')) {
        type = 'watch';
      } else if (name.includes('bag') || name.includes('purse') || name.includes('handbag') || name.includes('tote')) {
        type = 'bag';
      } else if (name.includes('belt')) {
        type = 'belt';
      } else if (name.includes('necklace') || name.includes('bracelet') || name.includes('ring') || name.includes('earring') || name.includes('jewelry')) {
        type = 'jewelry';
      } else if (name.includes('hat') || name.includes('cap') || name.includes('beanie')) {
        type = 'hat';
      } else if (name.includes('scarf')) {
        type = 'scarf';
      } else if (name.includes('sunglass') || name.includes('glasses')) {
        type = 'sunglasses';
      }
      
      if (!accessoryTypes[type]) {
        accessoryTypes[type] = [];
      }
      accessoryTypes[type].push(item);
    } else {
      nonAccessories.push(item);
    }
  });
  
  // Keep only the first accessory of each type
  const uniqueAccessories: ClothingItem[] = [];
  Object.values(accessoryTypes).forEach(accessories => {
    if (accessories.length > 0) {
      uniqueAccessories.push(accessories[0]); // Only keep the first one
    }
  });
  
  // Limit to max 2 accessories total
  const finalAccessories = uniqueAccessories.slice(0, 2);
  
  return [...nonAccessories, ...finalAccessories];
}

/**
 * Algorithm 11: Versatility Score
 * Can pieces be worn in multiple outfits
 */
function getVersatilityScore(items: ClothingItem[]): number {
  const versatileColors = ['black', 'white', 'navy', 'gray', 'beige', 'denim'];
  let versatileCount = 0;
  
  items.forEach(item => {
    const color = item.color?.toLowerCase() || '';
    if (versatileColors.some(v => color.includes(v))) versatileCount++;
  });
  
  return 60 + (versatileCount / items.length) * 40;
}

/**
 * Algorithm 12: "Wow Factor" Score
 * Does this outfit have that special something
 */
function getWowFactor(items: ClothingItem[], colorScore: number, styleScore: number): number {
  const hasStatementPiece = items.some(i => 
    i.tags?.some(t => ['statement', 'bold', 'unique', 'designer', 'standout'].includes(t.toLowerCase()))
  );
  
  const baseScore = (colorScore + styleScore) / 2;
  return hasStatementPiece ? Math.min(baseScore + 15, 100) : baseScore;
}

// ============================================
// WARDROBE ANALYSIS
// ============================================

function analyzeWardrobe(wardrobe: ClothingItem[]): WardrobeAnalysis {
  const categories: Record<string, number> = {};
  const colorDistribution: Record<string, number> = {};
  const styleDistribution: Record<string, number> = {};
  const brandDistribution: Record<string, number> = {};
  
  wardrobe.forEach(item => {
    // Categories
    const cat = item.category || 'other';
    categories[cat] = (categories[cat] || 0) + 1;
    
    // Colors
    if (item.color) {
      const color = item.color.toLowerCase();
      colorDistribution[color] = (colorDistribution[color] || 0) + 1;
    }
    
    // Styles
    if (item.style) {
      const style = item.style.toLowerCase();
      styleDistribution[style] = (styleDistribution[style] || 0) + 1;
    }
    
    // Brands
    if (item.brand) {
      const brand = item.brand.toLowerCase();
      brandDistribution[brand] = (brandDistribution[brand] || 0) + 1;
    }
  });
  
  // Identify gaps
  const gaps: string[] = [];
  const strengths: string[] = [];
  
  if (!categories['shoes'] && !categories['shoe']) gaps.push('footwear');
  if (!categories['accessory'] && !categories['accessories']) gaps.push('accessories');
  if (!categories['outerwear']) gaps.push('outerwear');
  
  const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];
  if (topCategory) strengths.push(`Strong ${topCategory[0]} collection`);
  
  return {
    totalItems: wardrobe.length,
    categories,
    colorDistribution,
    styleDistribution,
    brandDistribution,
    gaps,
    strengths,
  };
}

// ============================================
// CONTEXT HELPERS
// ============================================

function getCurrentSeason(): string {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'fall';
  return 'winter';
}

function buildUserProfile(wardrobe: ClothingItem[], preferences?: UserPreferences): UserStyleProfile {
  const analysis = analyzeWardrobe(wardrobe);
  
  const dominantColors = Object.entries(analysis.colorDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([color]) => color);
    
  const dominantStyles = Object.entries(analysis.styleDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([style]) => style);
  
  // Deep analysis: What fits do they prefer?
  const fitDistribution: Record<string, number> = {};
  wardrobe.forEach(item => {
    const fit = item.fit?.toLowerCase() || 'regular';
    fitDistribution[fit] = (fitDistribution[fit] || 0) + 1;
  });
  const preferredFit = Object.entries(fitDistribution)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'regular';
  
  // Pattern preferences
  const patternDistribution: Record<string, number> = {};
  wardrobe.forEach(item => {
    const pattern = item.pattern?.toLowerCase() || 'solid';
    patternDistribution[pattern] = (patternDistribution[pattern] || 0) + 1;
  });
  const preferredPattern = Object.entries(patternDistribution)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'solid';
  
  // Brand affinity (if they have favorite brands)
  const topBrands = Object.entries(analysis.brandDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([brand]) => brand);
  
  return {
    dominantColors,
    dominantStyles,
    preferredFit,
    stylePersonality: dominantStyles[0] || 'eclectic',
    preferredPattern: preferredPattern || 'solid',
    topBrands: topBrands || [],
  };
}

// ============================================
// MAIN AI STYLING ENGINE
// ============================================

export async function getAiOutfits(
  wardrobe: ClothingItem[],
  options: { occasion: string; timeOfDay: string; weather?: WeatherContext },
  preferences?: UserPreferences,
): Promise<OutfitSuggestion[]> {
  const key = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!key) {
    throw new Error('OpenAI API key is not configured');
  }

  const season = getCurrentSeason();
  const userProfile = buildUserProfile(wardrobe, preferences);
  const wardrobeAnalysis = analyzeWardrobe(wardrobe);

  // Build enriched wardrobe summary for AI
  const summarized = wardrobe.map((item, index) => ({
    i: index,
    n: item.name?.slice(0, 30),
    cat: item.category,
    col: item.color,
    sty: item.style,
    pat: item.pattern,
    fit: item.fit,
    tag: item.tags?.slice(0, 3),
    br: item.brand,
  }));

  // Build deep user profile insights
  const topColors = Object.entries(wardrobeAnalysis.colorDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([color]) => color);
  
  const topStyles = Object.entries(wardrobeAnalysis.styleDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([style]) => style);
  
  const mostWornCategory = Object.entries(wardrobeAnalysis.categories)
    .sort((a, b) => b[1] - a[1])[0];
  
  // Build preference hints with deep insights
  let preferencesHint = '';
  if (preferences) {
    if (preferences.preferredColors?.length) {
      preferencesHint += `\n🎨 EXPLICITLY LOVES: ${preferences.preferredColors.join(', ')}`;
    }
    if (preferences.preferredStyles?.length) {
      preferencesHint += `\n👔 EXPLICIT STYLE: ${preferences.preferredStyles.join(', ')}`;
    }
    if (preferences.avoidedCombinations?.length) {
      preferencesHint += `\n🚫 EXPLICITLY AVOIDS: ${preferences.avoidedCombinations.join(', ')}`;
    }
  }
  
  // Add implicit preferences (what they actually own most)
  preferencesHint += `\n\n🧠 IMPLICIT USER INSIGHTS (They may not even know this!):`;
  preferencesHint += `\n📊 Wardrobe shows they ACTUALLY gravitate toward: ${topColors.join(', ')} colors`;
  preferencesHint += `\n👔 Their REAL style DNA: ${topStyles.join(', ')}`;
  if (userProfile.preferredFit) {
    preferencesHint += `\n✂️ Fit preference: ${userProfile.preferredFit} (based on what they own)`;
  }
  if (userProfile.preferredPattern && userProfile.preferredPattern !== 'solid') {
    preferencesHint += `\n🎨 Pattern preference: ${userProfile.preferredPattern} (they love this!)`;
  }
  if (userProfile.topBrands && userProfile.topBrands.length > 0) {
    preferencesHint += `\n🏷️ Brand affinity: ${userProfile.topBrands.join(', ')} (trusted brands)`;
  }
  if (mostWornCategory) {
    preferencesHint += `\n💼 They have ${mostWornCategory[1]} ${mostWornCategory[0]} items - this is their comfort zone`;
  }
  
  preferencesHint += `\n\n💡 PSYCHOLOGICAL PROFILE (Know them better than they know themselves):`;
  if (topColors.includes('black') || topColors.includes('white') || topColors.includes('gray')) {
    preferencesHint += `\n   - Classic, timeless taste (loves neutrals - suggest neutral-based outfits)`;
  }
  if (topColors.some(c => ['red', 'pink', 'orange', 'yellow'].includes(c))) {
    preferencesHint += `\n   - Bold, confident personality (loves vibrant colors - don't be afraid of color!)`;
  }
  if (topColors.some(c => ['blue', 'navy', 'teal'].includes(c))) {
    preferencesHint += `\n   - Calm, trustworthy vibe (loves blues - this is their power color)`;
  }
  if (topStyles.includes('minimalist') || topStyles.includes('casual')) {
    preferencesHint += `\n   - Values comfort and simplicity (keep it clean, don't overcomplicate)`;
  }
  if (topStyles.includes('formal') || topStyles.includes('elegant')) {
    preferencesHint += `\n   - Professional, sophisticated aesthetic (elevated looks resonate)`;
  }
  if (topStyles.includes('sporty') || topStyles.includes('athletic')) {
    preferencesHint += `\n   - Active lifestyle (comfort + style balance is key)`;
  }
  
  // Calculate color season hints
  const warmColors = topColors.filter(c => ['red', 'orange', 'yellow', 'brown', 'beige', 'coral', 'peach'].some(w => c.includes(w)));
  const coolColors = topColors.filter(c => ['blue', 'green', 'purple', 'pink', 'gray', 'navy'].some(co => c.includes(co)));
  if (warmColors.length > coolColors.length) {
    preferencesHint += `\n   - WARM color season (warm tones look best on them)`;
  } else if (coolColors.length > warmColors.length) {
    preferencesHint += `\n   - COOL color season (cool tones look best on them)`;
  }
  
  preferencesHint += `\n\n🎯 STYLING STRATEGY:`;
  preferencesHint += `\n   - Use their ACTUAL color preferences (${topColors.slice(0, 3).join(', ')}) as base`;
  preferencesHint += `\n   - Match their REAL style (${topStyles[0] || 'eclectic'}) but elevate it`;
  preferencesHint += `\n   - Create outfits that feel like "them" but make them feel unstoppable`;
  preferencesHint += `\n   - Suggest combinations they'd never think of but will LOVE`;

  const prompt = `You are the FASHION FIT AI STYLING ENGINE - a world-class outfit recommendation system used by fashion-forward individuals who want to look incredible.

═══════════════════════════════════════════
📊 USER'S WARDROBE ANALYSIS
═══════════════════════════════════════════
Total Items: ${wardrobeAnalysis.totalItems}
Top Categories: ${Object.entries(wardrobeAnalysis.categories).slice(0, 4).map(([k, v]) => `${k}(${v})`).join(', ')}
Color Palette: ${userProfile.dominantColors.join(', ') || 'varied'}
Style Profile: ${userProfile.dominantStyles.join(', ') || 'eclectic'}
${wardrobeAnalysis.gaps.length ? `Gaps: ${wardrobeAnalysis.gaps.join(', ')}` : ''}
${preferencesHint}

═══════════════════════════════════════════
🎯 STYLING REQUEST
═══════════════════════════════════════════
Occasion: ${options.occasion}
Time: ${options.timeOfDay}
Season: ${season}
${options.weather ? `Weather: ${options.weather.temp}°C, ${options.weather.condition}` : ''}

═══════════════════════════════════════════
👗 WARDROBE ITEMS (use "i" as index)
═══════════════════════════════════════════
${JSON.stringify(summarized).slice(0, 7000)}

═══════════════════════════════════════════
🧠 STYLING INTELLIGENCE RULES
═══════════════════════════════════════════

1. COLOR MASTERY
   - 60-30-10 rule: dominant, secondary, accent
   - Neutrals (black/white/gray/navy/beige) are foundations
   - Max 3-4 colors unless using neutrals
   - Create intentional color stories

2. STYLE COHERENCE
   - Every piece must belong together
   - Match formality levels
   - One clear style direction per outfit

3. SILHOUETTE BALANCE
   - Mix fitted + relaxed pieces
   - Create visual interest through proportions
   - Define the waist when possible

4. COMPLETE OUTFITS (STRICT RULES - NO EXCEPTIONS!)
   ⚠️ EVERY outfit MUST have a REALISTIC foundation:
   - OPTION A: top + bottom (pants/jeans/skirt/shorts) 
   - OPTION B: dress/jumpsuit (standalone)
   
   ❌ NEVER suggest:
   - A top without bottoms
   - Just accessories
   - Incomplete looks that can't be worn outside
   
   ✅ ALWAYS check: "Can someone actually walk outside wearing this?"
   
   THEN add if available:
   - Footwear (shoes/sneakers/boots)
   - MAX 1 accessory per type (1 watch OR 1 bag OR 1 belt OR 1 jewelry piece - NOT multiple of same type)
   - MAX 2 total accessories, but they MUST be different types (e.g., watch + bag, NOT watch + watch)
   - Outerwear when appropriate
   
   ⚠️ CRITICAL ACCESSORY RULES:
   - NEVER suggest 2 watches in one outfit
   - NEVER suggest 2 bags in one outfit  
   - NEVER suggest duplicate accessories of the same type
   - Accessories should complement, not compete

5. THE "WOW FACTOR"
   - Each outfit should get compliments
   - One statement piece per look
   - Unexpected but genius combinations
   - Make it look effortlessly stylish

6. DEEP REASONING (internal)
   - WHY does each piece belong?
   - HOW do the colors work together?
   - WHAT makes this outfit special?

═══════════════════════════════════════════
🧠 DEEP USER UNDERSTANDING REQUIRED
═══════════════════════════════════════════

You know this user BETTER than they know themselves.

ANALYZE THEIR WARDROBE PSYCHOLOGY:
- What colors do they ACTUALLY wear most? (Not what they say, what they own)
- What's their REAL style personality? (Look at their collection, not their words)
- What are their hidden preferences? (Patterns in their wardrobe reveal truth)
- What would make them feel MOST confident? (Based on what they already love)

THINK LIKE A PERSONAL STYLIST WHO:
- Has studied their entire wardrobe
- Knows their color season
- Understands their body type preferences
- Recognizes their comfort zones AND how to push them slightly
- Sees opportunities they can't see themselves

CREATE OUTFITS THAT:
✅ Match their ACTUAL style DNA (from wardrobe analysis)
✅ Use colors they gravitate toward (implicit preferences)
✅ Feel familiar yet elevated (their style, but better)
✅ Make them feel like the best version of themselves
✅ Are outfits they'd choose if they had a personal stylist

═══════════════════════════════════════════
📤 OUTPUT (JSON only, no markdown)
═══════════════════════════════════════════
{
  "outfits": [
    {
      "title": "3-4 word catchy name",
      "description": "One confident line about the vibe (max 15 words). Examples: 'Main character energy - you'll turn heads.' or 'Effortlessly cool, your friends will ask who styled you.'",
      "items": [indices from wardrobe],
      "styleScore": 85-98,
      "colorHarmony": "monochromatic|complementary|analogous|neutral-pop",
      "occasionMatch": "perfect|great|good",
      "confidence": 90-99
    }
  ]
}

Create 3 DISTINCT outfits with different vibes, but ALL must be PERFECT.

🏧 ATM-LEVEL ACCURACY + PSYCHOLOGICAL INTELLIGENCE:
You're not just matching clothes - you're creating outfits that:
- Feel like "them" but elevated
- Use their actual color preferences (from wardrobe)
- Match their real style personality (not what they claim)
- Make them feel confident and unstoppable
- Are outfits they'd save and wear repeatedly

BEFORE you output EACH outfit, verify:
□ Has a TOP (shirt/blouse/sweater/tee) OR a DRESS? 
□ Has a BOTTOM (pants/jeans/trousers/skirt/shorts) if not a dress?
□ Every item index exists in the wardrobe?
□ Colors actually complement each other AND match their wardrobe DNA?
□ Style is cohesive (not mixing gym wear with formal)?
□ Uses their ACTUAL preferred colors (from wardrobe analysis)?
□ Someone could ACTUALLY wear this outside right now?
□ This outfit makes them feel like the BEST version of themselves?

If ANY checkbox fails = DO NOT include that outfit.

Output ONLY outfits you are 100% confident about.
Quality over quantity - 2 perfect outfits beats 3 mediocre ones.

The user trusts you like they trust an ATM. Don't break that trust. 🔥`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: 'You are the Fashion Fit AI Styling Engine. You operate with ATM-level accuracy - every outfit must be PERFECT and COMPLETE. No mistakes. No incomplete looks. Output ONLY valid JSON with outfits you are 100% confident about.' 
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.75,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('Fashion Fit AI error:', text);
    throw new Error('Failed to generate outfit recommendations');
  }

  const json = await response.json();
  const rawContent = json.choices?.[0]?.message?.content || '{}';

  let parsed: StylistResponse;
  try {
    let cleanContent = rawContent.trim();
    if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    }
    parsed = JSON.parse(cleanContent);
  } catch (err) {
    console.error('Failed to parse AI response:', rawContent);
    throw new Error('Failed to parse outfit recommendations');
  }

  // Post-process and validate outfits
  const validatedOutfits = (parsed.outfits || [])
    .map(outfit => {
      let outfitItems = outfit.items
        .map(idx => wardrobe[idx])
        .filter(Boolean);
      
      // Remove duplicate accessories of the same type
      outfitItems = removeDuplicateAccessories(outfitItems);
      
      // Run our algorithms for additional scoring
      const colors = outfitItems.map(i => i.color).filter(Boolean) as string[];
      const colorAnalysis = analyzeColorHarmony(colors);
      const styleAnalysis = analyzeStyleCoherence(outfitItems);
      const occasionAnalysis = analyzeOccasionFit(outfitItems, options.occasion);
      
      return {
        ...outfit,
        outfitItems, // Keep for validation
        items: outfitItems.map((item, idx) => wardrobe.indexOf(item)), // Update indices
        styleScore: outfit.styleScore || Math.round((colorAnalysis.score + styleAnalysis.score + occasionAnalysis.score) / 3),
        colorHarmony: outfit.colorHarmony || colorAnalysis.type,
        occasionMatch: outfit.occasionMatch || occasionAnalysis.match,
      };
    })
    // STRICT VALIDATION: Filter out incomplete outfits
    .filter(outfit => {
      const categories = outfit.outfitItems.map(i => i.category?.toLowerCase() || '');
      
      // Check for dress/jumpsuit (standalone OK)
      const hasDress = categories.some(c => c.includes('dress') || c.includes('jumpsuit') || c.includes('romper'));
      if (hasDress) return true;
      
      // Otherwise MUST have top AND bottom
      const hasTop = categories.some(c => 
        c.includes('top') || c.includes('shirt') || c.includes('blouse') || 
        c.includes('tee') || c.includes('sweater') || c.includes('hoodie') ||
        c.includes('jacket') || c.includes('blazer') || c.includes('cardigan')
      );
      const hasBottom = categories.some(c => 
        c.includes('bottom') || c.includes('pants') || c.includes('jeans') || 
        c.includes('trouser') || c.includes('skirt') || c.includes('shorts') ||
        c.includes('legging')
      );
      
      // Reject if missing foundation pieces
      if (!hasTop || !hasBottom) {
        console.log('Rejected incomplete outfit:', outfit.title, '- Missing:', !hasTop ? 'top' : 'bottom');
        return false;
      }
      
      return true;
    })
    .map(({ outfitItems, ...rest }) => rest); // Remove temp field

  return validatedOutfits;
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Generate AI-powered outfit recommendations
 * 
 * @param wardrobe - User's clothing items
 * @param occasion - Event type (casual, work, date, party, formal, gym)
 * @param timeOfDay - Time context (morning, afternoon, evening, night)
 * @param preferences - Optional user preferences
 * @param weather - Optional weather context
 * @returns Array of outfit suggestions with full item details
 */
export const generateAIOutfits = async (
  wardrobe: ClothingItem[],
  occasion: string,
  timeOfDay: string,
  preferences?: UserPreferences,
  weather?: WeatherContext,
) => {
  const results = await getAiOutfits(wardrobe, { occasion, timeOfDay, weather }, preferences);
  
  return results.map((outfit, idx) => ({
    id: `outfit-${Date.now()}-${idx}`,
    items: outfit.items
      .map(index => wardrobe[index])
      .filter(Boolean),
    occasion,
    reasoning: outfit.description,
    title: outfit.title,
    styleScore: outfit.styleScore,
    colorHarmony: outfit.colorHarmony,
    occasionMatch: outfit.occasionMatch,
    confidence: outfit.confidence,
  }));
};

/**
 * Analyze a specific outfit combination
 * Returns detailed scoring across all algorithms
 */
export const analyzeOutfit = (items: ClothingItem[], occasion: string, season?: string) => {
  const colors = items.map(i => i.color).filter(Boolean) as string[];
  
  const colorAnalysis = analyzeColorHarmony(colors);
  const styleAnalysis = analyzeStyleCoherence(items);
  const occasionAnalysis = analyzeOccasionFit(items, occasion);
  const silhouetteAnalysis = analyzeSilhouette(items);
  const patternAnalysis = analyzePatterns(items);
  const completeness = getCompletenessScore(items);
  const trendScore = getTrendScore(items);
  const versatilityScore = getVersatilityScore(items);
  const wowFactor = getWowFactor(items, colorAnalysis.score, styleAnalysis.score);
  
  const overallScore = Math.round(
    (colorAnalysis.score * 0.2) +
    (styleAnalysis.score * 0.15) +
    (occasionAnalysis.score * 0.15) +
    (silhouetteAnalysis.score * 0.1) +
    (patternAnalysis.score * 0.1) +
    (completeness.score * 0.1) +
    (trendScore * 0.05) +
    (versatilityScore * 0.05) +
    (wowFactor * 0.1)
  );
  
  return {
    overallScore,
    breakdown: {
      colorHarmony: colorAnalysis,
      styleCoherence: styleAnalysis,
      occasionFit: occasionAnalysis,
      silhouette: silhouetteAnalysis,
      patterns: patternAnalysis,
      completeness,
      trendScore,
      versatilityScore,
      wowFactor,
    },
  };
};
