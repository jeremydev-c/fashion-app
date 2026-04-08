const express = require('express');
const ClothingItem = require('../models/ClothingItem');
const StyleDNA = require('../models/StyleDNA');
const UserPreferences = require('../models/UserPreferences');
const Outfit = require('../models/Outfit');
const LearningHistory = require('../models/LearningHistory');
const ApiUsage = require('../models/ApiUsage');
const {
  OCCASION_PROFILES,
  TIME_PROFILES,
  checkItemAppropriateness,
  evaluateFashionIntelligence,
} = require('../utils/fashionIntelligence');
const {
  SEMANTIC_AXIS_KEYS,
  getSemanticProfile,
  semanticCompatibility,
  semanticOutfitSimilarity,
  summarizeSemanticProfile,
} = require('../utils/semanticStyleProfile');

const { enforceDailyRecommendations } = require('../middleware/planLimits');

const router = express.Router();

// In-memory result cache — keyed by requestSeed, 10-min TTL
// Bypassed when feedback count changes (user just rated something)
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
    // Evict oldest entries when cache grows large
    const oldest = [..._recCache.entries()].sort((a, b) => a[1].ts - b[1].ts).slice(0, 100);
    oldest.forEach(([k]) => _recCache.delete(k));
  }
  _recCache.set(seed, { results, feedbackCount, ts: Date.now() });
}

router.get('/test', (_req, res) => {
  res.json({ message: 'Recommendations route is working!' });
});

/**
 * GET /recommendations?userId=...&occasion=casual&timeOfDay=afternoon&weather=warm
 */
router.get('/', enforceDailyRecommendations(), async (req, res) => {
  try {
    const { userId, occasion, timeOfDay, weather, limit, variant, needsLayers, hasRainRisk, tempSwing, temperature, condition, humidity, windSpeed } = req.query;
    const recommendationLimit = clamp(parseInt(limit, 10) || 3, 1, 6);

    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const wardrobe = await ClothingItem.find({ userId }).lean();
    if (wardrobe.length === 0) {
      return res.status(400).json({ error: 'Your wardrobe is empty! Add some items to get outfit recommendations.' });
    }
    if (wardrobe.length < 2) {
      return res.status(400).json({ error: 'Add at least one more item to start getting outfit recommendations.' });
    }

    const [styleDNA, preferences, savedOutfits, recentFeedback] = await Promise.all([
      StyleDNA.findOne({ userId }).lean(),
      UserPreferences.findOne({ userId }).lean(),
      Outfit.find({ userId }).limit(30).sort({ createdAt: -1 }).lean(),
      LearningHistory.find({ userId }).sort({ timestamp: -1 }).limit(100).lean(),
    ]);

    // Build a set of recently rejected item IDs (last 50 negative signals) to deprioritize
    const rejectedItemIds = new Set();
    const likedItemIds = new Set();
    if (recentFeedback) {
      for (const fb of recentFeedback) {
        const neg = fb.interactionType === 'reject' || fb.interactionType === 'rejected' ||
                    fb.interactionType === 'swipe_left' ||
                    ((fb.interactionType === 'rate' || fb.interactionType === 'rated') && fb.rating <= 2);
        const pos = fb.interactionType === 'save' || fb.interactionType === 'saved' ||
                    fb.interactionType === 'swipe_right' ||
                    ((fb.interactionType === 'rate' || fb.interactionType === 'rated') && fb.rating >= 4);
        if (neg && fb.itemIds) fb.itemIds.forEach(id => rejectedItemIds.add(id));
        if (pos && fb.itemIds) fb.itemIds.forEach(id => likedItemIds.add(id));
      }
    }

    const parsedTemp = temperature ? parseFloat(temperature) : null;
    const parsedHumidity = humidity ? parseFloat(humidity) : null;
    const parsedWind = windSpeed ? parseFloat(windSpeed) : null;
    const parsedCondition = condition ? condition.toLowerCase() : null;

    const weatherDetail = {
      temperature: parsedTemp,
      condition: parsedCondition,
      humidity: parsedHumidity,
      windSpeed: parsedWind,
      isRainy: parsedCondition ? ['rain', 'drizzle', 'thunderstorm', 'shower'].some(r => parsedCondition.includes(r)) : false,
      isSnowy: parsedCondition ? ['snow', 'sleet', 'blizzard'].some(r => parsedCondition.includes(r)) : false,
      isWindy: parsedWind != null ? parsedWind > 6 : false,
      isHumid: parsedHumidity != null ? parsedHumidity > 75 : false,
      isSunny: parsedCondition ? ['clear', 'sunny'].some(r => parsedCondition.includes(r)) : false,
      isCloudy: parsedCondition ? ['clouds', 'overcast', 'fog', 'mist', 'haze'].some(r => parsedCondition.includes(r)) : false,
    };

    const forecast = {
      needsLayers: needsLayers === 'true',
      hasRainRisk: hasRainRisk === 'true' || weatherDetail.isRainy,
      tempSwing: tempSwing ? parseFloat(tempSwing) : 0,
    };
    const normalizedOccasion = normalizeOccasion(occasion);
    const normalizedTimeOfDay = normalizeTimeOfDay(timeOfDay);
    const normalizedWeather = normalizeWeatherBand(weather, parsedTemp);
    const requestVariant = normalizeSeedPart(variant, 'base');

    const ctx = {
      wardrobe,
      wardrobeProfile: getWardrobeProfile(wardrobe),
      wardrobeById: new Map(wardrobe.map(item => [id(item), item])),
      semanticProfileMap: new Map(wardrobe.map(item => [id(item), getSemanticProfile(item)])),
      styleDNA,
      preferences,
      savedOutfits: savedOutfits || [],
      recentFeedback: recentFeedback || [],
      rejectedItemIds,
      likedItemIds,
      occasion: normalizedOccasion,
      timeOfDay: normalizedTimeOfDay,
      weather: normalizedWeather,
      weatherDetail,
      limit: recommendationLimit,
      requestVariant,
      requestSeed: buildRequestSeed({
        userId,
        occasion: normalizedOccasion,
        timeOfDay: normalizedTimeOfDay,
        weather: normalizedWeather,
        variant: requestVariant,
        wardrobe,
        forecast,
        weatherDetail,
      }),
      forecast,
    };

    const recommendations = await generateHybridRecommendations(ctx);
    res.json({ recommendations });
  } catch (err) {
    console.error('GET /recommendations error', err);
    res.status(500).json({ 
      error: 'Failed to generate recommendations',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
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

function makeRecommendationId(prefix, seed, slot) {
  return `${prefix}_${hashString(`${seed}:${slot}`).toString(36)}`;
}

function normalizeRecommendationScore(value) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 72;
  if (numeric <= 1.01) return Math.round(clamp(numeric, 0, 1) * 100);
  return Math.round(clamp(numeric, 0, 100));
}

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

function getCurrentSeason() {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'fall';
  return 'winter';
}

function normalizeOccasion(value) {
  const normalized = String(value || 'casual').toLowerCase();
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
  const resolved = aliases[normalized] || normalized;
  return OCCASION_PROFILES[resolved] ? resolved : 'casual';
}

function normalizeTimeOfDay(value) {
  const normalized = String(value || 'afternoon').toLowerCase();
  const aliases = {
    am: 'morning',
    noon: 'afternoon',
    pm: 'afternoon',
    late: 'evening',
    'late-night': 'night',
    nighttime: 'night',
  };
  const resolved = aliases[normalized] || normalized;
  return TIME_PROFILES[resolved] ? resolved : 'afternoon';
}

function normalizeWeatherBand(value, temperature = null) {
  const normalized = String(value || '').toLowerCase().trim();
  if (['hot', 'warm', 'cool', 'cold'].includes(normalized)) return normalized;
  if (temperature != null && !Number.isNaN(temperature)) {
    if (temperature >= 28) return 'hot';
    if (temperature >= 21) return 'warm';
    if (temperature >= 13) return 'cool';
    return 'cold';
  }
  if (['rain', 'rainy', 'humid', 'sunny', 'clear'].includes(normalized)) return 'warm';
  if (['snow', 'snowy', 'freezing', 'winter'].includes(normalized)) return 'cold';
  return 'warm';
}

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

function itemPreferenceFit(item, ctx) {
  const { preferences, styleDNA, likedItemIds, rejectedItemIds, occasion } = ctx;
  let score = 0.5;
  const color = (item.color || '').toLowerCase();
  const style = (item.style || '').toLowerCase();
  const category = (item.category || '').toLowerCase();
  const pattern = (item.pattern || '').toLowerCase();
  const semantic = getSemanticProfileCached(item, ctx);
  const semanticAesthetics = semantic.aesthetics || [];
  const targetFormality = {
    casual: 0.40,
    work: 0.70,
    date: 0.58,
    party: 0.66,
    gym: 0.18,
    formal: 0.88,
  }[occasion] || 0.48;

  score += (1 - Math.abs((semantic.axes?.formality || 0.5) - targetFormality)) * 0.08;

  if (preferences) {
    const preferredColors = (preferences.preferredColors || []).map(value => value.toLowerCase());
    const preferredStyles = (preferences.preferredStyles || []).map(value => value.toLowerCase());
    const preferredCategories = (preferences.preferredCategories || []).map(value => value.toLowerCase());
    const preferredPatterns = (preferences.preferredPatterns || []).map(value => value.toLowerCase());
    const avoidedColors = (preferences.avoidedColors || []).map(value => value.toLowerCase());
    const avoidedStyles = (preferences.avoidedStyles || []).map(value => value.toLowerCase());

    if (preferredColors.includes(color)) score += 0.12;
    if (preferredStyles.includes(style)) score += 0.12;
    if (semanticAesthetics.some(value => preferredStyles.includes(value))) score += 0.06;
    if (preferredCategories.includes(category)) score += 0.08;
    if (preferredPatterns.includes(pattern)) score += 0.05;
    if (avoidedColors.includes(color)) score -= 0.24;
    if (avoidedStyles.includes(style)) score -= 0.18;
    if (semanticAesthetics.some(value => avoidedStyles.includes(value))) score -= 0.12;

    if ((item.occasion || []).map(value => value.toLowerCase()).includes(occasion)) {
      score += 0.08;
    }
  }

  if (styleDNA?.primaryStyle && style === String(styleDNA.primaryStyle).toLowerCase()) score += 0.10;
  if (styleDNA?.primaryStyle && semanticAesthetics.includes(String(styleDNA.primaryStyle).toLowerCase())) score += 0.04;
  if (styleDNA?.secondaryStyles?.map(value => value.toLowerCase()).includes(style)) score += 0.05;
  if (likedItemIds?.has(id(item))) score += 0.08;
  if (rejectedItemIds?.has(id(item))) score -= 0.25;

  // Body type fit scoring
  const bodyType = (preferences?.bodyType || styleDNA?.bodyType || '').toLowerCase();
  if (bodyType) score += bodyTypeFitScore(item, bodyType) * 0.08;

  return clamp(score, 0, 1);
}

// Body type → item fit rules (boost items that flatter, penalise those that don't)
function bodyTypeFitScore(item, bodyType) {
  const desc = `${item.name} ${item.subcategory} ${(item.tags || []).join(' ')} ${item.style || ''}`.toLowerCase();
  const cat = (item.category || '').toLowerCase();

  const isWideleg   = desc.includes('wide') || desc.includes('palazzo') || desc.includes('flare');
  const isAline     = desc.includes('a-line') || desc.includes('flared skirt') || desc.includes('fit and flare');
  const isSkinny    = desc.includes('skinny') || desc.includes('slim fit') || desc.includes('fitted');
  const isCrop      = desc.includes('crop') || desc.includes('cropped');
  const isHighWaist = desc.includes('high waist') || desc.includes('high-waist');
  const isBodycon   = desc.includes('bodycon') || desc.includes('body-con') || desc.includes('fitted dress');
  const isOversized = desc.includes('oversized') || desc.includes('relaxed') || desc.includes('loose');
  const isBlazer    = cat === 'outerwear' || desc.includes('blazer') || desc.includes('jacket');
  const isShorts    = cat === 'bottom' && (desc.includes('short') || desc.includes('mini'));

  const fits = {
    hourglass:  (isBodycon || isHighWaist || isBlazer ? 0.6 : 0) + (isWideleg ? 0.4 : 0),
    pear:       (isAline || isWideleg || isHighWaist ? 0.6 : 0) + (isBlazer ? 0.3 : 0) + (isSkinny && cat === 'bottom' ? -0.5 : 0),
    apple:      (isHighWaist || isAline ? 0.5 : 0) + (isCrop ? -0.4 : 0) + (isBlazer ? 0.3 : 0),
    rectangle:  (isBlazer || isAline || isBodycon ? 0.4 : 0) + (isOversized ? -0.2 : 0),
    'inverted triangle': (isWideleg || isAline ? 0.5 : 0) + (isBlazer ? -0.3 : 0) + (isShorts ? 0.2 : 0),
    petite:     (isCrop || isHighWaist ? 0.5 : 0) + (isOversized ? -0.3 : 0),
    tall:       (isOversized || isWideleg ? 0.3 : 0),
  };
  return clamp((fits[bodyType] || 0), -1, 1);
}

// ═══════════════════════════════════════════════════════════════════════════
// COLOR HARMONY
// ═══════════════════════════════════════════════════════════════════════════

const NEUTRALS = new Set([
  'black', 'white', 'gray', 'grey', 'beige', 'tan', 'navy', 'brown',
  'cream', 'ivory', 'charcoal', 'khaki', 'taupe', 'off-white', 'nude',
]);

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
// PAIRWISE COMPATIBILITY (style + color + pattern)
// ═══════════════════════════════════════════════════════════════════════════

function pairCompat(a, b, preferences, occasion, ctx = null) {
  let s = 0.24;
  if (a.color && b.color) s += colorHarmony(a.color, b.color) * 0.3;
  s += semanticCompatibility(
    getSemanticProfileCached(a, ctx),
    getSemanticProfileCached(b, ctx),
    occasion,
  ) * 0.32;

  const profile = OCCASION_PROFILES[occasion] || OCCASION_PROFILES.casual;
  const aStyle = (a.style || '').toLowerCase();
  const bStyle = (b.style || '').toLowerCase();

  if (aStyle && bStyle) {
    if (aStyle === bStyle) {
      s += 0.2;
    } else {
      const both = [aStyle, bStyle];
      const prefHits = both.filter(st => profile.preferredStyles.includes(st)).length;
      const avoidHits = both.filter(st => profile.avoidStyles.includes(st)).length;
      s += prefHits * 0.08;
      s -= avoidHits * 0.12;
    }
  }

  if (a.pattern && b.pattern) {
    if (a.pattern === 'solid' || b.pattern === 'solid') s += 0.12;
    else if (a.pattern === b.pattern) s -= 0.2;
    else s -= 0.08;
  }

  if (preferences) {
    const pc = (preferences.preferredColors || []).map(c => c.toLowerCase());
    if (pc.includes((a.color || '').toLowerCase())) s += 0.05;
    if (pc.includes((b.color || '').toLowerCase())) s += 0.05;

    // Learned weighted color preferences boost
    const cw = preferences.colorWeights instanceof Map ? Object.fromEntries(preferences.colorWeights) : (preferences.colorWeights || {});
    const aColorW = cw[(a.color || '').toLowerCase()] || 0;
    const bColorW = cw[(b.color || '').toLowerCase()] || 0;
    if (aColorW > 0) s += Math.min(aColorW * 0.02, 0.04);
    if (bColorW > 0) s += Math.min(bColorW * 0.02, 0.04);

    // Penalize avoided combinations
    const avoidedCombos = preferences.avoidedCombinations || [];
    if (a.color && b.color && avoidedCombos.length > 0) {
      const combo = [a.color.toLowerCase(), b.color.toLowerCase()].sort().join('+');
      if (avoidedCombos.includes(combo)) s -= 0.15;
    }

    // Penalize avoided styles
    const avoidedStyles = (preferences.avoidedStyles || []).map(st => st.toLowerCase());
    if (avoidedStyles.includes(aStyle)) s -= 0.08;
    if (avoidedStyles.includes(bStyle)) s -= 0.08;
  }

  return Math.max(0, Math.min(1, s));
}

function rankPool(anchor, pool, preferences, occasion, keepAll = false, ctx = null) {
  if (!pool.length) return [];
  const scored = pool
    .map(item => ({
      item,
      score: (
        pairCompat(anchor, item, preferences, occasion, ctx) * 0.74 +
        scoreItemRotation(item) * 0.16 +
        (ctx ? itemPreferenceFit(item, ctx) : 0.5) * 0.08 +
        seededNoise(ctx?.requestSeed || 'rank', `${id(anchor)}:${id(item)}:${occasion}`) * 0.04
      ),
    }))
    .sort((a, b) => b.score - a.score);

  if (keepAll || pool.length <= 4) return scored.map(({ item }) => item);
  return scored.filter(({ score }) => score > 0.15).map(({ item }) => item);
}

// ═══════════════════════════════════════════════════════════════════════════
// OUTFIT SCORING — occasion + time + weather + user prefs + learning
// ═══════════════════════════════════════════════════════════════════════════

function scoreOutfit(items, ctx, cachedIntel) {
  const { styleDNA, preferences, savedOutfits, occasion, timeOfDay, weather, rejectedItemIds, likedItemIds } = ctx;
  let s = 0.35;

  // 1. Fashion intelligence — all 12 algorithms (occasion, time, color, pattern, texture,
  //    silhouette, seasonal color, weather, completeness, trend, versatility, wow factor)
  const intel = cachedIntel || evaluateFashionIntelligence(items, occasion, weather, timeOfDay, ctx.weatherDetail);
  s += intel.score * 0.35;
  const semanticCohesion = semanticOutfitCohesionCached(items, ctx);
  s += semanticCohesion * 0.10;

  // 2. Style DNA alignment
  if (styleDNA) {
    const primary = items.filter(i => i.style === styleDNA.primaryStyle).length;
    s += (primary / items.length) * 0.10;
    if (styleDNA.secondaryStyles?.length) {
      const sec = items.filter(i => styleDNA.secondaryStyles.includes(i.style)).length;
      s += (sec / items.length) * 0.04;
    }
  } else {
    s += 0.05;
  }

  // 3. Color harmony across whole outfit
  s += outfitColorHarmony(items) * 0.12;

  // 4. User preferences (onboarding + learned)
  if (preferences) {
    const prefC = (preferences.preferredColors || []).map(c => c.toLowerCase());
    const prefS = (preferences.preferredStyles || []).map(st => st.toLowerCase());
    const avoidC = (preferences.avoidedColors || []).map(c => c.toLowerCase());
    const avoidS = (preferences.avoidedStyles || []).map(st => st.toLowerCase());

    // Basic preference match
    s += (items.filter(i => prefC.includes((i.color || '').toLowerCase())).length / items.length) * 0.08;
    s += (items.filter(i => prefS.includes((i.style || '').toLowerCase())).length / items.length) * 0.06;
    s -= (items.filter(i => avoidC.includes((i.color || '').toLowerCase())).length / items.length) * 0.20;
    s -= (items.filter(i => avoidS.includes((i.style || '').toLowerCase())).length / items.length) * 0.10;
    if (preferences.preferredOccasions?.includes(occasion)) s += 0.03;

    // 5. Weighted preference scores from learning history
    const colorWeights = preferences.colorWeights instanceof Map ? Object.fromEntries(preferences.colorWeights) : (preferences.colorWeights || {});
    const styleWeights = preferences.styleWeights instanceof Map ? Object.fromEntries(preferences.styleWeights) : (preferences.styleWeights || {});
    const categoryWeights = preferences.categoryWeights instanceof Map ? Object.fromEntries(preferences.categoryWeights) : (preferences.categoryWeights || {});
    const patternWeights = preferences.patternWeights instanceof Map ? Object.fromEntries(preferences.patternWeights) : (preferences.patternWeights || {});

    if (Object.keys(colorWeights).length > 0) {
      let weightedColorScore = 0;
      items.forEach(i => {
        const c = (i.color || '').toLowerCase();
        if (colorWeights[c]) weightedColorScore += colorWeights[c];
      });
      const maxPossible = items.length * Math.max(...Object.values(colorWeights), 1);
      s += (weightedColorScore / maxPossible) * 0.06;
    }

    if (Object.keys(styleWeights).length > 0) {
      let weightedStyleScore = 0;
      items.forEach(i => {
        const st = (i.style || '').toLowerCase();
        if (styleWeights[st]) weightedStyleScore += styleWeights[st];
      });
      const maxPossible = items.length * Math.max(...Object.values(styleWeights), 1);
      s += (weightedStyleScore / maxPossible) * 0.05;
    }

    if (Object.keys(categoryWeights).length > 0) {
      let weightedCatScore = 0;
      items.forEach(i => {
        const cat = (i.category || '').toLowerCase();
        if (categoryWeights[cat]) weightedCatScore += categoryWeights[cat];
      });
      const maxPossible = items.length * Math.max(...Object.values(categoryWeights), 1);
      s += (weightedCatScore / maxPossible) * 0.03;
    }

    if (Object.keys(patternWeights).length > 0) {
      let weightedPatScore = 0;
      items.forEach(i => {
        const p = (i.pattern || '').toLowerCase();
        if (patternWeights[p]) weightedPatScore += patternWeights[p];
      });
      const maxPossible = items.length * Math.max(...Object.values(patternWeights), 1);
      s += (weightedPatScore / maxPossible) * 0.02;
    }

    // 6. Per-occasion learned preferences
    const occasionPrefsMap = preferences.occasionPreferences instanceof Map
      ? Object.fromEntries(preferences.occasionPreferences)
      : (preferences.occasionPreferences || {});
    const occPref = occasionPrefsMap[occasion];
    if (occPref) {
      const occColors = occPref.preferredColors || [];
      const occStyles = occPref.preferredStyles || [];
      if (occColors.length > 0) {
        const match = items.filter(i => occColors.includes((i.color || '').toLowerCase())).length;
        s += (match / items.length) * 0.04;
      }
      if (occStyles.length > 0) {
        const match = items.filter(i => occStyles.includes((i.style || '').toLowerCase())).length;
        s += (match / items.length) * 0.03;
      }
    }

    // 7. Avoided combinations penalty
    const avoidedCombos = preferences.avoidedCombinations || [];
    if (avoidedCombos.length > 0) {
      const outfitColors = items.map(i => (i.color || '').toLowerCase()).filter(Boolean);
      const colorCombo = [...new Set(outfitColors)].sort().join('+');
      if (avoidedCombos.includes(colorCombo)) s -= 0.12;

      // Also check style-based avoidances
      const outfitStyles = items.map(i => (i.style || '').toLowerCase()).filter(Boolean);
      for (const avoided of avoidedCombos) {
        if (avoided.startsWith('style:')) {
          const avoidedStyle = avoided.slice(6);
          if (outfitStyles.includes(avoidedStyle)) s -= 0.02;
        }
      }
    }
  }

  // 8. Learning from saved outfits without collapsing into clones
  if (savedOutfits?.length > 0) {
    const curIds = new Set(items.map(id));
    let maxSimilarity = 0;
    let totalSimilarity = 0;
    let maxSemanticSimilarity = 0;
    let totalSemanticSimilarity = 0;
    savedOutfits.forEach(saved => {
      const sIds = new Set((saved.items || []).map(i => (i.itemId || '').toString()));
      const inter = [...curIds].filter(x => sIds.has(x)).length;
      const union = new Set([...curIds, ...sIds]).size;
      const sim = union > 0 ? inter / union : 0;
      maxSimilarity = Math.max(maxSimilarity, sim);
      totalSimilarity += sim;

      const savedItems = (saved.items || [])
        .map(entry => ctx.wardrobeById?.get((entry.itemId || '').toString()))
        .filter(Boolean);
      if (savedItems.length >= 2) {
        const semanticSim = semanticOutfitSimilarity(items, savedItems);
        maxSemanticSimilarity = Math.max(maxSemanticSimilarity, semanticSim);
        totalSemanticSimilarity += semanticSim;
      }
    });
    const avgSimilarity = totalSimilarity / savedOutfits.length;
    const avgSemanticSimilarity = totalSemanticSimilarity / savedOutfits.length;
    if (maxSimilarity >= 0.25 && maxSimilarity <= 0.72) {
      s += maxSimilarity * 0.05;
    }
    if (maxSimilarity > 0.82) {
      s -= Math.min((maxSimilarity - 0.82) * 0.20, 0.05);
    }
    if (avgSimilarity > 0.55) {
      s -= 0.02;
    }
    if (maxSemanticSimilarity >= 0.28 && maxSemanticSimilarity <= 0.78) {
      s += maxSemanticSimilarity * 0.04;
    }
    if (maxSemanticSimilarity > 0.86) {
      s -= Math.min((maxSemanticSimilarity - 0.86) * 0.20, 0.05);
    }
    if (avgSemanticSimilarity > 0.68) {
      s -= 0.02;
    }
  }

  // 9. Rotation bonus — surface fresh pieces instead of recycling the same winners
  const rotationScore = outfitRotationScore(items);
  s += (rotationScore - 0.5) * 0.12;
  const freshCorePieces = items.filter(item =>
    ['top', 'bottom', 'dress', 'outerwear'].includes(item.category) && scoreItemRotation(item) >= 0.68
  ).length;
  if (freshCorePieces >= 2) s += 0.03;

  // 10. Recent feedback signals — boost items user liked, penalize rejected combos
  if (likedItemIds && likedItemIds.size > 0) {
    const likedInOutfit = items.filter(i => likedItemIds.has(id(i))).length;
    s += (likedInOutfit / items.length) * 0.03;
  }
  if (rejectedItemIds && rejectedItemIds.size > 0) {
    const rejectedInOutfit = items.filter(i => rejectedItemIds.has(id(i))).length;
    if (rejectedInOutfit === 1) s -= 0.03;
    if (rejectedInOutfit >= 2) s -= 0.06;
  }

  // 11. Weather — handled exclusively by algorithm #8 (checkWeatherCompleteness) inside
  //     evaluateFashionIntelligence above. Removing duplicate block prevents double-counting.

  // 12. Completeness — adapted to what's actually available in wardrobe
  const hasTop = items.some(i => i.category === 'top' || i.category === 'dress');
  const hasBot = items.some(i => i.category === 'bottom' || i.category === 'dress');
  const hasShoes = items.some(i => i.category === 'shoes');
  const hasAcc = items.some(i => i.category === 'accessory');

  const wardrobeHasShoes = ctx.wardrobe.some(i => i.category === 'shoes');
  const wardrobeHasAcc = ctx.wardrobe.some(i => i.category === 'accessory');

  let completenessChecks = 2; // top + bottom always
  let completenessMet = (hasTop ? 1 : 0) + (hasBot ? 1 : 0);
  if (wardrobeHasShoes) { completenessChecks++; completenessMet += hasShoes ? 1 : 0; }
  if (wardrobeHasAcc) { completenessChecks++; completenessMet += hasAcc ? 1 : 0; }

  s += (completenessMet / completenessChecks) * 0.06;

  // Bonus for outfit with 3-5 items (sweet spot)
  if (items.length >= 3 && items.length <= 5) s += 0.02;

  // 13. Trend alignment — small boost when outfit matches current cultural aesthetics
  s += trendAlignmentScore(items, styleDNA) * 0.04;

  return Math.max(0.40, Math.min(0.96, s));
}

// 2025-26 trend awareness — maps style groups / keywords to trending aesthetics
const TREND_SIGNALS = [
  { name: 'quiet luxury',    styles: ['classic', 'minimalist', 'elegant'],  keywords: ['cashmere', 'silk', 'tailored', 'neutral', 'monochrome', 'camel', 'cream', 'beige'], weight: 0.9 },
  { name: 'coastal',         styles: ['casual', 'relaxed'],                  keywords: ['linen', 'cotton', 'stripe', 'navy', 'white', 'sand', 'beach', 'nautical'],         weight: 0.8 },
  { name: 'gorpcore',        styles: ['athletic', 'sporty', 'outdoor'],      keywords: ['fleece', 'trail', 'cargo', 'utility', 'technical', 'vest', 'parka', 'hiking'],     weight: 0.7 },
  { name: 'ballet core',     styles: ['romantic', 'feminine'],               keywords: ['wrap', 'ballet', 'satin', 'ribbon', 'bow', 'blush', 'tulle', 'pastel'],            weight: 0.7 },
  { name: 'street',          styles: ['streetwear', 'edgy', 'bold'],         keywords: ['graphic', 'oversized', 'cargo', 'sneaker', 'hoodie', 'drop shoulder'],            weight: 0.75 },
  { name: 'office siren',    styles: ['formal', 'elegant', 'classic'],       keywords: ['pencil', 'blazer', 'tailored', 'structured', 'power', 'monochrome', 'pointed'],   weight: 0.8 },
  { name: 'boho revival',    styles: ['bohemian', 'vintage', 'romantic'],    keywords: ['floral', 'maxi', 'crochet', 'fringe', 'earthy', 'rust', 'terracotta', 'woven'],   weight: 0.65 },
];

function trendAlignmentScore(items, styleDNA) {
  const allText = items.map(i =>
    `${i.name} ${i.subcategory || ''} ${(i.tags || []).join(' ')} ${i.style || ''} ${i.color || ''} ${i.pattern || ''}`
    .toLowerCase()
  ).join(' ');
  const itemStyles = items.map(i => getStyleGroup(i.style));

  let best = 0;
  for (const trend of TREND_SIGNALS) {
    const styleHit   = trend.styles.some(s => itemStyles.includes(s));
    const keywordHit = trend.keywords.filter(k => allText.includes(k)).length;
    const dnaHit     = styleDNA?.primaryStyle && trend.styles.includes(getStyleGroup(styleDNA.primaryStyle));
    const score      = (styleHit ? 0.4 : 0) + Math.min(keywordHit * 0.15, 0.45) + (dnaHit ? 0.15 : 0);
    best = Math.max(best, score * trend.weight);
  }
  return clamp(best, 0, 1);
}

function buildReasons(items, ctx, cachedIntel) {
  const { styleDNA, preferences, occasion, timeOfDay, weather, likedItemIds, weatherDetail: wd, forecast } = ctx;
  const intel = cachedIntel || evaluateFashionIntelligence(items, occasion, weather, timeOfDay, wd);
  const reasons = [...intel.reasons];

  if (styleDNA) {
    const m = items.filter(i => i.style === styleDNA.primaryStyle).length;
    if (m === items.length) reasons.push(`Pure ${styleDNA.primaryStyle} energy`);
    else if (m > 0) reasons.push(`Channels your ${styleDNA.primaryStyle} side`);
  }

  if (preferences?.preferredColors?.length) {
    const pc = preferences.preferredColors.map(c => c.toLowerCase());
    const matchedColors = items.filter(i => pc.includes((i.color || '').toLowerCase()));
    if (matchedColors.length > 0) {
      reasons.push('Features colors you love');
    }
  }

  if (preferences?.preferredStyles?.length) {
    const ps = preferences.preferredStyles.map(s => s.toLowerCase());
    if (items.some(i => ps.includes((i.style || '').toLowerCase()))) {
      reasons.push('Matches your preferred style');
    }
  }

  if (likedItemIds && likedItemIds.size > 0) {
    const likedCount = items.filter(i => likedItemIds.has(id(i))).length;
    if (likedCount >= 2) reasons.push('Includes pieces you\'ve loved before');
    else if (likedCount === 1) reasons.push('Features a piece you enjoyed');
  }

  const semanticCohesion = semanticOutfitCohesionCached(items, ctx);
  if (semanticCohesion >= 0.78) reasons.push('The pieces share a cohesive visual vibe');

  const wdSafe = wd || {};
  const hasOuterwear = items.some(i => i.category === 'outerwear');
  const itemDescs = items.map(i => `${i.name} ${i.subcategory} ${(i.tags || []).join(' ')}`.toLowerCase());
  const hasRainProtection = itemDescs.some(d => ['rain', 'waterproof', 'trench', 'windbreaker', 'parka', 'anorak'].some(r => d.includes(r)));

  if (wdSafe.temperature != null) {
    if (weather === 'cold' && hasOuterwear) reasons.push(`Layered for ${wdSafe.temperature}° weather`);
    else if (weather === 'hot') reasons.push(`Light and breathable for ${wdSafe.temperature}°`);
    else if (weather === 'cool' && hasOuterwear) reasons.push(`Smart layering for ${wdSafe.temperature}°`);
  }
  if ((wdSafe.isRainy || forecast?.hasRainRisk) && hasRainProtection) reasons.push('Rain-ready with weather protection');
  if (wdSafe.isWindy && hasOuterwear) reasons.push('Wind-shielded with the right layers');
  if (wdSafe.isHumid && weather !== 'cold') {
    const hasLight = itemDescs.some(d => ['linen', 'cotton', 'silk', 'rayon'].some(f => d.includes(f)));
    if (hasLight) reasons.push('Breathable fabrics for humid conditions');
  }
  if (wdSafe.isSnowy && hasOuterwear) reasons.push('Bundled up for snowy conditions');
  if (outfitRotationScore(items) >= 0.7) reasons.push('Refreshes your wardrobe with underused pieces');

  if (reasons.length === 0) reasons.push('Well-balanced outfit');
  return [...new Set(reasons)].slice(0, 5);
}

function buildPresentationCopy(items, ctx) {
  const { occasion, timeOfDay, weather, weatherDetail: wd, forecast } = ctx;
  const direction = getOutfitDirection(items);

  const structureWord = direction.structure === 'dress-led'
    ? 'Dress'
    : direction.structure === 'layered'
      ? 'Layered'
      : direction.styleGroup === 'classic'
        ? 'Clean'
        : direction.styleGroup === 'statement'
          ? 'Statement'
          : direction.styleGroup === 'athletic'
            ? 'Active'
            : 'Styled';

  const paletteWord = (direction.paletteLabel || 'Neutral').split(' ')[0];
  const occasionWord = {
    casual: 'Ease',
    work: 'Polish',
    date: 'Charm',
    party: 'Energy',
    gym: 'Motion',
    formal: 'Poise',
  }[occasion] || 'Style';

  let weatherPhrase = 'keeps the outfit feeling balanced';
  if (forecast?.hasRainRisk || wd?.isRainy) weatherPhrase = 'keeps you ready for wet weather';
  else if (wd?.isSnowy || weather === 'cold') weatherPhrase = 'keeps warmth in the mix';
  else if (weather === 'hot') weatherPhrase = 'keeps things light and breathable';
  else if (weather === 'cool') weatherPhrase = 'adds just enough layering';
  else if (wd?.isHumid) weatherPhrase = 'stays breathable in the humidity';

  const timePhrase = {
    morning: 'for an easy start',
    afternoon: 'for the middle of the day',
    evening: 'for later plans',
    night: 'for after-dark plans',
  }[timeOfDay] || `for ${timeOfDay} plans`;

  return {
    title: `${structureWord} ${paletteWord} ${occasionWord}`.replace(/\s+/g, ' ').trim(),
    description: `${direction.paletteLabel} styling that ${weatherPhrase} ${timePhrase}.`,
    direction,
  };
}

function sanitizeReasonList(reasons) {
  if (!Array.isArray(reasons)) return [];
  return [...new Set(
    reasons
      .map(reason => String(reason || '').trim())
      .filter(Boolean)
      .map(reason => reason.length > 90 ? `${reason.slice(0, 87).trim()}...` : reason)
  )].slice(0, 4);
}

function sanitizeAISelections(parsed, candidateCount, limit) {
  const outfits = Array.isArray(parsed?.outfits) ? parsed.outfits : [];
  const seenIdx = new Set();
  const sanitized = [];

  for (const outfit of outfits) {
    const idx = Number(outfit?.candidateIdx);
    if (!Number.isInteger(idx) || idx < 0 || idx >= candidateCount || seenIdx.has(idx)) continue;
    seenIdx.add(idx);

    sanitized.push({
      candidateIdx: idx,
      aiConfidence: clamp(Number(outfit?.aiConfidence) || 85, 60, 99),
      title: String(outfit?.title || '').trim().slice(0, 40),
      description: String(outfit?.description || '').trim().slice(0, 140),
      enhancedReasons: sanitizeReasonList(outfit?.enhancedReasons),
    });

    if (sanitized.length >= limit) break;
  }

  return sanitized;
}

function computeRecommendationConfidence(candidate, ctx, source = 'algorithm') {
  const wardrobeProfile = ctx.wardrobeProfile || getWardrobeProfile(ctx.wardrobe || []);
  const base = (candidate.score || 0.72) * 100;
  const weatherFit = candidate.intel?.details?.weatherAdaptation?.score || 0.72;
  const occasionFit = candidate.intel?.details?.occasionFit?.score || 0.72;
  const completeness = candidate.intel?.details?.outfitCompleteness?.score || 0.72;
  const directionQuality = candidate.direction ? 1 : 0.75;
  const semanticCohesion = candidate.semanticCohesion || 0.68;

  let confidence =
    base * 0.58 +
    weatherFit * 100 * 0.15 +
    occasionFit * 100 * 0.15 +
    completeness * 100 * 0.10 +
    directionQuality * 100 * 0.01 +
    semanticCohesion * 100 * 0.01;

  if (wardrobeProfile.isTiny) confidence -= 5;
  else if (wardrobeProfile.isLarge) confidence += 2;

  if (source === 'fill') confidence -= 4;
  if (candidate.items?.length < 3 && wardrobeProfile.hasShoes) confidence -= 3;

  return Math.round(clamp(confidence, wardrobeProfile.isTiny ? 60 : 66, 98));
}

// ═══════════════════════════════════════════════════════════════════════════
// OUTFIT BUILDER — occasion-smart, time-aware, diverse
// ═══════════════════════════════════════════════════════════════════════════

function buildDiverseOutfits(ctx) {
  const { wardrobe, occasion, weather, timeOfDay, preferences, limit, forecast, weatherDetail: wd } = ctx;
  const profile = OCCASION_PROFILES[occasion] || OCCASION_PROFILES.casual;
  const wdSafe = wd || {};
  const isSmallWardrobe = wardrobe.length <= 15;
  const isTinyWardrobe = wardrobe.length <= 8;

  // ─── 1. Filter wardrobe: remove avoided colors, deprioritise poor fits ───
  let pool = [...wardrobe];

  if (preferences?.avoidedColors?.length && !isTinyWardrobe) {
    const avoid = new Set(preferences.avoidedColors.map(c => c.toLowerCase()));
    pool = pool.filter(item => !avoid.has((item.color || '').toLowerCase()));
    if (pool.length < 3) pool = [...wardrobe];
  }

  // Weather-smart item scoring for pool prioritization
  function weatherItemScore(item) {
    let ws = 0;
    const desc = `${item.name} ${item.subcategory} ${(item.tags || []).join(' ')} ${item.style || ''}`.toLowerCase();
    const lightFabrics = ['linen', 'cotton', 'silk', 'chiffon', 'rayon', 'mesh', 'seersucker'];
    const heavyFabrics = ['wool', 'cashmere', 'fleece', 'leather', 'suede', 'tweed', 'corduroy', 'velvet', 'knit'];
    const isLight = lightFabrics.some(f => desc.includes(f));
    const isHeavy = heavyFabrics.some(f => desc.includes(f));
    const isOpen = ['sandal', 'flip flop', 'slides', 'open toe', 'espadrille'].some(f => desc.includes(f));
    const isShort = item.category === 'bottom' && desc.includes('short');
    const isSleeveless = ['sleeveless', 'tank', 'cami', 'strapless'].some(f => desc.includes(f));
    const isRainReady = ['rain', 'waterproof', 'water-resistant', 'trench', 'windbreaker', 'parka', 'anorak'].some(f => desc.includes(f));

    if (weather === 'hot') {
      ws += isLight ? 0.15 : 0;
      ws += isHeavy ? -0.15 : 0;
      ws += isOpen ? 0.05 : 0;
    } else if (weather === 'warm') {
      ws += isLight ? 0.08 : 0;
      ws += isHeavy ? -0.08 : 0;
    } else if (weather === 'cool') {
      ws += isHeavy ? 0.10 : 0;
      ws += isOpen ? -0.10 : 0;
      ws += isShort ? -0.10 : 0;
      ws += isSleeveless ? -0.06 : 0;
    } else if (weather === 'cold') {
      ws += isHeavy ? 0.15 : 0;
      ws += isLight ? -0.08 : 0;
      ws += isOpen ? -0.15 : 0;
      ws += isShort ? -0.15 : 0;
      ws += isSleeveless ? -0.10 : 0;
    }

    if (wdSafe.isRainy || forecast?.hasRainRisk) {
      ws += isRainReady ? 0.12 : 0;
      ws += isOpen ? -0.08 : 0;
      ws += isLight ? -0.04 : 0;
    }
    if (wdSafe.isSnowy) {
      ws += isOpen ? -0.15 : 0;
      ws += isShort ? -0.15 : 0;
      ws += isHeavy ? 0.10 : 0;
    }
    if (wdSafe.isWindy) {
      ws += item.category === 'outerwear' ? 0.08 : 0;
      ws += ['chiffon', 'sheer', 'flowy'].some(f => desc.includes(f)) ? -0.06 : 0;
    }
    if (wdSafe.isHumid && weather !== 'cold') {
      ws += isLight ? 0.08 : 0;
      ws += isHeavy ? -0.08 : 0;
    }

    return ws;
  }

  const preferred = [];
  const fallback = [];
  const weatherThreshold = isTinyWardrobe ? -0.30 : (isSmallWardrobe ? -0.20 : -0.12);
  const appThreshold = isTinyWardrobe ? 0.0 : (isSmallWardrobe ? 0.15 : 0.18);

  pool.forEach(item => {
    const style = (item.style || '').toLowerCase();
    const appCheck = checkItemAppropriateness(item, occasion, timeOfDay);
    const wScore = weatherItemScore(item);

    if (!isTinyWardrobe && (profile.avoidStyles.includes(style) || appCheck.score < appThreshold || wScore < weatherThreshold)) {
      fallback.push(item);
  } else {
      preferred.push(item);
    }
  });

  function rankCategoryItems(items) {
    return items
      .map(item => {
        const appCheck = checkItemAppropriateness(item, occasion, timeOfDay);
        const weatherFit = clamp(0.5 + weatherItemScore(item) * 2.2, 0, 1);
        const rotationFit = scoreItemRotation(item);
        const preferenceFit = itemPreferenceFit(item, ctx);
        const exploration = seededNoise(ctx.requestSeed, `category:${id(item)}:${item.category}`) * 0.05;

        return {
          item,
          score: appCheck.score * 0.35 + weatherFit * 0.25 + rotationFit * 0.22 + preferenceFit * 0.18 + exploration,
        };
      })
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item);
  }

  function getCategory(cat) {
    const pref = preferred.filter(i => i.category === cat);
    const fb = fallback.filter(i => i.category === cat);
    // Merge: preferred items first, then fallback — so fallback items still get
    // a chance in large wardrobes instead of being completely excluded
    const merged = [...pref, ...fb];
    if (merged.length > 0) return rankCategoryItems(merged);
    return [];
  }

  // ─── 2. Categorise & shuffle for freshness ───
  const tops = getCategory('top');
  const bottoms = getCategory('bottom');
  const shoes = getCategory('shoes');
  const outerwearAll = getCategory('outerwear');
  const accessories = getCategory('accessory');
  const dresses = getCategory('dress');

  const needsOuterwear = (weather === 'cool' || weather === 'cold' || forecast.needsLayers || wdSafe.isWindy || wdSafe.isRainy || wdSafe.isSnowy) && outerwearAll.length > 0;

  const useDresses = profile.preferDresses && dresses.length > 0;
  const useAccessories = profile.preferAccessories && accessories.length > 0;

  const allCandidates = [];
  const keepAll = isSmallWardrobe;

  // Adaptive combo limits based on wardrobe size
  const totalCoreItems = tops.length + bottoms.length + dresses.length;
  const isLargeWardrobe = wardrobe.length > 40;
  const maxCombos = totalCoreItems <= 5 ? 30 : totalCoreItems <= 15 ? 120 : totalCoreItems <= 40 ? 250 : 600;
  const shoesPerCombo = shoes.length <= 2 ? shoes.length : Math.min(3, shoes.length);

  // ─── 3a. Dress-based outfits ───
  if (useDresses) {
    for (const dress of dresses) {
      if (shoes.length > 0) {
        const rankedShoes = rankPool(dress, shoes, preferences, occasion, keepAll, ctx);
        for (const shoe of rankedShoes.slice(0, shoesPerCombo)) {
          const items = [dress, shoe];
          if (needsOuterwear) {
            const ow = rankPool(dress, outerwearAll, preferences, occasion, keepAll, ctx);
            if (ow.length) items.push(ow[0]);
          }
          if (useAccessories) addBestAccessory(items, dress, accessories, preferences, occasion, ctx);
          allCandidates.push(makeCandidate(items, ctx));
        }
    } else {
        const items = [dress];
        if (needsOuterwear) {
          const ow = rankPool(dress, outerwearAll, preferences, occasion, keepAll, ctx);
          if (ow.length) items.push(ow[0]);
        }
        if (useAccessories) addBestAccessory(items, dress, accessories, preferences, occasion, ctx);
        if (items.length >= 1) allCandidates.push(makeCandidate(items, ctx));
      }
    }
  }

  // ─── 3b. Top + Bottom combinations ───
  let count = 0;

  // For large wardrobes, limit which tops/bottoms we iterate over
  const topLimit = Math.min(tops.length, isTinyWardrobe ? tops.length : (isSmallWardrobe ? 10 : (isLargeWardrobe ? 45 : 25)));
  const bottomLimit = Math.min(bottoms.length, isTinyWardrobe ? bottoms.length : (isSmallWardrobe ? 10 : (isLargeWardrobe ? 45 : 25)));

  for (let ti = 0; ti < topLimit && count < maxCombos; ti++) {
    const top = tops[ti];
    for (let bi = 0; bi < bottomLimit && count < maxCombos; bi++) {
      const bottom = bottoms[bi];

      const rankedShoes = rankPool(top, shoes, preferences, occasion, keepAll, ctx);
      const shoeSlice = rankedShoes.length > 0
        ? rankedShoes.slice(0, Math.min(shoesPerCombo, rankedShoes.length))
        : (shoes.length > 0 ? [shoes[0]] : [null]);

      for (const shoe of shoeSlice) {
        if (count >= maxCombos) break;
        const base = [top, bottom];
        if (shoe) base.push(shoe);

        if (needsOuterwear) {
          const ow = rankPool(top, outerwearAll, preferences, occasion, keepAll, ctx);
          if (ow.length) base.push(ow[count % ow.length]);
        }

        // Base outfit (no accessories)
        allCandidates.push(makeCandidate([...base], ctx));
        count++;

        if (useAccessories) {
          const with1 = [...base];
          addBestAccessory(with1, top, accessories, preferences, occasion, ctx);
          if (with1.length > base.length) {
            allCandidates.push(makeCandidate(with1, ctx));
            count++;
          }

          if (accessories.length >= 3 && count < maxCombos) {
            const with2 = [...base];
            addVariedAccessories(with2, top, accessories, preferences, occasion, 2, ctx);
            if (with2.length > base.length + 1) {
              allCandidates.push(makeCandidate(with2, ctx));
              count++;
            }
          }
        }
      }
    }
  }

  // ─── 3c. Fallback for very sparse wardrobes ───
  if (allCandidates.length === 0) {
    const everything = pool.length > 0 ? pool : wardrobe;
    const hasCoverage = everything.some(i => i.category === 'top' || i.category === 'dress') &&
                        everything.some(i => i.category === 'bottom' || i.category === 'dress');

    if (hasCoverage) {
      const topItems = everything.filter(i => i.category === 'top' || i.category === 'dress');
      const botItems = everything.filter(i => i.category === 'bottom').concat(
        everything.filter(i => i.category === 'dress')
      );
      const shoeItems = everything.filter(i => i.category === 'shoes');

      for (const t of topItems.slice(0, 3)) {
        for (const b of botItems.slice(0, 3)) {
          if (id(t) === id(b)) continue;
          const items = [t, b];
          if (shoeItems.length > 0) items.push(shoeItems[0]);
          allCandidates.push(makeCandidate(items, ctx));
        }
      }
    } else {
      // Absolute last resort: group whatever items exist
      const items = everything.slice(0, Math.min(4, everything.length));
      if (items.length >= 2) allCandidates.push(makeCandidate(items, ctx));
    }
  }

  // ─── 4. Sort by score, then diversity-first selection ───
  const qualityFloor = isTinyWardrobe ? 0.42 : isSmallWardrobe ? 0.5 : isLargeWardrobe ? 0.58 : 0.54;
  let qualityCandidates = allCandidates.filter(c =>
    c.score >= qualityFloor &&
    (c.intel?.score || 0) >= Math.max(qualityFloor - 0.03, 0.4)
  );

  if (qualityCandidates.length < Math.max(limit * 3, 8)) {
    qualityCandidates = [...allCandidates];
  }

  qualityCandidates.sort((a, b) => b.score - a.score);
  return selectDiverse(qualityCandidates, limit, isSmallWardrobe);
}

function addBestAccessory(items, anchor, accessories, preferences, occasion, ctx = null) {
  const ranked = rankPool(anchor, accessories, preferences, occasion, false, ctx);
  if (ranked.length === 0) return;
  const existingTypes = new Set(items.filter(i => i.category === 'accessory').map(getAccessoryType));
  const best = ranked.find(a => !existingTypes.has(getAccessoryType(a)));
  if (best) items.push(best);
}

function addVariedAccessories(items, anchor, accessories, preferences, occasion, count, ctx = null) {
  const ranked = rankPool(anchor, accessories, preferences, occasion, false, ctx);
  if (ranked.length === 0) return;
  const usedTypes = new Set(items.filter(i => i.category === 'accessory').map(getAccessoryType));
  let added = 0;
  for (const acc of ranked) {
    if (added >= count) break;
    const type = getAccessoryType(acc);
    if (usedTypes.has(type)) continue;
    usedTypes.add(type);
    items.push(acc);
    added++;
  }
}

function makeCandidate(items, ctx) {
  // Compute intel once — shared by scoreOutfit and buildReasons to avoid double evaluation
  const intel = evaluateFashionIntelligence(items, ctx.occasion, ctx.weather, ctx.timeOfDay, ctx.weatherDetail);
  const semanticDescriptor = getCandidateSemanticDescriptor(items, ctx);
  const semanticCohesion = semanticOutfitCohesionCached(items, ctx);
  const score = scoreOutfit(items, ctx, intel);
  const reasons = buildReasons(items, ctx, intel);
  return {
    items,
    score,
    reasons,
    intel,
    direction: getOutfitDirection(items),
    semanticCohesion,
    semanticEmbedding: semanticDescriptor.embedding,
    semanticAesthetics: semanticDescriptor.aesthetics,
    semanticVibes: semanticDescriptor.vibes,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIVERSITY-FIRST SELECTION — no two outfits should feel the same
// ═══════════════════════════════════════════════════════════════════════════

function selectDiverse(candidates, limit, isSmallWardrobe = false) {
  if (candidates.length === 0) return [];
  const selected = [];
  const usedTopIds = new Map();   // topId -> count
  const usedBottomIds = new Map(); // bottomId -> count
  const usedDressIds = new Map();
  const usedShoeIds = new Set();
  const usedOuterwearIds = new Set();
  const usedDirectionKeys = new Map();
  const usedStyleGroups = new Map();
  const usedPaletteKeys = new Map();
  const seenSigs = new Set();

  function sig(outfit) {
    return outfit.items.map(id).sort().join('|');
  }

  function getCorePieceId(outfit, category) {
    const item = outfit.items.find(i => i.category === category);
    return item ? id(item) : null;
  }

  function itemOverlapPenalty(outfit) {
    if (selected.length === 0) return 0;
    const currentIds = new Set(outfit.items.map(id));
    let maxOverlap = 0;
    let maxSemanticOverlap = 0;

    for (const picked of selected) {
      const pickedIds = new Set(picked.items.map(id));
      const shared = [...currentIds].filter(value => pickedIds.has(value)).length;
      const base = Math.min(currentIds.size, pickedIds.size) || 1;
      maxOverlap = Math.max(maxOverlap, shared / base);
      const semanticSim = picked.semanticEmbedding && outfit.semanticEmbedding
        ? embeddingSimilarity(outfit.semanticEmbedding, picked.semanticEmbedding)
        : semanticOutfitSimilarity(outfit.items, picked.items);
      maxSemanticOverlap = Math.max(maxSemanticOverlap, semanticSim);
    }

    return maxOverlap * 3.2 + maxSemanticOverlap * 2.2;
  }

  function diversityPenalty(outfit) {
    let pen = 0;
    const topId = getCorePieceId(outfit, 'top');
    const botId = getCorePieceId(outfit, 'bottom');
    const dressId = getCorePieceId(outfit, 'dress');
    const shoeItem = outfit.items.find(i => i.category === 'shoes');
    const outerwearItem = outfit.items.find(i => i.category === 'outerwear');
    const direction = getOutfitDirection(outfit.items);

    // Very heavy penalty for reusing top or bottom — these define an outfit
    if (topId && usedTopIds.has(topId)) pen += 5 * (usedTopIds.get(topId) || 1);
    if (botId && usedBottomIds.has(botId)) pen += 5 * (usedBottomIds.get(botId) || 1);
    if (dressId && usedDressIds.has(dressId)) pen += 6 * (usedDressIds.get(dressId) || 1);

    // Moderate penalty for reusing shoes
    if (shoeItem && usedShoeIds.has(id(shoeItem))) pen += 1.2;

    // Moderate penalty for reusing outerwear — prevents same jacket every outfit
    if (outerwearItem && usedOuterwearIds.has(id(outerwearItem))) pen += 2.0;

    if (usedDirectionKeys.has(direction.key)) pen += 2.8 * (usedDirectionKeys.get(direction.key) || 1);
    if (usedStyleGroups.has(direction.styleGroup)) pen += 0.9 * (usedStyleGroups.get(direction.styleGroup) || 1);
    if (usedPaletteKeys.has(direction.paletteKey)) pen += 0.8 * (usedPaletteKeys.get(direction.paletteKey) || 1);

    pen += itemOverlapPenalty(outfit);

    return pen;
  }

  const isLargePool = candidates.length > 200;
  const diversityWeight = isSmallWardrobe ? 0.20 : (isLargePool ? 0.55 : 0.45);
  const target = Math.min(limit * (isLargePool ? 7 : 5), candidates.length);
  const pool = [...candidates];
  const windowSize = Math.min(pool.length, isSmallWardrobe ? pool.length : (isLargePool ? 350 : 150));

  while (selected.length < target && pool.length > 0) {
    let bestIdx = -1;
    let bestVal = -Infinity;
    const w = Math.min(pool.length, windowSize);

    for (let i = 0; i < w; i++) {
      const c = pool[i];
      const s = sig(c);
      if (seenSigs.has(s)) continue;

      const dp = diversityPenalty(c);
      const val = c.score - dp * diversityWeight;
      if (val > bestVal) { bestVal = val; bestIdx = i; }
    }

    if (bestIdx === -1) { pool.splice(0, w); continue; }

    const pick = pool.splice(bestIdx, 1)[0];
    seenSigs.add(sig(pick));

    const topId = getCorePieceId(pick, 'top');
    const botId = getCorePieceId(pick, 'bottom');
    const dressId = getCorePieceId(pick, 'dress');
    if (topId) usedTopIds.set(topId, (usedTopIds.get(topId) || 0) + 1);
    if (botId) usedBottomIds.set(botId, (usedBottomIds.get(botId) || 0) + 1);
    if (dressId) usedDressIds.set(dressId, (usedDressIds.get(dressId) || 0) + 1);
    const shoe = pick.items.find(i => i.category === 'shoes');
    if (shoe) usedShoeIds.add(id(shoe));
    const ow = pick.items.find(i => i.category === 'outerwear');
    if (ow) usedOuterwearIds.add(id(ow));
    const direction = getOutfitDirection(pick.items);
    usedDirectionKeys.set(direction.key, (usedDirectionKeys.get(direction.key) || 0) + 1);
    usedStyleGroups.set(direction.styleGroup, (usedStyleGroups.get(direction.styleGroup) || 0) + 1);
    usedPaletteKeys.set(direction.paletteKey, (usedPaletteKeys.get(direction.paletteKey) || 0) + 1);

    selected.push(pick);
  }

  return selected;
}

// ═══════════════════════════════════════════════════════════════════════════
// ARCHETYPE CLASSIFIER
// ═══════════════════════════════════════════════════════════════════════════

const ARCHETYPES = [
  { name: 'Power Move',          occasions: ['work', 'formal'],              styleGroups: ['classic'],               palette: ['neutral', 'tonal'],    minFormality: 0.65 },
  { name: 'Evening Poise',       occasions: ['formal', 'date'],              styleGroups: ['classic', 'versatile'],  palette: ['tonal', 'neutral'],    minFormality: 0.72 },
  { name: 'Date Night Edit',     occasions: ['date', 'party'],               styleGroups: ['relaxed', 'statement'],  palette: null,                    minFormality: 0.45 },
  { name: 'Street Edit',         occasions: ['casual', 'party'],             styleGroups: ['statement'],             palette: null,                    minFormality: 0.0  },
  { name: 'Weekend Ease',        occasions: ['casual'],                      styleGroups: ['relaxed', 'versatile'],  palette: null,                    minFormality: 0.0  },
  { name: 'Active Flow',         occasions: ['gym', 'casual'],               styleGroups: ['athletic'],              palette: null,                    minFormality: 0.0  },
  { name: 'Quiet Luxury',        occasions: ['work', 'casual', 'formal'],    styleGroups: ['classic', 'versatile'],  palette: ['neutral', 'tonal'],    minFormality: 0.55, trendMatch: 'quiet luxury' },
  { name: 'Coastal Ease',        occasions: ['casual', 'date'],              styleGroups: ['relaxed'],               palette: null,                    minFormality: 0.0,  trendMatch: 'coastal' },
  { name: 'Boho Spirit',         occasions: ['casual', 'date'],              styleGroups: ['relaxed'],               palette: ['mixed', 'pop'],        minFormality: 0.0,  trendMatch: 'boho revival' },
  { name: 'Summer Breezy',       occasions: ['casual', 'date', 'party'],     styleGroups: ['relaxed', 'versatile'],  palette: null,                    minFormality: 0.0,  weather: ['hot', 'warm'] },
  { name: 'Cold-Weather Layer',  occasions: null,                            styleGroups: null,                      palette: null,                    minFormality: 0.0,  weather: ['cold', 'cool'] },
  { name: 'Minimal Core',        occasions: ['casual', 'work'],              styleGroups: ['classic', 'versatile'],  palette: ['neutral', 'tonal'],    minFormality: 0.3  },
  { name: 'Statement Pop',       occasions: ['party', 'date', 'casual'],     styleGroups: ['statement', 'relaxed'],  palette: ['pop', 'mixed'],        minFormality: 0.0  },
];

function classifyArchetype(items, ctx) {
  const { occasion, weather, styleDNA } = ctx;
  const direction   = getOutfitDirection(items);
  const styleGroup  = direction.styleGroup;
  const paletteKey  = direction.paletteKey || '';
  const avgFormality = items.reduce((sum, i) => {
    const f = getSemanticProfileCached(i, ctx).axes?.formality ?? 0.5;
    return sum + f;
  }, 0) / (items.length || 1);
  const hasOuterwear = items.some(i => i.category === 'outerwear');

  // Weather-specific override
  if ((weather === 'cold' || weather === 'cool') && hasOuterwear) {
    const match = ARCHETYPES.find(a => a.name === 'Cold-Weather Layer');
    if (match) return match.name;
  }

  let bestName  = 'Styled Look';
  let bestScore = -1;

  for (const archetype of ARCHETYPES) {
    let score = 0;
    if (archetype.occasions && archetype.occasions.includes(occasion)) score += 3;
    if (archetype.styleGroups && archetype.styleGroups.includes(styleGroup)) score += 2;
    if (archetype.palette && archetype.palette.some(p => paletteKey.startsWith(p))) score += 1;
    if (avgFormality >= archetype.minFormality) score += 1;
    if (archetype.weather && archetype.weather.includes(weather)) score += 2;
    if (archetype.trendMatch && styleDNA?.primaryStyle) {
      const trend = TREND_SIGNALS.find(t => t.name === archetype.trendMatch);
      if (trend && trend.styles.includes(getStyleGroup(styleDNA.primaryStyle))) score += 2;
    }
    if (score > bestScore) { bestScore = score; bestName = archetype.name; }
  }
  return bestName;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPLETE THE LOOK — surfaces one actionable missing-piece hint
// ═══════════════════════════════════════════════════════════════════════════

function completeTheLook(items, ctx) {
  const { wardrobe, occasion, weather } = ctx;
  const cats = new Set(items.map(i => i.category));

  // Only suggest if wardrobe actually has the missing category
  const wardrobeCats = new Set(wardrobe.map(i => i.category));

  // Priority order of what completes an outfit
  if (!cats.has('shoes') && !cats.has('dress') && wardrobeCats.has('shoes')) {
    // Find the best shoe from wardrobe not already in outfit
    const shoePool = wardrobe.filter(i => i.category === 'shoes');
    const anchor = items.find(i => i.category === 'top' || i.category === 'dress') || items[0];
    if (anchor && shoePool.length) {
      const best = rankPool(anchor, shoePool, ctx.preferences, occasion, false, ctx)[0];
      if (best) return { category: 'shoes', name: best.name, id: id(best), hint: `Add your ${best.name} to finish the look` };
    }
  }
  if (!cats.has('outerwear') && wardrobeCats.has('outerwear') && (weather === 'cool' || weather === 'cold' || ctx.forecast?.hasRainRisk)) {
    const owPool = wardrobe.filter(i => i.category === 'outerwear');
    const anchor = items[0];
    if (anchor && owPool.length) {
      const best = rankPool(anchor, owPool, ctx.preferences, occasion, false, ctx)[0];
      if (best) return { category: 'outerwear', name: best.name, id: id(best), hint: `Layer your ${best.name} for the weather` };
    }
  }
  if (!cats.has('accessory') && wardrobeCats.has('accessory') && occasion !== 'gym') {
    const accPool = wardrobe.filter(i => i.category === 'accessory');
    const anchor = items.find(i => i.category === 'top' || i.category === 'dress') || items[0];
    if (anchor && accPool.length) {
      const best = rankPool(anchor, accPool, ctx.preferences, occasion, false, ctx)[0];
      if (best) return { category: 'accessory', name: best.name, id: id(best), hint: `Your ${best.name} would elevate this` };
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// HYBRID: Algorithm + OpenAI
// ═══════════════════════════════════════════════════════════════════════════

async function generateHybridRecommendations(ctx) {
  const feedbackCount = ctx.recentFeedback?.length || 0;
  const cached = recCacheGet(ctx.requestSeed, feedbackCount);
  if (cached) return cached;

  const candidates = buildDiverseOutfits(ctx);

  if (candidates.length === 0) {
    // Last resort: return a message indicating limited options
    const { wardrobe, occasion, timeOfDay, weather } = ctx;
    const catCounts = {};
    wardrobe.forEach(i => { catCounts[i.category] = (catCounts[i.category] || 0) + 1; });
    const missing = [];
    if (!catCounts.top && !catCounts.dress) missing.push('tops');
    if (!catCounts.bottom && !catCounts.dress) missing.push('bottoms');
    if (!catCounts.shoes) missing.push('shoes');

    if (missing.length > 0) {
      return [{
        id: makeRecommendationId('tip', ctx.requestSeed, `missing:${missing.join('|')}`),
        items: [],
        score: 0,
        confidence: 0,
        reasons: [`Add some ${missing.join(' and ')} to unlock outfit recommendations!`],
        title: 'Almost There!',
        description: `Your wardrobe needs ${missing.join(' and ')} to create complete outfits.`,
        occasion, timeOfDay, weather,
      }];
    }
    return [];
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const results = await enhanceWithAI(candidates, ctx);
      recCacheSet(ctx.requestSeed, results, feedbackCount);
      return results;
    } catch (err) {
      console.log('AI enhancement failed, using algorithm:', err.message);
    }
  }

  const results = formatResults(candidates, ctx);
  recCacheSet(ctx.requestSeed, results, feedbackCount);
  return results;
}

function formatResults(candidates, ctx) {
  const { occasion, timeOfDay, weather, limit } = ctx;

  // Final diversity gate: no two results share the same top, bottom, or dress
  // Shoes are soft-gated: strict only when user has enough unique shoes
  const usedTops = new Set();
  const usedBottoms = new Set();
  const usedDresses = new Set();
  const usedShoes = new Set();
  const usedDirections = new Set();
  const usedSemanticEmbeddings = [];
  const uniqueShoeCount = new Set(candidates.map(r => { const s = r.items.find(i => i.category === 'shoes'); return s ? id(s) : null; }).filter(Boolean)).size;
  const strictShoes = uniqueShoeCount >= limit;
  const diverse = [];
  for (const rec of candidates) {
    const topItem = rec.items.find(i => i.category === 'top');
    const botItem = rec.items.find(i => i.category === 'bottom');
    const dressItem = rec.items.find(i => i.category === 'dress');
    const shoeItem = rec.items.find(i => i.category === 'shoes');
    const topId = topItem ? id(topItem) : null;
    const botId = botItem ? id(botItem) : null;
    const dressId = dressItem ? id(dressItem) : null;
    const shoeId = shoeItem ? id(shoeItem) : null;
    const directionKey = getOutfitDirection(rec.items).key;

    const topReused = topId && usedTops.has(topId);
    const botReused = botId && usedBottoms.has(botId);
    const dressReused = dressId && usedDresses.has(dressId);
    const shoeReused = strictShoes && shoeId && usedShoes.has(shoeId);
    const directionReused = usedDirections.has(directionKey);
    const semanticReused = usedSemanticEmbeddings.some(embedding => embeddingSimilarity(embedding, rec.semanticEmbedding) > 0.96);

    if (topReused || botReused || dressReused || shoeReused || directionReused || semanticReused) continue;

    if (topId) usedTops.add(topId);
    if (botId) usedBottoms.add(botId);
    if (dressId) usedDresses.add(dressId);
    if (shoeId) usedShoes.add(shoeId);
    usedDirections.add(directionKey);
    usedSemanticEmbeddings.push(rec.semanticEmbedding);
    diverse.push(rec);
    if (diverse.length >= limit) break;
  }

  // If strict mode couldn't fill, relax to allow shoe reuse
  if (diverse.length < limit) {
    for (const rec of candidates) {
      if (diverse.length >= limit) break;
      if (diverse.includes(rec)) continue;
      const topItem = rec.items.find(i => i.category === 'top');
      const botItem = rec.items.find(i => i.category === 'bottom');
      const topId = topItem ? id(topItem) : null;
      const botId = botItem ? id(botItem) : null;
      const directionKey = getOutfitDirection(rec.items).key;
      if ((topId && usedTops.has(topId)) || (botId && usedBottoms.has(botId))) continue;
      if (!ctx.wardrobeProfile?.isTiny && usedDirections.has(directionKey)) continue;
      if (usedSemanticEmbeddings.some(embedding => embeddingSimilarity(embedding, rec.semanticEmbedding) > 0.975)) continue;
      if (topId) usedTops.add(topId);
      if (botId) usedBottoms.add(botId);
      usedDirections.add(directionKey);
      usedSemanticEmbeddings.push(rec.semanticEmbedding);
      diverse.push(rec);
    }
  }

  // Absolute fallback for very small wardrobes
  if (diverse.length < limit) {
    for (const rec of candidates) {
      if (diverse.length >= limit) break;
      if (!diverse.includes(rec)) diverse.push(rec);
    }
  }

  return diverse.slice(0, limit).map((rec, idx) => {
    const deduped = deduplicateAccessories(rec.items);
    const presentation = buildPresentationCopy(deduped, ctx);
    const archetype = classifyArchetype(deduped, ctx);
    const completeHint = completeTheLook(deduped, ctx);
    return {
      id: makeRecommendationId('rec', ctx.requestSeed, `${idx}:${deduped.map(id).sort().join('|')}`),
      items: deduped.map(item => ({
        id: id(item), name: item.name, category: item.category,
        color: item.color, imageUrl: item.thumbnailUrl || item.mediumUrl || item.imageUrl,
        style: item.style, pattern: item.pattern,
      })),
      score: normalizeRecommendationScore(rec.score),
      confidence: computeRecommendationConfidence(rec, ctx),
      reasons: rec.reasons,
      title: presentation.title,
      description: presentation.description,
      archetype,
      ...(completeHint ? { completeTheLook: completeHint } : {}),
      occasion, timeOfDay, weather,
    };
  });
}

function deduplicateAccessories(items) {
  const result = [];
  const accTypes = new Set();
  for (const item of items) {
    if (item.category === 'accessory') {
      const t = getAccessoryType(item);
      if (accTypes.has(t)) continue;
      accTypes.add(t);
    }
    result.push(item);
  }
  return result;
}

function responseItemId(item) {
  return (item?.id || item?._id || '').toString();
}

function responseSignature(result) {
  const itemSignature = (result?.items || [])
    .map(responseItemId)
    .filter(Boolean)
    .sort()
    .join('|');

  if (itemSignature) return itemSignature;
  return `${result?.id || 'result'}:${result?.title || ''}:${result?.description || ''}`;
}

function appendFallbackResponses(primaryResults, fallbackResults, limit) {
  const merged = [];
  const seen = new Set();

  for (const result of [...(primaryResults || []), ...(fallbackResults || [])]) {
    if (!result) continue;
    const signature = responseSignature(result);
    if (seen.has(signature)) continue;
    seen.add(signature);
    merged.push(result);
    if (merged.length >= limit) break;
  }

  return merged;
}

// ═══════════════════════════════════════════════════════════════════════════
// AI ENHANCEMENT — adds personality, confidence, and final curation
// ═══════════════════════════════════════════════════════════════════════════

async function enhanceWithAI(candidates, ctx) {
  const { wardrobe, styleDNA, preferences, occasion, timeOfDay, weather, limit, forecast, weatherDetail: wd } = ctx;

  // Build user profile summary
  const colorDist = {}, styleDist = {};
  wardrobe.forEach(item => {
    if (item.color) colorDist[item.color.toLowerCase()] = (colorDist[item.color.toLowerCase()] || 0) + 1;
    if (item.style) styleDist[item.style.toLowerCase()] = (styleDist[item.style.toLowerCase()] || 0) + 1;
  });
  const topColors = Object.entries(colorDist).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c);
  const topStyles = Object.entries(styleDist).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => s);

  let userProfile = '';
  if (preferences?.preferredColors?.length) userProfile += `Loves: ${preferences.preferredColors.join(', ')}. `;
  if (preferences?.preferredStyles?.length) userProfile += `Style: ${preferences.preferredStyles.join(', ')}. `;
  if (preferences?.avoidedColors?.length) userProfile += `Avoids colors: ${preferences.avoidedColors.join(', ')}. `;
  if (preferences?.avoidedStyles?.length) userProfile += `Avoids styles: ${preferences.avoidedStyles.join(', ')}. `;
  const bodyType = preferences?.bodyType || styleDNA?.bodyType;
  if (bodyType) userProfile += `Body type: ${bodyType} — factor fit and proportion into your picks. `;
  if (preferences?.ageRange) userProfile += `Age: ${preferences.ageRange}. `;
  userProfile += `Wardrobe trends: ${topColors.join(', ')} colors, ${topStyles.join(', ')} styles.`;
  if (styleDNA?.primaryStyle) userProfile += ` Style DNA: ${styleDNA.primaryStyle}.`;

  // Per-occasion learned preferences
  const occasionPrefsMap = preferences?.occasionPreferences instanceof Map
    ? Object.fromEntries(preferences.occasionPreferences)
    : (preferences?.occasionPreferences || {});
  const occPref = occasionPrefsMap[occasion];
  if (occPref?.preferredColors?.length || occPref?.preferredStyles?.length) {
    userProfile += ` For ${occasion}: prefers ${(occPref.preferredColors || []).join(', ')} colors, ${(occPref.preferredStyles || []).join(', ')} styles.`;
  }

  if (preferences?.feedbackCount > 0) {
    userProfile += ` (${preferences.feedbackCount} past interactions — trust learned patterns).`;
  }

  const season = getCurrentSeason();
  const occasionProfile = OCCASION_PROFILES[occasion] || OCCASION_PROFILES.casual;
  const timeProfile = TIME_PROFILES[timeOfDay] || TIME_PROFILES.afternoon;

  // Hard-filter: ensure AI sees outfits where each top, bottom, and dress is unique
  // Shoes are only hard-blocked when the user has enough unique shoes
  const diverseForAI = [];
  const usedTopIds = new Set();
  const usedBottomIds = new Set();
  const usedDressIds = new Set();
  const usedShoeIds = new Set();
  const usedDirectionKeysAI = new Set();
  const aiCap = wardrobe.length > 40 ? 24 : 18;
  const uniqueShoesInCandidates = new Set(candidates.map(c => { const s = c.items.find(i => i.category === 'shoes'); return s ? id(s) : null; }).filter(Boolean)).size;
  const strictShoesAI = uniqueShoesInCandidates >= aiCap;
  for (const c of candidates) {
    const topItem = c.items.find(i => i.category === 'top');
    const botItem = c.items.find(i => i.category === 'bottom');
    const dressItem = c.items.find(i => i.category === 'dress');
    const shoeItem = c.items.find(i => i.category === 'shoes');
    const topId = topItem ? id(topItem) : null;
    const botId = botItem ? id(botItem) : null;
    const dressId = dressItem ? id(dressItem) : null;
    const shoeId = shoeItem ? id(shoeItem) : null;

    const topReused = topId && usedTopIds.has(topId);
    const botReused = botId && usedBottomIds.has(botId);
    const dressReused = dressId && usedDressIds.has(dressId);
    const shoeReused = strictShoesAI && shoeId && usedShoeIds.has(shoeId);
    const directionKey = getOutfitDirection(c.items).key;
    const directionReused = !ctx.wardrobeProfile?.isTiny && usedDirectionKeysAI.has(directionKey);

    if (topReused || botReused || dressReused || shoeReused || directionReused) continue;

    if (topId) usedTopIds.add(topId);
    if (botId) usedBottomIds.add(botId);
    if (dressId) usedDressIds.add(dressId);
    if (shoeId) usedShoeIds.add(shoeId);
    usedDirectionKeysAI.add(directionKey);
    diverseForAI.push(c);
    if (diverseForAI.length >= aiCap) break;
  }
  // If strict uniqueness produced too few, relax to allow shoe reuse only
  if (diverseForAI.length < limit) {
    const usedT2 = new Set(diverseForAI.map(c => { const t = c.items.find(i => i.category === 'top'); return t ? id(t) : null; }).filter(Boolean));
    const usedB2 = new Set(diverseForAI.map(c => { const b = c.items.find(i => i.category === 'bottom'); return b ? id(b) : null; }).filter(Boolean));
    for (const c of candidates) {
      if (diverseForAI.length >= aiCap) break;
      if (diverseForAI.includes(c)) continue;
      const topItem = c.items.find(i => i.category === 'top');
      const botItem = c.items.find(i => i.category === 'bottom');
      const topId = topItem ? id(topItem) : null;
      const botId = botItem ? id(botItem) : null;
      if ((topId && usedT2.has(topId)) || (botId && usedB2.has(botId))) continue;
      if (topId) usedT2.add(topId);
      if (botId) usedB2.add(botId);
      diverseForAI.push(c);
    }
  }
  // Absolute fallback: just fill from candidates
  if (diverseForAI.length < limit) {
    for (const c of candidates) {
      if (diverseForAI.length >= aiCap) break;
      if (!diverseForAI.includes(c)) diverseForAI.push(c);
    }
  }

  const detailed = diverseForAI.map((c, idx) => {
    const presentation = buildPresentationCopy(c.items, ctx);
    return {
      idx,
      direction: presentation.direction.key,
      palette: presentation.direction.paletteLabel,
      structure: presentation.direction.structure,
      styleGroup: presentation.direction.styleGroup,
      rotation: Math.round(outfitRotationScore(c.items) * 100),
      semanticCohesion: Math.round((c.semanticCohesion || 0.7) * 100),
      semanticEmbedding: c.semanticEmbedding,
      semanticAesthetics: c.semanticAesthetics,
      semanticVibes: c.semanticVibes,
      titleHint: presentation.title,
      items: c.items.map(item => ({
        ...summarizeSemanticProfile(item),
        id: id(item), name: item.name || 'Item',
        category: item.category, color: item.color || 'unknown',
        style: item.style || 'casual',
      })),
      score: Math.round(c.score * 100),
      reasons: c.reasons.slice(0, 2),
    };
  });

  const wdSafe = wd || {};
  let weatherLine = `SEASON: ${season} | WEATHER: ${weather}`;
  if (wdSafe.temperature != null) weatherLine += ` (${wdSafe.temperature}°C)`;
  if (wdSafe.condition) weatherLine += ` — condition: ${wdSafe.condition}`;
  if (wdSafe.humidity != null) weatherLine += `, humidity: ${wdSafe.humidity}%`;
  if (wdSafe.windSpeed != null) weatherLine += `, wind: ${wdSafe.windSpeed} m/s`;

  const weatherAlerts = [];
  if (forecast.hasRainRisk || wdSafe.isRainy) weatherAlerts.push('RAIN expected — prioritize outfits with rain-appropriate outerwear and closed shoes');
  if (wdSafe.isSnowy) weatherAlerts.push('SNOW — must have warm outerwear and closed/waterproof footwear');
  if (wdSafe.isWindy) weatherAlerts.push('WINDY — favor structured layers, avoid flowy/sheer pieces');
  if (wdSafe.isHumid && weather !== 'cold') weatherAlerts.push('HIGH HUMIDITY — favor breathable, lightweight fabrics (linen, cotton)');
  if (forecast.needsLayers) weatherAlerts.push('TEMPERATURE SWING — recommend layerable outfits');
  if (weather === 'cold') weatherAlerts.push('COLD — ensure warm layers, heavy fabrics, closed shoes; avoid exposed skin');
  if (weather === 'hot') weatherAlerts.push('HOT — light fabrics, breathable materials; avoid heavy layers');
  const weatherAlertBlock = weatherAlerts.length > 0 ? `\nWEATHER RULES (must follow):\n${weatherAlerts.map(a => `- ${a}`).join('\n')}\n` : '';

  // Wardrobe composition summary for AI context
  const catCounts = {};
  wardrobe.forEach(item => {
    const c = item.category || 'other';
    catCounts[c] = (catCounts[c] || 0) + 1;
  });
  const wardrobeSummary = Object.entries(catCounts).map(([c, n]) => `${n} ${c}${n > 1 ? 's' : ''}`).join(', ');
  const wardrobeSize = wardrobe.length <= 8 ? 'very small' : wardrobe.length <= 15 ? 'small' : wardrobe.length <= 40 ? 'medium' : 'large';

  const prompt = `You are Fashion Fit's AI styling engine. Pick the BEST ${limit} outfits from ${detailed.length} algorithm-scored candidates.

USER: ${userProfile}
WARDROBE: ${wardrobe.length} items (${wardrobeSize}) — ${wardrobeSummary}

OCCASION: ${occasion} — vibe should feel "${occasionProfile.vibe}"
TIME: ${timeOfDay} — energy is "${timeProfile.vibe}"
${weatherLine}
${weatherAlertBlock}
CANDIDATES:
${JSON.stringify(detailed, null, 1)}

IMPORTANT SEMANTIC SIGNAL:
- Every item and outfit includes a semanticEmbedding vector in this exact order:
  [formality, structure, texture, boldness, softness, warmth, polish, ruggedness, minimalism, versatility]
- Use these embeddings as a visual vibe fingerprint, not just text labels.
- Two items can share category and color but still be far apart in embedding space. Example: a polished navy silk shirt and a distressed sky-blue denim shirt should be treated as very different energies.

RULES:
1. Pick ${limit} outfits that each feel DISTINCTLY DIFFERENT — EVERY outfit MUST have a different top AND a different bottom (or dress). NEVER repeat the same top across outfits. NEVER repeat the same bottom across outfits. Different color stories, different moods.${wardrobe.length <= 15 ? ' This is a smaller wardrobe so shoe/accessory reuse is fine — but tops and bottoms MUST be different.' : ''}
2. Every outfit must genuinely suit "${occasion}" at "${timeOfDay}" AND the current weather. If it's cold, prefer warm layers. If it's raining, prefer rain-appropriate outerwear. If it's hot, the outfit should feel light and breathable.
3. Work with what the user OWNS. ${wardrobeSize === 'very small' || wardrobeSize === 'small' ? 'This user has a limited wardrobe — be creative with what they have. Show them how to style a few pieces differently rather than expecting variety they don\'t have. Every outfit you pick should still feel considered and intentional.' : 'With this many pieces available, select outfits that showcase the FULL breadth of their wardrobe — pull from different items, not just the same favorites. Avoid underutilizing any category. Every item deserves to be styled.'}
4. Give each a catchy 3-4 word title and a one-liner (max 15 words) that speaks directly to the user. The description should acknowledge the weather when relevant (e.g. "Keeping you dry and sharp through the rain" or "Light and breezy for this sunny afternoon").${wardrobeSize === 'very small' || wardrobeSize === 'small' ? ' For smaller wardrobes, emphasize how versatile their pieces are.' : ''}
5. Provide 2-3 enhanced reasons — personal, confident, no generic filler. At least one reason should reference weather-appropriateness if conditions are notable (rain, cold, hot, windy, humid).

OUTPUT (JSON only, no markdown):
{
  "outfits": [
    {
      "candidateIdx": 0,
      "aiConfidence": 93,
      "title": "Power Move Casual",
      "description": "This laid-back look says you've got it together without trying",
      "enhancedReasons": ["Earth tones that complement your style DNA", "Effortlessly cool for a ${timeOfDay} ${occasion} moment"]
    }
  ]
}

Output ONLY valid JSON.`;

  // Use gpt-4o for high-stakes occasions where styling quality matters most
  const aiModel = (occasion === 'formal' || occasion === 'date') ? 'gpt-4o' : 'gpt-4o-mini';

  const systemPrompt = `You are a personal AI stylist who knows this specific user deeply — their body type, style DNA, what they've liked and rejected before, and exactly what's in their wardrobe. Your job is not to describe fashion theory but to make real, specific styling decisions for this real person right now. You think about fit, proportion, and how pieces actually look together on a body — not just colour matching. Output ONLY valid JSON.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: aiModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.82,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('OpenAI API error:', text);
    throw new Error('OpenAI API request failed');
  }

  const json = await response.json();
  const raw = json.choices?.[0]?.message?.content || '{}';

  let parsed;
  try {
    let clean = raw.trim();
    if (clean.startsWith('```')) clean = clean.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    parsed = JSON.parse(clean);
  } catch {
    console.error('Failed to parse AI response:', raw);
    throw new Error('Failed to parse AI response');
  }

  // Track API cost
  const pt = json.usage?.prompt_tokens || 0;
  const ct = json.usage?.completion_tokens || 0;
  const modelCosts = { 'gpt-4o': { prompt: 2.50, completion: 10.00 }, 'gpt-4o-mini': { prompt: 0.15, completion: 0.60 } };
  const mc = modelCosts[aiModel] || modelCosts['gpt-4o-mini'];
  await ApiUsage.create({
    date: new Date(), service: 'openai', operation: 'enhance-outfits',
    tokens: { prompt: pt, completion: ct },
    cost: (pt / 1e6 * mc.prompt) + (ct / 1e6 * mc.completion),
    model: aiModel,
  }).catch(() => {});

  // Map AI picks back to algorithm candidates (using diverseForAI, not candidates)
  const aiSelections = sanitizeAISelections(parsed, diverseForAI.length, limit);

  const rawEnhanced = aiSelections.map(ai => {
    const orig = diverseForAI[ai.candidateIdx];
    if (!orig) return null;

    const algoScore = (orig.score || 0.7) * 100;
    const aiConf = ai.aiConfidence || 85;
    const final = algoScore * 0.55 + aiConf * 0.45;
    const deduped = deduplicateAccessories(orig.items);
    const presentation = buildPresentationCopy(deduped, ctx);
    const archetype = classifyArchetype(deduped, ctx);
    const completeHint = completeTheLook(deduped, ctx);

    return {
      id: makeRecommendationId('hybrid', ctx.requestSeed, `${ai.candidateIdx}:${deduped.map(id).sort().join('|')}`),
      items: deduped.map(item => ({
        id: id(item), name: item.name, category: item.category,
        color: item.color, imageUrl: item.thumbnailUrl || item.mediumUrl || item.imageUrl,
        style: item.style, pattern: item.pattern,
      })),
      score: normalizeRecommendationScore(final),
      confidence: computeRecommendationConfidence(orig, ctx),
      reasons: ai.enhancedReasons?.length ? ai.enhancedReasons : [ai.description || presentation.description || 'Styled to perfection'],
      title: ai.title || presentation.title,
      description: ai.description || presentation.description,
      archetype,
      ...(completeHint ? { completeTheLook: completeHint } : {}),
      occasion, timeOfDay, weather,
      algorithmScore: Math.round(algoScore),
      aiConfidence: Math.round(aiConf),
      _origIdx: ai.candidateIdx,
      _directionKey: presentation.direction.key,
      _semanticEmbedding: orig.semanticEmbedding,
    };
  }).filter(Boolean);

  // POST-AI DIVERSITY ENFORCEMENT: reject any AI pick that reuses a top, bottom, or dress
  // Shoes only hard-blocked when enough unique shoes exist
  const enhanced = [];
  const finalUsedTops = new Set();
  const finalUsedBottoms = new Set();
  const finalUsedDresses = new Set();
  const finalUsedShoes = new Set();
  const finalUsedDirections = new Set();
  const finalUsedSemanticEmbeddings = [];
  const finalUniqueShoes = new Set(rawEnhanced.map(o => o.items.find(i => i.category === 'shoes')?.id).filter(Boolean)).size;
  const strictShoesFinal = finalUniqueShoes >= limit;

  for (const outfit of rawEnhanced) {
    const topId = outfit.items.find(i => i.category === 'top')?.id;
    const botId = outfit.items.find(i => i.category === 'bottom')?.id;
    const dressId = outfit.items.find(i => i.category === 'dress')?.id;
    const shoeId = outfit.items.find(i => i.category === 'shoes')?.id;
    const directionDup = finalUsedDirections.has(outfit._directionKey);
    const semanticDup = finalUsedSemanticEmbeddings.some(embedding => embeddingSimilarity(embedding, outfit._semanticEmbedding) > 0.96);

    const topDup = topId && finalUsedTops.has(topId);
    const botDup = botId && finalUsedBottoms.has(botId);
    const dressDup = dressId && finalUsedDresses.has(dressId);
    const shoeDup = strictShoesFinal && shoeId && finalUsedShoes.has(shoeId);

    if (topDup || botDup || dressDup || shoeDup || directionDup || semanticDup) continue;

    if (topId) finalUsedTops.add(topId);
    if (botId) finalUsedBottoms.add(botId);
    if (dressId) finalUsedDresses.add(dressId);
    if (shoeId) finalUsedShoes.add(shoeId);
    if (outfit._directionKey) finalUsedDirections.add(outfit._directionKey);
    if (outfit._semanticEmbedding) finalUsedSemanticEmbeddings.push(outfit._semanticEmbedding);
    enhanced.push(outfit);
  }

  // Fill remaining slots from diverseForAI candidates the AI didn't pick
  if (enhanced.length < limit) {
    const usedIdxs = new Set(enhanced.map(o => o._origIdx));
    for (const [idx, cand] of diverseForAI.entries()) {
      if (enhanced.length >= limit) break;
      if (usedIdxs.has(idx)) continue;

      const topItem = cand.items.find(i => i.category === 'top');
      const botItem = cand.items.find(i => i.category === 'bottom');
      const dressItem = cand.items.find(i => i.category === 'dress');
      const shoeItem = cand.items.find(i => i.category === 'shoes');
      const tId = topItem ? id(topItem) : null;
      const bId = botItem ? id(botItem) : null;
      const dId = dressItem ? id(dressItem) : null;
      const sId = shoeItem ? id(shoeItem) : null;
      const presentation = buildPresentationCopy(cand.items, ctx);

      if ((tId && finalUsedTops.has(tId)) || (bId && finalUsedBottoms.has(bId)) ||
          (dId && finalUsedDresses.has(dId)) || (strictShoesFinal && sId && finalUsedShoes.has(sId)) ||
          finalUsedDirections.has(presentation.direction.key) ||
          finalUsedSemanticEmbeddings.some(embedding => embeddingSimilarity(embedding, cand.semanticEmbedding) > 0.97)) continue;

      if (tId) finalUsedTops.add(tId);
      if (bId) finalUsedBottoms.add(bId);
      if (dId) finalUsedDresses.add(dId);
      if (sId) finalUsedShoes.add(sId);
      finalUsedDirections.add(presentation.direction.key);
      if (cand.semanticEmbedding) finalUsedSemanticEmbeddings.push(cand.semanticEmbedding);

      const deduped = deduplicateAccessories(cand.items);
      const fillArchetype = classifyArchetype(deduped, ctx);
      const fillHint = completeTheLook(deduped, ctx);
      enhanced.push({
        id: makeRecommendationId('fill', ctx.requestSeed, `${idx}:${deduped.map(id).sort().join('|')}`),
        items: deduped.map(item => ({
          id: id(item), name: item.name, category: item.category,
          color: item.color, imageUrl: item.thumbnailUrl || item.mediumUrl || item.imageUrl,
          style: item.style, pattern: item.pattern,
        })),
        score: normalizeRecommendationScore(cand.score),
        confidence: computeRecommendationConfidence(cand, ctx, 'fill'),
        reasons: cand.reasons,
        title: presentation.title,
        description: presentation.description,
        archetype: fillArchetype,
        ...(fillHint ? { completeTheLook: fillHint } : {}),
        occasion, timeOfDay, weather,
        _semanticEmbedding: cand.semanticEmbedding,
      });
    }
  }

  // Absolute fallback: if we still have nothing, format whatever candidates exist
  if (enhanced.length === 0) {
    return formatResults(candidates, ctx);
  }

  const mergedWithFallback = enhanced.length < limit
    ? appendFallbackResponses(enhanced, formatResults(candidates, ctx), limit)
    : enhanced;

  // Clean up internal field
  mergedWithFallback.forEach(o => {
    delete o._origIdx;
    delete o._directionKey;
    delete o._semanticEmbedding;
  });
  return mergedWithFallback.slice(0, limit);
}

router.__testables = {
  buildRequestSeed,
  getWardrobeProfile,
  getSemanticProfileCached,
  pairCompat,
  makeCandidate,
  selectDiverse,
  formatResults,
  appendFallbackResponses,
  normalizeOccasion,
  normalizeTimeOfDay,
  normalizeWeatherBand,
};

module.exports = router;
