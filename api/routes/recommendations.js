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

const { enforceDailyRecommendations } = require('../middleware/planLimits');

const router = express.Router();

router.get('/test', (_req, res) => {
  res.json({ message: 'Recommendations route is working!' });
});

/**
 * GET /recommendations?userId=...&occasion=casual&timeOfDay=afternoon&weather=warm
 */
router.get('/', enforceDailyRecommendations(), async (req, res) => {
  try {
    const { userId, occasion, timeOfDay, weather, limit, needsLayers, hasRainRisk, tempSwing, temperature, condition, humidity, windSpeed } = req.query;
    const recommendationLimit = parseInt(limit, 10) || 3;

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

    const ctx = {
      wardrobe,
      styleDNA,
      preferences,
      savedOutfits: savedOutfits || [],
      recentFeedback: recentFeedback || [],
      rejectedItemIds,
      likedItemIds,
      occasion: (occasion || 'casual').toLowerCase(),
      timeOfDay: (timeOfDay || 'afternoon').toLowerCase(),
      weather: (weather || 'warm').toLowerCase(),
      weatherDetail,
      limit: recommendationLimit,
      forecast: {
        needsLayers: needsLayers === 'true',
        hasRainRisk: hasRainRisk === 'true' || weatherDetail.isRainy,
        tempSwing: tempSwing ? parseFloat(tempSwing) : 0,
      },
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

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function id(item) { return (item._id || item.id || '').toString(); }

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

function pairCompat(a, b, preferences, occasion) {
  let s = 0.4;
  if (a.color && b.color) s += colorHarmony(a.color, b.color) * 0.3;

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

function rankPool(anchor, pool, preferences, occasion, keepAll = false) {
  if (!pool.length) return [];
  const scored = pool
    .map(item => ({
      item,
      score: pairCompat(anchor, item, preferences, occasion) + Math.random() * 0.12,
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

  // 8. Learning from saved outfits (Jaccard similarity)
  if (savedOutfits?.length > 0) {
    const curIds = new Set(items.map(id));
    let boost = 0;
    savedOutfits.forEach(saved => {
      const sIds = new Set((saved.items || []).map(i => (i.itemId || '').toString()));
      const inter = [...curIds].filter(x => sIds.has(x)).length;
      const union = new Set([...curIds, ...sIds]).size;
      const sim = union > 0 ? inter / union : 0;
      if (sim > 0.25) boost += sim * 0.06;
    });
    s += Math.min(boost, 0.1);
  }

  // 9. Recent feedback signals — boost items user liked, penalize rejected combos
  if (likedItemIds && likedItemIds.size > 0) {
    const likedInOutfit = items.filter(i => likedItemIds.has(id(i))).length;
    s += (likedInOutfit / items.length) * 0.04;
  }
  if (rejectedItemIds && rejectedItemIds.size > 0) {
    const rejectedInOutfit = items.filter(i => rejectedItemIds.has(id(i))).length;
    if (rejectedInOutfit >= 2) s -= 0.06;
  }

  // 10. Weather — handled exclusively by algorithm #8 (checkWeatherCompleteness) inside
  //     evaluateFashionIntelligence above. Removing duplicate block prevents double-counting.

  // 11. Completeness — adapted to what's actually available in wardrobe
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

  return Math.max(0.40, Math.min(0.96, s));
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

  if (reasons.length === 0) reasons.push('Well-balanced outfit');
  return [...new Set(reasons)].slice(0, 5);
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
  const appThreshold = isTinyWardrobe ? 0.0 : (isSmallWardrobe ? 0.15 : 0.25);

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

  preferred.sort((a, b) => weatherItemScore(b) - weatherItemScore(a));

  function getCategory(cat) {
    const pref = preferred.filter(i => i.category === cat);
    if (pref.length > 0) return shuffle(pref);
    const fb = fallback.filter(i => i.category === cat);
    if (fb.length > 0) return shuffle(fb);
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
  const maxCombos = totalCoreItems <= 5 ? 30 : totalCoreItems <= 15 ? 120 : totalCoreItems <= 40 ? 250 : 400;
  const shoesPerCombo = shoes.length <= 2 ? shoes.length : Math.min(3, shoes.length);

  // ─── 3a. Dress-based outfits ───
  if (useDresses) {
    for (const dress of dresses) {
      if (shoes.length > 0) {
        const rankedShoes = rankPool(dress, shoes, preferences, occasion, keepAll);
        for (const shoe of rankedShoes.slice(0, shoesPerCombo)) {
          const items = [dress, shoe];
          if (needsOuterwear) {
            const ow = rankPool(dress, outerwearAll, preferences, occasion, keepAll);
            if (ow.length) items.push(ow[0]);
          }
          if (useAccessories) addBestAccessory(items, dress, accessories, preferences, occasion);
          allCandidates.push(makeCandidate(items, ctx));
        }
    } else {
        const items = [dress];
        if (needsOuterwear) {
          const ow = rankPool(dress, outerwearAll, preferences, occasion, keepAll);
          if (ow.length) items.push(ow[0]);
        }
        if (useAccessories) addBestAccessory(items, dress, accessories, preferences, occasion);
        if (items.length >= 1) allCandidates.push(makeCandidate(items, ctx));
      }
    }
  }

  // ─── 3b. Top + Bottom combinations ───
  let count = 0;

  // For large wardrobes, limit which tops/bottoms we iterate over
  const topLimit = Math.min(tops.length, isTinyWardrobe ? tops.length : (isSmallWardrobe ? 10 : 20));
  const bottomLimit = Math.min(bottoms.length, isTinyWardrobe ? bottoms.length : (isSmallWardrobe ? 10 : 20));

  for (let ti = 0; ti < topLimit && count < maxCombos; ti++) {
    const top = tops[ti];
    for (let bi = 0; bi < bottomLimit && count < maxCombos; bi++) {
      const bottom = bottoms[bi];

      const rankedShoes = rankPool(top, shoes, preferences, occasion, keepAll);
      const shoeSlice = rankedShoes.length > 0
        ? rankedShoes.slice(0, Math.min(shoesPerCombo, rankedShoes.length))
        : (shoes.length > 0 ? [shoes[0]] : [null]);

      for (const shoe of shoeSlice) {
        if (count >= maxCombos) break;
        const base = [top, bottom];
        if (shoe) base.push(shoe);

        if (needsOuterwear) {
          const ow = rankPool(top, outerwearAll, preferences, occasion, keepAll);
          if (ow.length) base.push(ow[0]);
        }

        // Base outfit (no accessories)
        allCandidates.push(makeCandidate([...base], ctx));
        count++;

        if (useAccessories) {
          const with1 = [...base];
          addBestAccessory(with1, top, accessories, preferences, occasion);
          if (with1.length > base.length) {
            allCandidates.push(makeCandidate(with1, ctx));
            count++;
          }

          if (accessories.length >= 3 && count < maxCombos) {
            const with2 = [...base];
            addVariedAccessories(with2, top, accessories, preferences, occasion, 2);
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
  allCandidates.sort((a, b) => b.score - a.score);
  return selectDiverse(allCandidates, limit, isSmallWardrobe);
}

function addBestAccessory(items, anchor, accessories, preferences, occasion) {
  const ranked = rankPool(anchor, accessories, preferences, occasion);
  if (ranked.length === 0) return;
  const existingTypes = new Set(items.filter(i => i.category === 'accessory').map(getAccessoryType));
  const best = ranked.find(a => !existingTypes.has(getAccessoryType(a)));
  if (best) items.push(best);
}

function addVariedAccessories(items, anchor, accessories, preferences, occasion, count) {
  const ranked = rankPool(anchor, accessories, preferences, occasion);
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
  const score = scoreOutfit(items, ctx, intel);
  const reasons = buildReasons(items, ctx, intel);
  return { items, score, reasons };
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
  const seenSigs = new Set();

  function sig(outfit) {
    return outfit.items.map(id).sort().join('|');
  }

  function getCorePieceId(outfit, category) {
    const item = outfit.items.find(i => i.category === category);
    return item ? id(item) : null;
  }

  function diversityPenalty(outfit) {
    let pen = 0;
    const topId = getCorePieceId(outfit, 'top');
    const botId = getCorePieceId(outfit, 'bottom');
    const dressId = getCorePieceId(outfit, 'dress');
    const shoeItem = outfit.items.find(i => i.category === 'shoes');

    // Very heavy penalty for reusing top or bottom — these define an outfit
    if (topId && usedTopIds.has(topId)) pen += 5 * (usedTopIds.get(topId) || 1);
    if (botId && usedBottomIds.has(botId)) pen += 5 * (usedBottomIds.get(botId) || 1);
    if (dressId && usedDressIds.has(dressId)) pen += 6 * (usedDressIds.get(dressId) || 1);

    // Moderate penalty for reusing shoes
    if (shoeItem && usedShoeIds.has(id(shoeItem))) pen += 1.2;

    return pen;
  }

  const diversityWeight = isSmallWardrobe ? 0.20 : 0.45;
  const target = Math.min(limit * 5, candidates.length);
  const pool = [...candidates];
  const windowSize = Math.min(pool.length, isSmallWardrobe ? pool.length : 150);

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

    selected.push(pick);
  }

  return selected;
}

// ═══════════════════════════════════════════════════════════════════════════
// HYBRID: Algorithm + OpenAI
// ═══════════════════════════════════════════════════════════════════════════

async function generateHybridRecommendations(ctx) {
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
        id: `tip_${Date.now()}`,
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
      return await enhanceWithAI(candidates, ctx);
    } catch (err) {
      console.log('AI enhancement failed, using algorithm:', err.message);
    }
  }

  return formatResults(candidates, ctx);
}

function formatResults(candidates, ctx) {
  const { occasion, timeOfDay, weather, limit } = ctx;

  // Final diversity gate: no two results share the same top, bottom, dress, or shoes
  const usedTops = new Set();
  const usedBottoms = new Set();
  const usedDresses = new Set();
  const usedShoes = new Set();
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

    const topReused = topId && usedTops.has(topId);
    const botReused = botId && usedBottoms.has(botId);
    const dressReused = dressId && usedDresses.has(dressId);
    const shoeReused = shoeId && usedShoes.has(shoeId);

    if (topReused || botReused || dressReused || shoeReused) continue;

    if (topId) usedTops.add(topId);
    if (botId) usedBottoms.add(botId);
    if (dressId) usedDresses.add(dressId);
    if (shoeId) usedShoes.add(shoeId);
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
      if ((topId && usedTops.has(topId)) || (botId && usedBottoms.has(botId))) continue;
      if (topId) usedTops.add(topId);
      if (botId) usedBottoms.add(botId);
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
    return {
      id: `rec_${Date.now()}_${idx}`,
      items: deduped.map(item => ({
        id: id(item), name: item.name, category: item.category,
        color: item.color, imageUrl: item.thumbnailUrl || item.mediumUrl || item.imageUrl,
        style: item.style, pattern: item.pattern,
      })),
      score: rec.score,
      confidence: Math.round(rec.score * 100),
      reasons: rec.reasons,
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
  if (preferences?.bodyType) userProfile += `Body type: ${preferences.bodyType}. `;
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

  // Hard-filter: ensure AI sees outfits where each top, bottom, dress, and shoe is unique
  const diverseForAI = [];
  const usedTopIds = new Set();
  const usedBottomIds = new Set();
  const usedDressIds = new Set();
  const usedShoeIds = new Set();
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
    const shoeReused = shoeId && usedShoeIds.has(shoeId);

    if (topReused || botReused || dressReused || shoeReused) continue;

    if (topId) usedTopIds.add(topId);
    if (botId) usedBottomIds.add(botId);
    if (dressId) usedDressIds.add(dressId);
    if (shoeId) usedShoeIds.add(shoeId);
    diverseForAI.push(c);
    if (diverseForAI.length >= 18) break;
  }
  // If strict uniqueness produced too few, relax to allow shoe reuse only
  if (diverseForAI.length < limit) {
    const usedT2 = new Set(diverseForAI.map(c => { const t = c.items.find(i => i.category === 'top'); return t ? id(t) : null; }).filter(Boolean));
    const usedB2 = new Set(diverseForAI.map(c => { const b = c.items.find(i => i.category === 'bottom'); return b ? id(b) : null; }).filter(Boolean));
    for (const c of candidates) {
      if (diverseForAI.length >= 18) break;
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
      if (diverseForAI.length >= 18) break;
      if (!diverseForAI.includes(c)) diverseForAI.push(c);
    }
  }

  const detailed = diverseForAI.map((c, idx) => ({
    idx,
    items: c.items.map(item => ({
      id: id(item), name: item.name || 'Item',
      category: item.category, color: item.color || 'unknown',
        style: item.style || 'casual',
      })),
    score: Math.round(c.score * 100),
    reasons: c.reasons.slice(0, 2),
  }));

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

RULES:
1. Pick ${limit} outfits that each feel DISTINCTLY DIFFERENT — EVERY outfit MUST have a different top AND a different bottom (or dress). NEVER repeat the same top across outfits. NEVER repeat the same bottom across outfits. Different color stories, different moods.${wardrobe.length <= 15 ? ' This is a smaller wardrobe so shoe/accessory reuse is fine — but tops and bottoms MUST be different.' : ''}
2. Every outfit must genuinely suit "${occasion}" at "${timeOfDay}" AND the current weather. If it's cold, prefer warm layers. If it's raining, prefer rain-appropriate outerwear. If it's hot, the outfit should feel light and breathable.
3. Work with what the user OWNS. ${wardrobeSize === 'very small' || wardrobeSize === 'small' ? 'This user has a limited wardrobe — be creative with what they have. Show them how to style a few pieces differently rather than expecting variety they don\'t have. Every outfit you pick should still feel considered and intentional.' : 'With this many pieces available, select outfits that showcase the breadth of their wardrobe — no lazy defaults.'}
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

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a world-class fashion stylist AI. Output ONLY valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.85,
      max_tokens: 1800,
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
  await ApiUsage.create({
    date: new Date(), service: 'openai', operation: 'enhance-outfits',
    tokens: { prompt: pt, completion: ct },
    cost: (pt / 1e6 * 0.15) + (ct / 1e6 * 0.60),
    model: 'gpt-4o-mini',
  }).catch(() => {});

  // Map AI picks back to algorithm candidates (using diverseForAI, not candidates)
  const rawEnhanced = (parsed.outfits || []).map(ai => {
    const orig = diverseForAI[ai.candidateIdx];
    if (!orig) return null;

    const algoScore = (orig.score || 0.7) * 100;
    const aiConf = ai.aiConfidence || 85;
    const final = algoScore * 0.55 + aiConf * 0.45;
    const deduped = deduplicateAccessories(orig.items);

    return {
      id: `hybrid-${Date.now()}-${ai.candidateIdx}`,
      items: deduped.map(item => ({
        id: id(item), name: item.name, category: item.category,
        color: item.color, imageUrl: item.thumbnailUrl || item.mediumUrl || item.imageUrl,
        style: item.style, pattern: item.pattern,
      })),
      score: Math.round(final),
      confidence: Math.round(final),
      reasons: ai.enhancedReasons || [ai.description || 'Styled to perfection'],
      title: ai.title,
      description: ai.description,
      occasion, timeOfDay, weather,
      algorithmScore: Math.round(algoScore),
      aiConfidence: Math.round(aiConf),
      _origIdx: ai.candidateIdx,
    };
  }).filter(Boolean);

  // POST-AI DIVERSITY ENFORCEMENT: reject any AI pick that reuses a top, bottom, or shoe
  const enhanced = [];
  const finalUsedTops = new Set();
  const finalUsedBottoms = new Set();
  const finalUsedDresses = new Set();
  const finalUsedShoes = new Set();

  for (const outfit of rawEnhanced) {
    const topId = outfit.items.find(i => i.category === 'top')?.id;
    const botId = outfit.items.find(i => i.category === 'bottom')?.id;
    const dressId = outfit.items.find(i => i.category === 'dress')?.id;
    const shoeId = outfit.items.find(i => i.category === 'shoes')?.id;

    const topDup = topId && finalUsedTops.has(topId);
    const botDup = botId && finalUsedBottoms.has(botId);
    const dressDup = dressId && finalUsedDresses.has(dressId);
    const shoeDup = shoeId && finalUsedShoes.has(shoeId);

    if (topDup || botDup || dressDup || shoeDup) continue;

    if (topId) finalUsedTops.add(topId);
    if (botId) finalUsedBottoms.add(botId);
    if (dressId) finalUsedDresses.add(dressId);
    if (shoeId) finalUsedShoes.add(shoeId);
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

      if ((tId && finalUsedTops.has(tId)) || (bId && finalUsedBottoms.has(bId)) ||
          (dId && finalUsedDresses.has(dId)) || (sId && finalUsedShoes.has(sId))) continue;

      if (tId) finalUsedTops.add(tId);
      if (bId) finalUsedBottoms.add(bId);
      if (dId) finalUsedDresses.add(dId);
      if (sId) finalUsedShoes.add(sId);

      const deduped = deduplicateAccessories(cand.items);
      enhanced.push({
        id: `rec_${Date.now()}_fill_${idx}`,
        items: deduped.map(item => ({
          id: id(item), name: item.name, category: item.category,
          color: item.color, imageUrl: item.thumbnailUrl || item.mediumUrl || item.imageUrl,
          style: item.style, pattern: item.pattern,
        })),
        score: cand.score,
        confidence: Math.round(cand.score * 100),
        reasons: cand.reasons,
        occasion, timeOfDay, weather,
      });
    }
  }

  // Absolute fallback: if we still have nothing, format whatever candidates exist
  if (enhanced.length === 0) {
    return formatResults(candidates, ctx);
  }

  // Clean up internal field
  enhanced.forEach(o => delete o._origIdx);
  return enhanced.slice(0, limit);
}

module.exports = router;
