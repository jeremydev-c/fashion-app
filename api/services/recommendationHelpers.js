/**
 * recommendationHelpers.js — Pure utility functions for the recommendation engine.
 * No model dependencies, no side-effects.
 */

const {
  OCCASION_PROFILES,
  TIME_PROFILES,
  checkItemAppropriateness,
} = require('../utils/fashionIntelligence');
const {
  SEMANTIC_AXIS_KEYS,
  getSemanticProfile,
  semanticCompatibility,
} = require('../utils/semanticStyleProfile');

// ═══════════════════════════════════════════════════════════════════════════
// BASIC UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hashString(input) {
  const str = String(input || '');
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededNoise(seed, key) {
  return hashString(`${seed}:${key}`) / 4294967295;
}

function id(item) { return (item._id || item.id || '').toString(); }

function normalizeSeedPart(value, fallback = 'base') {
  const normalized = String(value ?? fallback)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9:_-]/g, '');
  return normalized || fallback;
}

function seedDateKey(value) {
  if (!value) return 'never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'never';
  return date.toISOString().slice(0, 10);
}

function makeRecommendationId(prefix, seed, slot) {
  return `${prefix}_${hashString(`${seed}:${slot}`).toString(36)}`;
}

function normalizeRecommendationScore(value) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 72;
  if (numeric <= 1.01) return Math.round(clamp(numeric, 0, 1) * 100);
  return Math.round(clamp(numeric, 0, 100));
}

function getCurrentSeason() {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'fall';
  return 'winter';
}

// ═══════════════════════════════════════════════════════════════════════════
// NORMALISATION
// ═══════════════════════════════════════════════════════════════════════════

function normalizeOccasion(value) {
  const normalized = String(value || 'casual').toLowerCase().trim().replace(/\s+/g, '-');
  const aliases = {
    office: 'work',
    business: 'work',
    workwear: 'work',
    romantic: 'date',
    dinner: 'date',
    wedding: 'formal',
    event: 'formal',
    club: 'party',
    celebration: 'party',
    active: 'gym',
    workout: 'gym',
    training: 'gym',
  };
  // Handle sub-variant inputs like 'date-dinner', 'casual-brunch' — extract the base
  const basePart = normalized.includes('-') ? normalized.split('-')[0] : normalized;
  const resolved = aliases[normalized] || aliases[basePart] || (OCCASION_PROFILES[normalized] ? normalized : basePart);
  return OCCASION_PROFILES[resolved] ? resolved : 'casual';
}

function normalizeTimeOfDay(value) {
  const normalized = String(value || 'afternoon').toLowerCase();
  const aliases = {
    am: 'morning',
    noon: 'afternoon',
    pm: 'afternoon',
    late: 'evening',
    midnight: 'night',
    dawn: 'morning',
    dusk: 'evening',
    day: 'afternoon',
    brunch: 'morning',
    lunch: 'afternoon',
    dinner: 'evening',
    supper: 'evening',
    breakfast: 'morning',
  };
  const resolved = aliases[normalized] || normalized;
  return TIME_PROFILES[resolved] ? resolved : 'afternoon';
}

function normalizeWeatherBand(value, temp) {
  const normalized = String(value || 'warm').toLowerCase();
  if (['hot', 'warm', 'cool', 'cold'].includes(normalized)) return normalized;
  if (temp != null) {
    const t = Number(temp);
    if (!Number.isNaN(t)) {
      if (t >= 30) return 'hot';
      if (t >= 20) return 'warm';
      if (t >= 10) return 'cool';
      return 'cold';
    }
  }
  if (['rain', 'rainy', 'humid', 'sunny', 'clear'].includes(normalized)) return 'warm';
  if (['snow', 'snowy', 'freezing', 'winter'].includes(normalized)) return 'cold';
  return 'warm';
}

// ═══════════════════════════════════════════════════════════════════════════
// REQUEST SEED
// ═══════════════════════════════════════════════════════════════════════════

function buildWardrobeSeedKey(wardrobe) {
  const signature = wardrobe
    .map(item => [
      id(item),
      normalizeSeedPart(item.category, 'other'),
      normalizeSeedPart(item.color, 'na'),
      normalizeSeedPart(item.style, 'na'),
      normalizeSeedPart(item.semanticProfile?.dressCode, 'na'),
      normalizeSeedPart(item.semanticProfile?.texture, 'na'),
      normalizeSeedPart(item.semanticProfile?.structure, 'na'),
      item.wearCount || 0,
      seedDateKey(item.lastWorn),
    ].join('~'))
    .sort()
    .join('|');

  return hashString(signature || 'empty').toString(36);
}

function buildRequestSeed({ userId, occasion, timeOfDay, weather, variant, wardrobe, forecast, weatherDetail }) {
  const dayKey = new Date().toISOString().slice(0, 10);
  const weatherKey = [
    forecast?.needsLayers ? 'layer' : 'nolayer',
    forecast?.hasRainRisk ? 'rain' : 'dry',
    Math.round(Number(forecast?.tempSwing) || 0),
    weatherDetail?.temperature != null ? Math.round(Number(weatherDetail.temperature)) : 'na',
    normalizeSeedPart(weatherDetail?.condition, 'clear'),
  ].join(':');

  return [
    normalizeSeedPart(userId, 'anon'),
    dayKey,
    normalizeSeedPart(occasion, 'casual'),
    normalizeSeedPart(timeOfDay, 'afternoon'),
    normalizeSeedPart(weather, 'warm'),
    normalizeSeedPart(variant, 'base'),
    buildWardrobeSeedKey(wardrobe || []),
    weatherKey,
  ].join(':');
}

// ═══════════════════════════════════════════════════════════════════════════
// ACCESSORY HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function getAccessoryType(acc) {
  const n = (acc.name || acc.subcategory || '').toLowerCase();
  if (n.includes('watch') || n.includes('timepiece')) return 'watch';
  if (n.includes('bag') || n.includes('purse') || n.includes('handbag') || n.includes('tote') || n.includes('backpack')) return 'bag';
  if (n.includes('belt')) return 'belt';
  if (n.includes('necklace') || n.includes('bracelet') || n.includes('ring') || n.includes('earring') || n.includes('jewelry') || n.includes('chain')) return 'jewelry';
  if (n.includes('hat') || n.includes('cap') || n.includes('beanie') || n.includes('headband')) return 'hat';
  if (n.includes('scarf') || n.includes('wrap')) return 'scarf';
  if (n.includes('sunglass') || n.includes('glasses')) return 'sunglasses';
  if (n.includes('tie') || n.includes('bowtie')) return 'tie';
  return 'other';
}

// ═══════════════════════════════════════════════════════════════════════════
// WARDROBE PROFILE
// ═══════════════════════════════════════════════════════════════════════════

function getWardrobeProfile(wardrobe) {
  const counts = wardrobe.reduce((acc, item) => {
    const key = item.category || 'other';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const total = wardrobe.length;
  return {
    total,
    counts,
    isTiny: total <= 8,
    isSmall: total <= 15,
    isMedium: total > 15 && total <= 40,
    isLarge: total > 40,
    hasTops: !!counts.top,
    hasBottoms: !!counts.bottom,
    hasDresses: !!counts.dress,
    hasShoes: !!counts.shoes,
    hasOuterwear: !!counts.outerwear,
    hasAccessories: !!counts.accessory,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ITEM ROTATION
// ═══════════════════════════════════════════════════════════════════════════

function daysSince(dateValue) {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  return (Date.now() - date.getTime()) / 86400000;
}

function scoreItemRotation(item) {
  let score = 0.55;
  const wearCount = item.wearCount || 0;
  const days = daysSince(item.lastWorn);

  if (wearCount === 0) score += 0.22;
  else if (wearCount <= 2) score += 0.12;
  else if (wearCount >= 15) score -= 0.14;
  else if (wearCount >= 8) score -= 0.08;

  if (days == null) score += 0.08;
  else if (days >= 45) score += 0.18;
  else if (days >= 14) score += 0.10;
  else if (days <= 2) score -= 0.22;
  else if (days <= 7) score -= 0.12;

  if (item.favorite) score += 0.03;
  return clamp(score, 0.05, 1);
}

function outfitRotationScore(items) {
  if (!items.length) return 0.5;
  return items.reduce((total, item) => total + scoreItemRotation(item), 0) / items.length;
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLE GROUPS & DIRECTION
// ═══════════════════════════════════════════════════════════════════════════

function getStyleGroup(styleRaw) {
  const style = (styleRaw || '').toLowerCase();
  if (!style) return 'versatile';
  if (['classic', 'formal', 'elegant', 'minimalist', 'preppy'].includes(style)) return 'classic';
  if (['casual', 'bohemian', 'vintage', 'romantic'].includes(style)) return 'relaxed';
  if (['streetwear', 'edgy', 'bold', 'punk', 'grunge'].includes(style)) return 'statement';
  if (['athletic', 'sporty', 'activewear'].includes(style)) return 'athletic';
  return style;
}

function getDominantStyleGroup(items) {
  const counts = {};
  items.forEach(item => {
    const key = getStyleGroup(item.style);
    counts[key] = (counts[key] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || 'versatile';
}

const NEUTRALS = new Set([
  'black', 'white', 'gray', 'grey', 'beige', 'tan', 'navy', 'brown',
  'cream', 'ivory', 'charcoal', 'khaki', 'taupe', 'off-white', 'nude',
]);

function getColorFamily(colorRaw) {
  const color = (colorRaw || '').toLowerCase().trim();
  if (!color) return 'neutral';
  if (NEUTRALS.has(color)) return 'neutral';
  if (['black', 'white', 'gray', 'grey', 'beige', 'brown', 'tan', 'cream', 'ivory', 'charcoal', 'khaki', 'taupe', 'navy'].some(token => color.includes(token))) return 'neutral';
  if (['burgundy', 'maroon', 'wine', 'red', 'rust'].some(token => color.includes(token))) return 'red';
  if (['orange', 'coral', 'peach', 'amber', 'terracotta'].some(token => color.includes(token))) return 'orange';
  if (['yellow', 'gold', 'mustard'].some(token => color.includes(token))) return 'yellow';
  if (['green', 'olive', 'mint', 'sage', 'emerald', 'teal'].some(token => color.includes(token))) return 'green';
  if (['blue', 'navy', 'sky', 'cyan', 'indigo'].some(token => color.includes(token))) return 'blue';
  if (['purple', 'violet', 'lavender', 'plum'].some(token => color.includes(token))) return 'purple';
  if (['pink', 'rose', 'blush', 'magenta'].some(token => color.includes(token))) return 'pink';
  return 'neutral';
}

function getPaletteDirection(items) {
  const families = items.map(item => getColorFamily(item.color)).filter(Boolean);
  const accents = families.filter(family => family !== 'neutral');
  if (accents.length === 0) return { key: 'neutral', label: 'Neutral' };

  const counts = {};
  accents.forEach(family => {
    counts[family] = (counts[family] || 0) + 1;
  });
  const primary = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || accents[0];
  const uniqueAccentCount = new Set(accents).size;
  const mostlyNeutral = accents.length <= 1 || families.length - accents.length >= accents.length;

  if (mostlyNeutral) {
    return { key: `pop:${primary}`, label: `${primary[0].toUpperCase()}${primary.slice(1)} Pop` };
  }
  if (uniqueAccentCount === 1) {
    return { key: `tonal:${primary}`, label: `Tonal ${primary[0].toUpperCase()}${primary.slice(1)}` };
  }
  return { key: `mixed:${primary}`, label: 'Mixed Palette' };
}

function getStructureDirection(items) {
  if (items.some(item => item.category === 'dress')) return 'dress-led';
  if (items.some(item => item.category === 'outerwear')) return 'layered';
  return 'separates';
}

function getOutfitDirection(items) {
  const palette = getPaletteDirection(items);
  const structure = getStructureDirection(items);
  const styleGroup = getDominantStyleGroup(items);
  return {
    key: `${structure}:${palette.key}:${styleGroup}`,
    paletteKey: palette.key,
    paletteLabel: palette.label,
    structure,
    styleGroup,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SEMANTIC PROFILE HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function getSemanticProfileCached(item, ctx = null) {
  const itemId = id(item) || `${item.name || 'item'}:${item.category || 'other'}:${item.color || ''}`;
  if (ctx?.semanticProfileMap?.has(itemId)) return ctx.semanticProfileMap.get(itemId);
  const profile = getSemanticProfile(item);
  if (ctx?.semanticProfileMap) ctx.semanticProfileMap.set(itemId, profile);
  return profile;
}

function averageSemanticEmbedding(items, ctx = null) {
  if (!items.length) return SEMANTIC_AXIS_KEYS.map(() => 0.5);

  const sums = SEMANTIC_AXIS_KEYS.map(() => 0);
  items.forEach(item => {
    const embedding = getSemanticProfileCached(item, ctx).embedding || [];
    SEMANTIC_AXIS_KEYS.forEach((_, index) => {
      sums[index] += Number(embedding[index] ?? 0.5);
    });
  });

  return sums.map(value => Math.round((value / items.length) * 1000) / 1000);
}

function embeddingSimilarity(embeddingA, embeddingB) {
  if (!Array.isArray(embeddingA) || !Array.isArray(embeddingB) || embeddingA.length !== embeddingB.length || embeddingA.length === 0) {
    return 0.5;
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < embeddingA.length; i++) {
    const a = clamp(Number(embeddingA[i]) || 0.5, 0, 1);
    const b = clamp(Number(embeddingB[i]) || 0.5, 0, 1);
    dot += a * b;
    magA += a * a;
    magB += b * b;
  }

  if (magA <= 0 || magB <= 0) return 0.5;
  return clamp(dot / (Math.sqrt(magA) * Math.sqrt(magB)), 0, 1);
}

function semanticOutfitCohesionCached(items, ctx) {
  if (!items.length || items.length === 1) return 0.6;
  let total = 0;
  let count = 0;

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      total += semanticCompatibility(
        getSemanticProfileCached(items[i], ctx),
        getSemanticProfileCached(items[j], ctx),
        ctx?.occasion || 'casual',
      );
      count++;
    }
  }

  return count > 0 ? total / count : 0.6;
}

function getCandidateSemanticDescriptor(items, ctx) {
  const embedding = averageSemanticEmbedding(items, ctx);
  const aesthetics = [...new Set(items.flatMap(item => getSemanticProfileCached(item, ctx).aesthetics || []))];
  const vibes = [...new Set(items.flatMap(item => getSemanticProfileCached(item, ctx).vibeKeywords || []))];
  return { embedding, aesthetics, vibes };
}

// ═══════════════════════════════════════════════════════════════════════════
// COLOR HARMONY
// ═══════════════════════════════════════════════════════════════════════════

function colorHarmony(c1r, c2r) {
  const c1 = (c1r || '').toLowerCase().trim();
  const c2 = (c2r || '').toLowerCase().trim();
  if (!c1 || !c2) return 0.5;
  if (NEUTRALS.has(c1) || NEUTRALS.has(c2)) return 0.85;
  if (c1 === c2) return 0.75;

  const comp = {
    red: ['green', 'teal', 'emerald', 'mint'],
    blue: ['orange', 'coral', 'peach', 'amber'],
    yellow: ['purple', 'violet', 'lavender', 'plum'],
    green: ['red', 'pink', 'rose', 'magenta'],
    purple: ['yellow', 'gold', 'mustard', 'amber'],
    orange: ['blue', 'navy', 'cyan', 'sky'],
    pink: ['green', 'mint', 'sage', 'olive'],
    teal: ['coral', 'peach', 'salmon', 'terracotta'],
  };
  if (comp[c1]?.includes(c2) || comp[c2]?.includes(c1)) return 0.92;

  const analog = {
    red: ['pink', 'coral', 'orange', 'burgundy', 'maroon', 'wine'],
    blue: ['navy', 'teal', 'purple', 'indigo', 'cyan', 'sky'],
    green: ['teal', 'yellow', 'lime', 'olive', 'sage', 'mint', 'emerald'],
    yellow: ['orange', 'green', 'gold', 'amber', 'lime', 'mustard'],
    purple: ['blue', 'pink', 'violet', 'lavender', 'plum', 'mauve'],
    orange: ['red', 'yellow', 'coral', 'peach', 'amber', 'terracotta'],
    pink: ['red', 'purple', 'rose', 'coral', 'magenta', 'blush'],
  };
  if (analog[c1]?.includes(c2) || analog[c2]?.includes(c1)) return 0.82;

  const warm = new Set(['red', 'orange', 'yellow', 'pink', 'coral', 'peach', 'amber', 'gold', 'burgundy', 'wine', 'terracotta', 'rust']);
  const cool = new Set(['blue', 'green', 'purple', 'teal', 'cyan', 'navy', 'mint', 'sage', 'emerald', 'lavender']);
  if ((warm.has(c1) && warm.has(c2)) || (cool.has(c1) && cool.has(c2))) return 0.7;

  return 0.5;
}

function outfitColorHarmony(items) {
  if (items.length < 2) return 0.5;
  let total = 0, count = 0;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (items[i].color && items[j].color) {
        total += colorHarmony(items[i].color, items[j].color);
        count++;
      }
    }
  }
  return count > 0 ? total / count : 0.5;
}

// ═══════════════════════════════════════════════════════════════════════════
// TREND ALIGNMENT
// ═══════════════════════════════════════════════════════════════════════════

const TREND_SIGNALS = [
  { name: 'quiet luxury',    styles: ['classic', 'minimalist', 'elegant'],  keywords: ['cashmere', 'silk', 'tailored', 'neutral', 'monochrome', 'camel', 'cream', 'beige'], weight: 0.9 },
  { name: 'coastal',         styles: ['casual', 'relaxed'],                  keywords: ['linen', 'cotton', 'stripe', 'navy', 'white', 'sand', 'beach', 'nautical'],         weight: 0.8 },
  { name: 'gorpcore',        styles: ['athletic', 'sporty', 'outdoor'],      keywords: ['fleece', 'trail', 'cargo', 'utility', 'technical', 'vest', 'parka', 'hiking'],     weight: 0.7 },
  { name: 'ballet core',     styles: ['romantic', 'feminine'],               keywords: ['wrap', 'ballet', 'satin', 'ribbon', 'bow', 'blush', 'tulle', 'pastel'],            weight: 0.7 },
  { name: 'street',          styles: ['streetwear', 'edgy', 'bold'],         keywords: ['graphic', 'oversized', 'cargo', 'sneaker', 'hoodie', 'drop shoulder'],            weight: 0.75 },
  { name: 'new romantic',    styles: ['romantic', 'bohemian', 'vintage'],    keywords: ['lace', 'velvet', 'brocade', 'pearl', 'embroidery', 'ruffle', 'floral'],            weight: 0.65 },
  { name: 'tomboy chic',     styles: ['casual', 'edgy'],                     keywords: ['blazer', 'trouser', 'loafer', 'oxford', 'androgynous', 'boyfriend'],               weight: 0.6 },
];

function trendAlignmentScore(items, styleDNA) {
  let best = 0;
  for (const trend of TREND_SIGNALS) {
    let hits = 0;
    const total = items.length * 2;
    items.forEach(item => {
      if (trend.styles.includes((item.style || '').toLowerCase())) hits++;
      const desc = `${item.name || ''} ${item.subcategory || ''} ${(item.tags || []).join(' ')}`.toLowerCase();
      if (trend.keywords.some(kw => desc.includes(kw))) hits++;
    });
    const ratio = total > 0 ? (hits / total) * trend.weight : 0;
    if (ratio > best) best = ratio;
  }
  return clamp(best, 0, 1);
}

// ═══════════════════════════════════════════════════════════════════════════
// RECOMMENDATION CACHE
// ═══════════════════════════════════════════════════════════════════════════

const _recCache = new Map();
const REC_CACHE_TTL = 10 * 60 * 1000;

function recCacheGet(seed, feedbackCount) {
  const entry = _recCache.get(seed);
  if (!entry) return null;
  if (Date.now() - entry.ts > REC_CACHE_TTL) { _recCache.delete(seed); return null; }
  if (entry.feedbackCount !== feedbackCount) { _recCache.delete(seed); return null; }
  return entry.results;
}

function recCacheSet(seed, results, feedbackCount) {
  if (_recCache.size > 500) {
    const oldest = [..._recCache.entries()].sort((a, b) => a[1].ts - b[1].ts).slice(0, 100);
    oldest.forEach(([k]) => _recCache.delete(k));
  }
  _recCache.set(seed, { results, feedbackCount, ts: Date.now() });
}

module.exports = {
  clamp,
  hashString,
  seededNoise,
  id,
  normalizeSeedPart,
  makeRecommendationId,
  normalizeRecommendationScore,
  getCurrentSeason,
  normalizeOccasion,
  normalizeTimeOfDay,
  normalizeWeatherBand,
  buildRequestSeed,
  getAccessoryType,
  getWardrobeProfile,
  daysSince,
  scoreItemRotation,
  outfitRotationScore,
  getStyleGroup,
  getDominantStyleGroup,
  NEUTRALS,
  getColorFamily,
  getPaletteDirection,
  getStructureDirection,
  getOutfitDirection,
  getSemanticProfileCached,
  averageSemanticEmbedding,
  embeddingSimilarity,
  semanticOutfitCohesionCached,
  getCandidateSemanticDescriptor,
  colorHarmony,
  outfitColorHarmony,
  TREND_SIGNALS,
  trendAlignmentScore,
  recCacheGet,
  recCacheSet,
};
