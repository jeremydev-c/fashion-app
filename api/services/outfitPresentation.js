/**
 * outfitPresentation.js — Formatting, reasons, titles, archetype classification,
 * complete-the-look hints, confidence scoring, and final diversity gating.
 */

const { evaluateFashionIntelligence } = require('../utils/fashionIntelligence');
const {
  clamp,
  id,
  makeRecommendationId,
  normalizeRecommendationScore,
  getAccessoryType,
  getWardrobeProfile,
  getStyleGroup,
  getOutfitDirection,
  getSemanticProfileCached,
  semanticOutfitCohesionCached,
  outfitRotationScore,
  embeddingSimilarity,
  TREND_SIGNALS,
} = require('./recommendationHelpers');
const { feedbackPatternScore } = require('./feedbackPatterns');
const { userColorTempScore } = require('./colorTemperature');
const { rankPool } = require('./outfitScoring');

// ═══════════════════════════════════════════════════════════════════════════
// REASONS
// ═══════════════════════════════════════════════════════════════════════════

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

  // New intel-based reasons
  if (intel.details?.proportionalBalance?.score >= 0.85) reasons.push(intel.details.proportionalBalance.reason);
  if (intel.details?.semanticTexture?.score >= 0.75) reasons.push(intel.details.semanticTexture.reason);
  if (intel.details?.capsuleBalance?.score >= 0.9) reasons.push(intel.details.capsuleBalance.reason);
  if (intel.details?.colorTemperature?.score >= 0.85) reasons.push(intel.details.colorTemperature.reason);

  if (ctx.feedbackPatterns && feedbackPatternScore(items, ctx.feedbackPatterns) >= 0.04) {
    reasons.push('Combines pieces you\'ve consistently loved together');
  }

  if (ctx.userColorTemp?.tendency !== 'neutral') {
    const tempScore = userColorTempScore(items, ctx.userColorTemp);
    if (tempScore >= 0.05) reasons.push(`Plays to your ${ctx.userColorTemp.tendency}-toned palette`);
  }

  // Visual analysis reasons
  const surfaces = items.map(i => i.fabricSurface).filter(Boolean);
  const uniqueSurfaces = new Set(surfaces);
  if (uniqueSurfaces.size >= 2) {
    const nice = [['matte', 'satin'], ['matte', 'glossy'], ['brushed', 'satin'], ['nubby', 'smooth']];
    const surfaceList = [...uniqueSurfaces];
    const hasNiceContrast = nice.some(([a, b]) => surfaceList.includes(a) && surfaceList.includes(b));
    if (hasNiceContrast) reasons.push('Beautiful texture contrast between fabrics');
  }

  const visualWeights = items.map(i => i.visualWeight).filter(w => typeof w === 'number');
  if (visualWeights.length >= 2) {
    const avgVW = visualWeights.reduce((a, b) => a + b, 0) / visualWeights.length;
    if (weather === 'cold' && avgVW >= 0.55) reasons.push('Visually warm and layered for the cold');
    else if (weather === 'hot' && avgVW <= 0.35) reasons.push('Light, airy fabrics for the heat');
  }

  const roles = items.map(i => i.layeringRole).filter(Boolean);
  if (roles.includes('base') && roles.includes('outer')) {
    reasons.push('Smart layering structure from base to outer');
  }

  if (reasons.length === 0) reasons.push('Well-balanced outfit');
  return [...new Set(reasons)].slice(0, 5);
}

// ═══════════════════════════════════════════════════════════════════════════
// PRESENTATION COPY
// ═══════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════
// SANITISATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════
// CONFIDENCE
// ═══════════════════════════════════════════════════════════════════════════

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
// COMPLETE THE LOOK
// ═══════════════════════════════════════════════════════════════════════════

function completeTheLook(items, ctx) {
  const { wardrobe, occasion, weather } = ctx;
  const cats = new Set(items.map(i => i.category));
  const wardrobeCats = new Set(wardrobe.map(i => i.category));

  if (!cats.has('shoes') && !cats.has('dress') && wardrobeCats.has('shoes')) {
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
// DEDUPLICATE ACCESSORIES
// ═══════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════
// FORMAT RESULTS — final diversity gate + output
// ═══════════════════════════════════════════════════════════════════════════

function formatResults(candidates, ctx) {
  const { occasion, timeOfDay, weather, limit } = ctx;

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
    const directionReused = !ctx.wardrobeProfile?.isTiny && usedDirections.has(directionKey);

    let tooSimilar = false;
    if (rec.semanticEmbedding && usedSemanticEmbeddings.length > 0) {
      for (const prevEmb of usedSemanticEmbeddings) {
        if (embeddingSimilarity(rec.semanticEmbedding, prevEmb) > 0.88) {
          tooSimilar = true;
          break;
        }
      }
    }

    if (topReused || botReused || dressReused || shoeReused || directionReused || tooSimilar) continue;

    if (topId) usedTops.add(topId);
    if (botId) usedBottoms.add(botId);
    if (dressId) usedDresses.add(dressId);
    if (shoeId) usedShoes.add(shoeId);
    usedDirections.add(directionKey);
    if (rec.semanticEmbedding) usedSemanticEmbeddings.push(rec.semanticEmbedding);
    diverse.push(rec);
  }

  if (diverse.length < limit) {
    for (const rec of candidates) {
      if (diverse.length >= limit) break;
      if (!diverse.includes(rec)) diverse.push(rec);
    }
  }

  return diverse.slice(0, limit).map((rec, idx) => {
    const deduped = deduplicateAccessories(rec.items);
    const reasons = rec.reasons || buildReasons(deduped, ctx, rec.intel);
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
      reasons,
      title: presentation.title,
      description: presentation.description,
      archetype,
      ...(completeHint ? { completeTheLook: completeHint } : {}),
      ...(rec.isDiscovery ? { isDiscovery: true, discoveryLabel: 'Try something new' } : {}),
      occasion, timeOfDay, weather,
    };
  });
}

module.exports = {
  buildReasons,
  buildPresentationCopy,
  sanitizeReasonList,
  sanitizeAISelections,
  computeRecommendationConfidence,
  classifyArchetype,
  completeTheLook,
  deduplicateAccessories,
  formatResults,
};
