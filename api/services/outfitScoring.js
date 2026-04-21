/**
 * outfitScoring.js — All outfit scoring: item preference fit, pairwise
 * compatibility, ranking, body-type rules, and the main scoreOutfit orchestrator.
 */

const {
  OCCASION_PROFILES,
  evaluateFashionIntelligence,
} = require('../utils/fashionIntelligence');
const { semanticCompatibility } = require('../utils/semanticStyleProfile');
const {
  clamp,
  id,
  seededNoise,
  scoreItemRotation,
  outfitRotationScore,
  getSemanticProfileCached,
  semanticOutfitCohesionCached,
  getCandidateSemanticDescriptor,
  outfitColorHarmony,
  colorHarmony,
  embeddingSimilarity,
  trendAlignmentScore,
  getOutfitDirection,
} = require('./recommendationHelpers');
const { feedbackPatternScore } = require('./feedbackPatterns');
const { crossDayPenalty } = require('./outfitMemory');
const { userColorTempScore } = require('./colorTemperature');

// ═══════════════════════════════════════════════════════════════════════════
// ITEM PREFERENCE FIT
// ═══════════════════════════════════════════════════════════════════════════

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
// OUTFIT SCORING — the main 20-signal scorer
// ═══════════════════════════════════════════════════════════════════════════

function scoreOutfit(items, ctx, cachedIntel) {
  const { styleDNA, preferences, savedOutfits, occasion, timeOfDay, weather, rejectedItemIds, likedItemIds } = ctx;
  let s = 0.35;

  // 1. Fashion intelligence — all algorithms
  const intel = cachedIntel || evaluateFashionIntelligence(items, occasion, weather, timeOfDay, ctx.weatherDetail);
  s += intel.score * 0.35;

  // 2. Semantic cohesion
  const semanticCohesion = semanticOutfitCohesionCached(items, ctx);
  s += semanticCohesion * 0.10;

  // 3. Style DNA alignment
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

  // 4. Color harmony across whole outfit
  s += outfitColorHarmony(items) * 0.12;

  // 5. Pattern mixing
  const patterns = items.map(i => i.pattern).filter(Boolean);
  const nonSolid = patterns.filter(p => p !== 'solid');
  if (nonSolid.length === 0) s += 0.04;
  else if (nonSolid.length === 1) s += 0.06;
  else if (new Set(nonSolid).size > 1) s -= 0.04;

  // 6. User preference fit
  if (preferences) {
    let prefScore = 0;
    items.forEach(item => {
      prefScore += itemPreferenceFit(item, ctx);
    });
    s += (prefScore / items.length - 0.5) * 0.12;
  }

  // 7. Saved outfit similarity bonus (user loves similar combos)
  if (savedOutfits?.length > 0) {
    const savedItemIdSets = savedOutfits.map(outfit =>
      new Set((outfit.items || []).map(i => (i._id || i.id || i.item || '').toString()))
    );
    let bestOverlap = 0;
    const currentIds = new Set(items.map(i => id(i)));
    for (const savedSet of savedItemIdSets) {
      const overlap = [...currentIds].filter(cid => savedSet.has(cid)).length;
      const ratio = overlap / Math.max(currentIds.size, 1);
      if (ratio > bestOverlap) bestOverlap = ratio;
    }
    if (bestOverlap >= 0.6) s += 0.06;
    else if (bestOverlap >= 0.3) s += 0.03;
  }

  // 8. Formality alignment with occasion
  const targetFormality = {
    casual: 0.38, work: 0.72, date: 0.58, party: 0.64, gym: 0.15, formal: 0.88,
  }[occasion] || 0.48;
  const avgFormality = items.reduce((sum, i) => {
    return sum + (getSemanticProfileCached(i, ctx).axes?.formality ?? 0.5);
  }, 0) / (items.length || 1);
  const formalityFit = 1 - Math.abs(avgFormality - targetFormality);
  s += formalityFit * 0.06;

  // 9. Diversity — mild penalty for too-similar pieces
  if (items.length >= 3) {
    let maxSemanticSimilarity = 0;
    let avgSemanticSimilarity = 0;
    let pairCount = 0;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (items[i].category === items[j].category) continue;
        const profA = getSemanticProfileCached(items[i], ctx);
        const profB = getSemanticProfileCached(items[j], ctx);
        const sim = embeddingSimilarity(profA.embedding, profB.embedding);
        if (sim > maxSemanticSimilarity) maxSemanticSimilarity = sim;
        avgSemanticSimilarity += sim;
        pairCount++;
      }
    }
    if (pairCount > 0) avgSemanticSimilarity /= pairCount;
    if (maxSemanticSimilarity > 0.86) {
      s -= Math.min((maxSemanticSimilarity - 0.86) * 0.20, 0.05);
    }
    if (avgSemanticSimilarity > 0.68) {
      s -= 0.02;
    }
  }

  // 10. Rotation bonus
  const rotationScore = outfitRotationScore(items);
  s += (rotationScore - 0.5) * 0.12;
  const freshCorePieces = items.filter(item =>
    ['top', 'bottom', 'dress', 'outerwear'].includes(item.category) && scoreItemRotation(item) >= 0.68
  ).length;
  if (freshCorePieces >= 2) s += 0.03;

  // 11. Recent feedback signals
  if (likedItemIds && likedItemIds.size > 0) {
    const likedInOutfit = items.filter(i => likedItemIds.has(id(i))).length;
    s += (likedInOutfit / items.length) * 0.03;
  }
  if (rejectedItemIds && rejectedItemIds.size > 0) {
    const rejectedInOutfit = items.filter(i => rejectedItemIds.has(id(i))).length;
    if (rejectedInOutfit === 1) s -= 0.03;
    if (rejectedInOutfit >= 2) s -= 0.06;
  }

  // 12. Completeness
  const hasTop = items.some(i => i.category === 'top' || i.category === 'dress');
  const hasBot = items.some(i => i.category === 'bottom' || i.category === 'dress');
  const hasShoes = items.some(i => i.category === 'shoes');
  const hasAcc = items.some(i => i.category === 'accessory');

  const wardrobeHasShoes = ctx.wardrobe.some(i => i.category === 'shoes');
  const wardrobeHasAcc = ctx.wardrobe.some(i => i.category === 'accessory');

  let completenessChecks = 2;
  let completenessMet = (hasTop ? 1 : 0) + (hasBot ? 1 : 0);
  if (wardrobeHasShoes) { completenessChecks++; completenessMet += hasShoes ? 1 : 0; }
  if (wardrobeHasAcc) { completenessChecks++; completenessMet += hasAcc ? 1 : 0; }

  s += (completenessMet / completenessChecks) * 0.06;

  if (items.length >= 3 && items.length <= 5) s += 0.02;

  // 13. Trend alignment
  s += trendAlignmentScore(items, styleDNA) * 0.04;

  // 14. Feedback pattern combos
  if (ctx.feedbackPatterns) {
    s += feedbackPatternScore(items, ctx.feedbackPatterns);
  }

  // 15. Cross-day freshness
  if (ctx.recentlyServed?.length > 0) {
    s -= crossDayPenalty(items, ctx.recentlyServed);
  }

  // 16. User color temperature alignment
  if (ctx.userColorTemp) {
    s += userColorTempScore(items, ctx.userColorTemp);
  }

  // 17. Visual weight balance — items should have compatible visual density
  const visualWeights = items.map(i => i.visualWeight).filter(w => typeof w === 'number');
  if (visualWeights.length >= 2) {
    const avgVW = visualWeights.reduce((a, b) => a + b, 0) / visualWeights.length;
    const maxSpread = Math.max(...visualWeights) - Math.min(...visualWeights);
    // Moderate spread is good (visual interest); extreme spread can clash
    if (maxSpread >= 0.15 && maxSpread <= 0.55) s += 0.03;
    else if (maxSpread > 0.70) s -= 0.02;
    // Weather alignment: heavy visual weight in cold, light in hot
    if (weather === 'cold' && avgVW >= 0.55) s += 0.02;
    else if (weather === 'hot' && avgVW <= 0.35) s += 0.02;
    else if (weather === 'hot' && avgVW >= 0.65) s -= 0.03;
  }

  // 18. Fabric surface compatibility
  const surfaces = items.map(i => i.fabricSurface).filter(Boolean);
  if (surfaces.length >= 2) {
    const SURFACE_CLASH = { sheer: ['nubby', 'waxed'], metallic: ['nubby', 'brushed'], glossy: ['distressed'] };
    let surfaceClash = false;
    for (let i = 0; i < surfaces.length && !surfaceClash; i++) {
      for (let j = i + 1; j < surfaces.length && !surfaceClash; j++) {
        const clashList = SURFACE_CLASH[surfaces[i]] || [];
        if (clashList.includes(surfaces[j])) surfaceClash = true;
        const clashList2 = SURFACE_CLASH[surfaces[j]] || [];
        if (clashList2.includes(surfaces[i])) surfaceClash = true;
      }
    }
    if (surfaceClash) s -= 0.03;
    // Texture contrast bonus (matte+satin, matte+glossy — visually interesting)
    const uniqueSurfaces = new Set(surfaces);
    if (uniqueSurfaces.size >= 2 && !surfaceClash) s += 0.02;
  }

  // 19. Layering role coherence — base+mid or base+outer is better than all standalone
  const roles = items.map(i => i.layeringRole).filter(Boolean);
  if (roles.length >= 2) {
    const hasBase = roles.includes('base');
    const hasMid = roles.includes('mid');
    const hasOuter = roles.includes('outer');
    if (hasBase && (hasMid || hasOuter)) s += 0.02;
    if (hasBase && hasMid && hasOuter) s += 0.02;
  }

  // 20. Occasion sub-variant formality boost
  if (ctx.occasionSubVariant) {
    const targetF = ctx.occasionSubVariant.formality;
    const avgF = items.reduce((sum, i) => {
      const f = getSemanticProfileCached(i, ctx).axes?.formality ?? 0.5;
      return sum + f;
    }, 0) / (items.length || 1);
    const fFit = 1 - Math.abs(avgF - targetF);
    s += fFit * 0.05;
  }

  return Math.max(0.40, Math.min(0.96, s));
}

// ═══════════════════════════════════════════════════════════════════════════
// MAKE CANDIDATE — wraps items with score + intel + metadata
// ═══════════════════════════════════════════════════════════════════════════

function makeCandidate(items, ctx) {
  const intel = evaluateFashionIntelligence(items, ctx.occasion, ctx.weather, ctx.timeOfDay, ctx.weatherDetail);
  const semanticDescriptor = getCandidateSemanticDescriptor(items, ctx);
  const semanticCohesion = semanticOutfitCohesionCached(items, ctx);
  const score = scoreOutfit(items, ctx, intel);
  // buildReasons is in outfitPresentation — we attach intel so it can be called later
  return {
    items,
    score,
    intel,
    direction: getOutfitDirection(items),
    semanticCohesion,
    semanticEmbedding: semanticDescriptor.embedding,
    semanticAesthetics: semanticDescriptor.aesthetics,
    semanticVibes: semanticDescriptor.vibes,
  };
}

module.exports = {
  itemPreferenceFit,
  bodyTypeFitScore,
  pairCompat,
  rankPool,
  scoreOutfit,
  makeCandidate,
};
