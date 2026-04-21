/**
 * outfitBuilder.js — Candidate outfit generation, diversity selection,
 * and the discovery/exploration engine.
 */

const {
  OCCASION_PROFILES,
  checkItemAppropriateness,
} = require('../utils/fashionIntelligence');
const { semanticOutfitSimilarity } = require('../utils/semanticStyleProfile');
const {
  clamp,
  id,
  seededNoise,
  scoreItemRotation,
  getStyleGroup,
  getDominantStyleGroup,
  getOutfitDirection,
  getAccessoryType,
  embeddingSimilarity,
} = require('./recommendationHelpers');
const { rankPool, makeCandidate, itemPreferenceFit } = require('./outfitScoring');

// ═══════════════════════════════════════════════════════════════════════════
// DIVERSITY-FIRST SELECTION — no two outfits should feel the same
// ═══════════════════════════════════════════════════════════════════════════

function selectDiverse(candidates, limit, isSmallWardrobe = false) {
  if (candidates.length === 0) return [];
  const selected = [];
  const usedTopIds = new Map();
  const usedBottomIds = new Map();
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

    if (topId && usedTopIds.has(topId)) pen += 5 * (usedTopIds.get(topId) || 1);
    if (botId && usedBottomIds.has(botId)) pen += 5 * (usedBottomIds.get(botId) || 1);
    if (dressId && usedDressIds.has(dressId)) pen += 6 * (usedDressIds.get(dressId) || 1);
    if (shoeItem && usedShoeIds.has(id(shoeItem))) pen += 1.2;
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
// OUTFIT BUILDER — occasion-smart, time-aware, diverse
// ═══════════════════════════════════════════════════════════════════════════

function buildDiverseOutfits(ctx) {
  const { wardrobe, occasion, weather, timeOfDay, preferences, limit, forecast, weatherDetail: wd } = ctx;
  const profile = OCCASION_PROFILES[occasion] || OCCASION_PROFILES.casual;
  const wdSafe = wd || {};
  const isSmallWardrobe = wardrobe.length <= 15;
  const isTinyWardrobe = wardrobe.length <= 8;

  // ─── 1. Filter wardrobe ───
  let pool = [...wardrobe];

  if (preferences?.avoidedColors?.length && !isTinyWardrobe) {
    const avoid = new Set(preferences.avoidedColors.map(c => c.toLowerCase()));
    pool = pool.filter(item => !avoid.has((item.color || '').toLowerCase()));
    if (pool.length < 3) pool = [...wardrobe];
  }

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
    const merged = [...pref, ...fb];
    if (merged.length > 0) return rankCategoryItems(merged);
    return [];
  }

  // ─── 2. Categorise ───
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

// ═══════════════════════════════════════════════════════════════════════════
// DISCOVERY / EXPLORATION — pushes style boundaries
// ═══════════════════════════════════════════════════════════════════════════

function buildDiscoveryOutfit(ctx, existingCandidates) {
  const { wardrobe, occasion, preferences, styleDNA, limit } = ctx;

  if (limit < 3 || wardrobe.length < 10) return null;

  const primaryGroup = styleDNA?.primaryStyle ? getStyleGroup(styleDNA.primaryStyle) : getDominantStyleGroup(wardrobe);
  const existingGroups = new Set(existingCandidates.map(c => getOutfitDirection(c.items).styleGroup));

  const underused = wardrobe.filter(item => {
    const rotation = scoreItemRotation(item);
    const group = getStyleGroup(item.style);
    return rotation >= 0.6 && group !== primaryGroup && !existingGroups.has(group);
  });

  if (underused.length < 2) return null;

  const tops = underused.filter(i => i.category === 'top');
  const bottoms = underused.filter(i => i.category === 'bottom');
  const dresses = underused.filter(i => i.category === 'dress');
  const shoes = wardrobe.filter(i => i.category === 'shoes');

  let discoveryItems = [];

  if (dresses.length > 0) {
    discoveryItems.push(dresses[0]);
  } else if (tops.length > 0 && bottoms.length > 0) {
    discoveryItems.push(tops[0], bottoms[0]);
  } else {
    return null;
  }

  if (shoes.length > 0) {
    const anchor = discoveryItems[0];
    const rankedShoes = rankPool(anchor, shoes, preferences, occasion, false, ctx);
    if (rankedShoes.length > 0) discoveryItems.push(rankedShoes[0]);
  }

  if (discoveryItems.length < 2) return null;

  const candidate = makeCandidate(discoveryItems, ctx);
  if (candidate.score < 0.45) return null;

  candidate.isDiscovery = true;
  return candidate;
}

module.exports = {
  selectDiverse,
  buildDiverseOutfits,
  buildDiscoveryOutfit,
};
