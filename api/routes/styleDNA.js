const express = require('express');
const ClothingItem = require('../models/ClothingItem');
const StyleDNA = require('../models/StyleDNA');
const OutfitFeedback = require('../models/OutfitFeedback');
const UserPreferences = require('../models/UserPreferences');

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /style-dna/:userId
 * Calculate or return cached Style DNA
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const items = await ClothingItem.find({ userId });

    if (items.length === 0) {
      return res.status(404).json({ error: 'No wardrobe items found. Add items to calculate Style DNA.' });
    }

    const styleDNA = await calculateStyleDNA(userId, items);
    res.json({ styleDNA });
  } catch (err) {
    console.error('GET /style-dna/:userId error', err);
    res.status(500).json({ error: 'Failed to calculate Style DNA' });
  }
});

/**
 * POST /style-dna/:userId/recalculate
 * Force full recalculation
 */
router.post('/:userId/recalculate', async (req, res) => {
  try {
    const { userId } = req.params;
    const items = await ClothingItem.find({ userId });
    const styleDNA = await calculateStyleDNA(userId, items, true);
    res.json({ styleDNA });
  } catch (err) {
    console.error('POST /style-dna/:userId/recalculate error', err);
    res.status(500).json({ error: 'Failed to recalculate Style DNA' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SMART STATISTICS ENGINE — all local, no AI needed
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Analyze wardrobe items and compute detailed statistics
 */
function computeWardrobeStats(items) {
  const total = items.length;

  // ── Category distribution ──────────────────────────────────────────────────
  const categoryDistribution = { top: 0, bottom: 0, dress: 0, shoes: 0, outerwear: 0, accessory: 0 };
  items.forEach((i) => {
    if (i.category in categoryDistribution) categoryDistribution[i.category]++;
  });

  // ── Wardrobe balance ───────────────────────────────────────────────────────
  const coreCategories = ['top', 'bottom', 'shoes'];
  const allCategories = Object.keys(categoryDistribution);
  const filledCategories = allCategories.filter((c) => categoryDistribution[c] > 0);
  const completenessScore = clamp(filledCategories.length / allCategories.length);

  const avgPerCategory = total / allCategories.length;
  const gaps = allCategories.filter((c) => categoryDistribution[c] < avgPerCategory * 0.3);
  const strengths = allCategories.filter((c) => categoryDistribution[c] > avgPerCategory * 1.5);

  // ── Color analysis ─────────────────────────────────────────────────────────
  const colorCounts = {};
  items.forEach((i) => {
    if (i.color) {
      const c = i.color.toLowerCase().trim();
      colorCounts[c] = (colorCounts[c] || 0) + 1;
    }
    // Also count from colorPalette array if present
    if (Array.isArray(i.colorPalette)) {
      i.colorPalette.forEach((cp) => {
        const c = cp.toLowerCase().trim();
        colorCounts[c] = (colorCounts[c] || 0) + 1;
      });
    }
  });

  const sortedColors = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]);
  const uniqueColorCount = sortedColors.length;
  const dominantColors = sortedColors.slice(0, 6).map(([color, count]) => ({
    color,
    name: color,
    percentage: Math.round((count / total) * 100),
  }));
  const colorPalette = dominantColors.map((c) => c.color);
  // Color diversity: ratio of unique colors to total items, capped at 1
  const colorDiversity = clamp(uniqueColorCount / Math.max(total, 1));

  // ── Pattern analysis ───────────────────────────────────────────────────────
  const patternCounts = {};
  items.forEach((i) => {
    const p = (i.pattern || 'solid').toLowerCase().trim();
    patternCounts[p] = (patternCounts[p] || 0) + 1;
  });
  const patternBreakdown = Object.entries(patternCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([pattern, count]) => ({ pattern, count, percentage: Math.round((count / total) * 100) }));

  // ── Brand affinity ─────────────────────────────────────────────────────────
  const brandCounts = {};
  items.forEach((i) => {
    if (i.brand) {
      const b = i.brand.toLowerCase().trim();
      brandCounts[b] = (brandCounts[b] || 0) + 1;
    }
  });
  const brandAffinity = Object.entries(brandCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([brand, count]) => ({
      brand: brand.charAt(0).toUpperCase() + brand.slice(1),
      count,
      score: clamp(count / total),
    }));

  // ── Style counts (for primary/secondary style detection) ───────────────────
  const styleCounts = {};
  items.forEach((i) => {
    if (i.style) {
      const s = i.style.toLowerCase().trim();
      styleCounts[s] = (styleCounts[s] || 0) + 1;
    }
  });
  const sortedStyles = Object.entries(styleCounts).sort((a, b) => b[1] - a[1]);
  const primaryStyle = sortedStyles[0]?.[0] || 'casual';
  const secondaryStyles = sortedStyles.slice(1, 4).map(([s]) => s);

  // ── Occasion coverage ──────────────────────────────────────────────────────
  const occasionCounts = {};
  items.forEach((i) => {
    if (Array.isArray(i.occasion)) {
      i.occasion.forEach((o) => {
        const occ = o.toLowerCase().trim();
        occasionCounts[occ] = (occasionCounts[occ] || 0) + 1;
      });
    }
  });
  const occasionCoverage = Object.entries(occasionCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([occasion, itemCount]) => ({ occasion, itemCount, percentage: Math.round((itemCount / total) * 100) }));
  const versatilityScore = clamp(Object.keys(occasionCounts).length / 6); // 6 common occasions

  // ── Semantic axes (average from items that have semanticProfile.axes) ──────
  const axisNames = ['formality', 'structure', 'texture', 'boldness', 'softness', 'warmth', 'polish', 'ruggedness', 'minimalism', 'versatility'];
  const axisSums = {};
  const axisCounts = {};
  const axisValues = {}; // for std dev calculation
  axisNames.forEach((a) => { axisSums[a] = 0; axisCounts[a] = 0; axisValues[a] = []; });

  items.forEach((i) => {
    const axes = i.semanticProfile?.axes;
    if (!axes) return;
    axisNames.forEach((a) => {
      if (typeof axes[a] === 'number') {
        axisSums[a] += axes[a];
        axisCounts[a]++;
        axisValues[a].push(axes[a]);
      }
    });
  });

  const semanticAxes = {};
  axisNames.forEach((a) => {
    semanticAxes[a] = axisCounts[a] > 0 ? round2(axisSums[a] / axisCounts[a]) : null;
  });
  const hasSemanticData = axisNames.some((a) => axisCounts[a] > 0);

  // ── Wear behavior ──────────────────────────────────────────────────────────
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const wornItems = items.filter((i) => i.wearCount > 0);
  const recentlyWorn = items.filter((i) => i.lastWorn && new Date(i.lastWorn) > thirtyDaysAgo);
  const favoriteItems = items.filter((i) => i.favorite);
  const neglectedItems = items.filter((i) => !i.wearCount || i.wearCount === 0);

  const totalWearCount = items.reduce((sum, i) => sum + (i.wearCount || 0), 0);
  const avgWearCount = total > 0 ? round2(totalWearCount / total) : 0;

  const mostWornItems = [...items]
    .sort((a, b) => (b.wearCount || 0) - (a.wearCount || 0))
    .slice(0, 5)
    .filter((i) => i.wearCount > 0)
    .map((i) => i.name);

  const wearBehavior = {
    mostWornItems,
    avgWearCount,
    favoritesRatio: clamp(favoriteItems.length / Math.max(total, 1)),
    activeItemsRatio: clamp(recentlyWorn.length / Math.max(total, 1)),
    neglectedCount: neglectedItems.length,
  };

  return {
    total,
    categoryDistribution,
    completenessScore,
    versatilityScore,
    gaps,
    strengths,
    dominantColors,
    colorPalette,
    colorDiversity,
    patternBreakdown,
    brandAffinity,
    primaryStyle,
    secondaryStyles,
    styleCounts,
    occasionCoverage,
    semanticAxes,
    hasSemanticData,
    axisValues,
    wearBehavior,
    sortedColors,
    uniqueColorCount,
  };
}

/**
 * Compute feedback profile from OutfitFeedback
 */
async function computeFeedbackProfile(userId) {
  const feedback = await OutfitFeedback.find({ userId }).lean();
  if (!feedback.length) {
    return { totalFeedback: 0, avgRating: 0, preferredOccasions: [], saveRate: 0, rejectRate: 0 };
  }

  const saved = feedback.filter((f) => f.action === 'saved').length;
  const rejected = feedback.filter((f) => f.action === 'rejected').length;
  const rated = feedback.filter((f) => f.action === 'rated' && f.rating);
  const avgRating = rated.length > 0
    ? round2(rated.reduce((s, f) => s + f.rating, 0) / rated.length)
    : 0;

  // Find which occasions the user saves most
  const occasionSaves = {};
  feedback.filter((f) => f.action === 'saved' && f.occasion).forEach((f) => {
    occasionSaves[f.occasion] = (occasionSaves[f.occasion] || 0) + 1;
  });
  const preferredOccasions = Object.entries(occasionSaves)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([o]) => o);

  return {
    totalFeedback: feedback.length,
    avgRating,
    preferredOccasions,
    saveRate: clamp(saved / feedback.length),
    rejectRate: clamp(rejected / feedback.length),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MATHEMATICAL SCORE CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Uniqueness: how diverse/varied is the wardrobe?
 * High score = many different colors, patterns, styles, brands
 */
function calcUniquenessScore(stats) {
  const colorScore = clamp(stats.uniqueColorCount / Math.max(stats.total * 0.6, 1));
  const patternScore = clamp(stats.patternBreakdown.length / 5); // 5+ patterns = max
  const styleScore = clamp(Object.keys(stats.styleCounts).length / 4); // 4+ styles = max
  const brandScore = clamp(stats.brandAffinity.length / 5); // 5+ brands = max
  const categoryScore = stats.completenessScore;

  // Weighted average
  return round2(
    colorScore * 0.25 +
    patternScore * 0.2 +
    styleScore * 0.25 +
    brandScore * 0.15 +
    categoryScore * 0.15
  );
}

/**
 * Style consistency: how cohesive is the wardrobe?
 * High score = semantic axes are tightly grouped (low std dev), dominant style is strong
 */
function calcStyleConsistency(stats) {
  // If we have semantic axis data, use standard deviation
  let axisConsistency = 0.5;
  if (stats.hasSemanticData) {
    const stdDevs = [];
    const axisNames = Object.keys(stats.axisValues);
    axisNames.forEach((a) => {
      const vals = stats.axisValues[a];
      if (vals.length >= 3) {
        const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
        const variance = vals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / vals.length;
        stdDevs.push(Math.sqrt(variance));
      }
    });
    if (stdDevs.length > 0) {
      const avgStdDev = stdDevs.reduce((s, v) => s + v, 0) / stdDevs.length;
      // Lower std dev = more consistent; 0.3+ std dev = very inconsistent
      axisConsistency = clamp(1 - (avgStdDev / 0.35));
    }
  }

  // Style dominance: how much does the top style dominate?
  const sortedStyles = Object.entries(stats.styleCounts).sort((a, b) => b[1] - a[1]);
  let styleDominance = 0.5;
  if (sortedStyles.length > 0) {
    const topStyleRatio = sortedStyles[0][1] / stats.total;
    // 40%+ in one style = consistent; below 20% = scattered
    styleDominance = clamp((topStyleRatio - 0.15) / 0.4);
  }

  // Color concentration: top 3 colors as % of total
  const top3ColorPct = stats.sortedColors.slice(0, 3).reduce((s, [, c]) => s + c, 0) / Math.max(stats.total, 1);
  const colorConsistency = clamp(top3ColorPct / 0.7); // 70%+ in 3 colors = very consistent

  return round2(
    axisConsistency * 0.4 +
    styleDominance * 0.35 +
    colorConsistency * 0.25
  );
}

/**
 * Trend alignment: how "current" and active is their wardrobe usage?
 * High score = wears items regularly, has variety, engages with the app
 */
function calcTrendAlignment(stats, feedbackProfile) {
  // Active wearing = keeping up with fashion (proxy)
  const wearActivity = clamp(stats.wearBehavior.activeItemsRatio * 1.5);

  // Variety of occasions = trend-aware dressing
  const occasionVariety = stats.versatilityScore;

  // Feedback engagement = actively curating style
  const engagement = feedbackProfile.totalFeedback > 0
    ? clamp(Math.log(feedbackProfile.totalFeedback + 1) / Math.log(30)) // log scale, 30 feedback = max
    : 0;

  // Pattern variety: trend-aware people mix patterns
  const patternVariety = clamp((stats.patternBreakdown.length - 1) / 4);

  return round2(
    wearActivity * 0.3 +
    occasionVariety * 0.25 +
    engagement * 0.25 +
    patternVariety * 0.2
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SMART PRIMARY STYLE DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Determine primary style using both item tags AND semantic axes
 */
function detectPrimaryStyle(stats) {
  // Start with item-level style counts
  const styleScores = { ...stats.styleCounts };

  // Boost based on semantic axes if available
  if (stats.hasSemanticData) {
    const axes = stats.semanticAxes;
    // High formality + high polish → classic/elegant
    if (axes.formality > 0.65 && axes.polish > 0.6) {
      styleScores['classic'] = (styleScores['classic'] || 0) + stats.total * 0.3;
      styleScores['elegant'] = (styleScores['elegant'] || 0) + stats.total * 0.2;
    }
    // High minimalism + low boldness → minimalist
    if (axes.minimalism > 0.65 && (axes.boldness || 0) < 0.4) {
      styleScores['minimalist'] = (styleScores['minimalist'] || 0) + stats.total * 0.4;
    }
    // High boldness + high texture → streetwear/maximalist
    if (axes.boldness > 0.6 && axes.texture > 0.5) {
      styleScores['streetwear'] = (styleScores['streetwear'] || 0) + stats.total * 0.3;
    }
    // High softness + low structure → bohemian
    if (axes.softness > 0.6 && (axes.structure || 0) < 0.4) {
      styleScores['bohemian'] = (styleScores['bohemian'] || 0) + stats.total * 0.3;
    }
    // High ruggedness + high warmth → rugged/outdoor
    if (axes.ruggedness > 0.6 && axes.warmth > 0.5) {
      styleScores['rugged'] = (styleScores['rugged'] || 0) + stats.total * 0.3;
    }
    // Low formality + high versatility → casual
    if ((axes.formality || 0) < 0.35 && axes.versatility > 0.5) {
      styleScores['casual'] = (styleScores['casual'] || 0) + stats.total * 0.2;
    }
  }

  const sorted = Object.entries(styleScores).sort((a, b) => b[1] - a[1]);
  return {
    primaryStyle: sorted[0]?.[0] || 'casual',
    secondaryStyles: sorted.slice(1, 4).map(([s]) => s),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN CALCULATION ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════════

async function calculateStyleDNA(userId, items, forceRecalculate = false) {
  // ── Smart cache: skip if calculated within 24h and wardrobe barely changed ──
  if (!forceRecalculate) {
    const existing = await StyleDNA.findOne({ userId }).lean();
    if (existing && existing.lastCalculated) {
      const ageHours = (Date.now() - new Date(existing.lastCalculated).getTime()) / 3_600_000;
      const itemDelta = Math.abs(items.length - (existing.itemCountAtCalculation || 0));
      if (ageHours < 24 && itemDelta < 3) return existing;
    }
  }

  // ── Step 1: Compute all local statistics ───────────────────────────────────
  const stats = computeWardrobeStats(items);
  const feedbackProfile = await computeFeedbackProfile(userId);

  // Load user preferences (from onboarding) for context
  let userPrefs = null;
  try {
    userPrefs = await UserPreferences.findOne({ userId }).lean();
  } catch (_) {}

  // ── Step 2: Calculate real mathematical scores ─────────────────────────────
  const uniquenessScore = calcUniquenessScore(stats);
  const styleConsistency = calcStyleConsistency(stats);
  const trendAlignment = calcTrendAlignment(stats, feedbackProfile);

  // ── Step 3: Detect primary style smartly ───────────────────────────────────
  const { primaryStyle, secondaryStyles } = detectPrimaryStyle(stats);

  // ── Step 4: Build the base DNA (works without AI) ──────────────────────────
  const baseDNA = {
    userId,
    primaryStyle,
    secondaryStyles,
    colorPreferences: {
      dominantColors: stats.dominantColors,
      colorPalette: stats.colorPalette,
      colorDiversity: stats.colorDiversity,
      seasonalColors: { spring: [], summer: [], fall: [], winter: [] },
    },
    brandAffinity: stats.brandAffinity,
    categoryDistribution: stats.categoryDistribution,
    wardrobeBalance: {
      totalItems: stats.total,
      gaps: stats.gaps,
      strengths: stats.strengths,
      versatilityScore: stats.versatilityScore,
      completenessScore: stats.completenessScore,
    },
    semanticAxes: stats.hasSemanticData ? stats.semanticAxes : undefined,
    patternBreakdown: stats.patternBreakdown,
    occasionCoverage: stats.occasionCoverage,
    wearBehavior: stats.wearBehavior,
    feedbackProfile,
    uniquenessScore,
    styleConsistency,
    trendAlignment,
    itemCountAtCalculation: items.length,
    lastCalculated: new Date(),
  };

  // ── Step 5: Use AI for personality/insight text (optional enhancement) ─────
  let aiFields = {};
  if (process.env.OPENAI_API_KEY) {
    try {
      aiFields = await generateAIInsights(stats, feedbackProfile, userPrefs, baseDNA);
    } catch (err) {
      console.error('Style DNA AI enhancement failed (using fallback text):', err.message);
      aiFields = generateFallbackInsights(baseDNA, stats);
    }
  } else {
    aiFields = generateFallbackInsights(baseDNA, stats);
  }

  const finalDNA = { ...baseDNA, ...aiFields };

  // ── Step 6: Track style evolution ──────────────────────────────────────────
  const existing = await StyleDNA.findOne({ userId }).lean();
  if (existing?.styleEvolution) {
    finalDNA.styleEvolution = [
      ...existing.styleEvolution.slice(-11), // keep last 11 entries
      {
        date: new Date(),
        style: primaryStyle,
        scores: { uniqueness: uniquenessScore, consistency: styleConsistency, trend: trendAlignment },
        itemCount: items.length,
      },
    ];
  } else {
    finalDNA.styleEvolution = [{
      date: new Date(),
      style: primaryStyle,
      scores: { uniqueness: uniquenessScore, consistency: styleConsistency, trend: trendAlignment },
      itemCount: items.length,
    }];
  }

  return StyleDNA.findOneAndUpdate({ userId }, finalDNA, { upsert: true, new: true });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI INSIGHT GENERATION (uses pre-computed stats → smarter, cheaper prompt)
// ═══════════════════════════════════════════════════════════════════════════════

async function generateAIInsights(stats, feedbackProfile, userPrefs, baseDNA) {
  // Build a compact stats summary so AI focuses on PERSONALITY, not counting
  const context = {
    itemCount: stats.total,
    primaryStyle: baseDNA.primaryStyle,
    secondaryStyles: baseDNA.secondaryStyles,
    topColors: stats.colorPalette.slice(0, 4),
    topPatterns: stats.patternBreakdown.slice(0, 3).map((p) => p.pattern),
    topBrands: stats.brandAffinity.slice(0, 3).map((b) => b.brand),
    gaps: baseDNA.wardrobeBalance.gaps,
    strengths: baseDNA.wardrobeBalance.strengths,
    scores: {
      uniqueness: baseDNA.uniquenessScore,
      consistency: baseDNA.styleConsistency,
      trend: baseDNA.trendAlignment,
      versatility: baseDNA.wardrobeBalance.versatilityScore,
    },
    wearBehavior: {
      avgWears: stats.wearBehavior.avgWearCount,
      favRatio: stats.wearBehavior.favoritesRatio,
      neglected: stats.wearBehavior.neglectedCount,
    },
    feedback: {
      total: feedbackProfile.totalFeedback,
      avgRating: feedbackProfile.avgRating,
      saveRate: feedbackProfile.saveRate,
    },
  };

  // Include onboarding preferences if available
  if (userPrefs) {
    context.userPrefs = {
      bodyType: userPrefs.bodyType || '',
      ageRange: userPrefs.ageRange || '',
      preferredStyles: (userPrefs.preferredStyles || []).slice(0, 3),
      avoidedColors: (userPrefs.avoidedColors || []).slice(0, 3),
    };
  }

  // Include semantic axes summary if available
  if (stats.hasSemanticData) {
    const axes = stats.semanticAxes;
    const highAxes = Object.entries(axes).filter(([, v]) => v !== null && v > 0.6).map(([k]) => k);
    const lowAxes = Object.entries(axes).filter(([, v]) => v !== null && v < 0.35).map(([k]) => k);
    if (highAxes.length || lowAxes.length) {
      context.styleSignals = { high: highAxes, low: lowAxes };
    }
  }

  const prompt = `You are a world-class fashion stylist analyzing a person's wardrobe data.
Here are their pre-computed style statistics:

${JSON.stringify(context, null, 1)}

Based on this data, return ONLY valid JSON with:
{
  "styleArchetype": "a creative 3-5 word title (e.g. 'The Urban Minimalist', 'The Bold Color Maven')",
  "styleMantra": "one punchy sentence capturing their fashion philosophy",
  "styleInsight": "2-3 sentences: describe their style identity specifically based on the data, then give one actionable personalized tip",
  "stylePersonality": "a short engaging paragraph (3-4 sentences) describing their fashion personality as if talking to them directly, referencing specific things from their wardrobe data",
  "capsuleEssentials": ["3 specific items that would fill gaps and elevate their wardrobe based on their data"],
  "seasonalColors": {"spring": ["3 hex codes"], "summer": ["3 hex codes"], "fall": ["3 hex codes"], "winter": ["3 hex codes"]}
}

Be specific and reference their actual data. Do NOT be generic.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a fashion analyst. Output only valid JSON. Be specific and personal, never generic.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.6,
      max_tokens: 600,
    }),
  });

  if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);

  const json = await response.json();
  const parsed = JSON.parse(json.choices?.[0]?.message?.content || '{}');

  // Track API cost
  try {
    const ApiUsage = require('../models/ApiUsage');
    const u = json.usage || {};
    await ApiUsage.create({
      service: 'openai', operation: 'style-dna', model: 'gpt-4o-mini',
      tokens: { prompt: u.prompt_tokens || 0, completion: u.completion_tokens || 0 },
      cost: ((u.prompt_tokens || 0) / 1_000_000 * 0.15) + ((u.completion_tokens || 0) / 1_000_000 * 0.60),
    });
  } catch (_) {}

  return {
    styleArchetype: parsed.styleArchetype || '',
    styleMantra: parsed.styleMantra || '',
    styleInsight: parsed.styleInsight || '',
    stylePersonality: parsed.stylePersonality || '',
    capsuleEssentials: Array.isArray(parsed.capsuleEssentials) ? parsed.capsuleEssentials.slice(0, 3) : [],
    colorPreferences: {
      ...baseDNA.colorPreferences,
      seasonalColors: parsed.seasonalColors || baseDNA.colorPreferences.seasonalColors,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FALLBACK INSIGHTS (no AI needed — rule-based)
// ═══════════════════════════════════════════════════════════════════════════════

function generateFallbackInsights(baseDNA, stats) {
  const style = baseDNA.primaryStyle;
  const topColor = stats.colorPalette[0] || 'neutral';

  // Archetype map
  const archetypes = {
    minimalist: 'The Clean-Cut Minimalist',
    casual: 'The Effortless Everyday',
    formal: 'The Polished Professional',
    elegant: 'The Refined Elegance',
    streetwear: 'The Street-Smart Trendsetter',
    bohemian: 'The Free-Spirit Creative',
    classic: 'The Timeless Classic',
    sporty: 'The Active Modernist',
    rugged: 'The Rugged Explorer',
  };

  const mantras = {
    minimalist: 'Less is more — every piece earns its place.',
    casual: 'Comfort meets confidence in every outfit.',
    formal: 'Dress for the role you want, not the one you have.',
    elegant: 'Grace in every detail, effortless in execution.',
    streetwear: 'Style is a language — speak it loud.',
    bohemian: 'Fashion is art you wear every day.',
    classic: 'Timeless choices never go out of style.',
    sporty: 'Performance and style, never a compromise.',
    rugged: 'Built tough, styled sharp.',
  };

  // Build specific insight from data
  const gapText = baseDNA.wardrobeBalance.gaps.length > 0
    ? `Consider adding more ${baseDNA.wardrobeBalance.gaps.join(' and ')} pieces to round out your wardrobe.`
    : 'Your wardrobe covers all the essentials nicely.';

  const neglectedText = stats.wearBehavior.neglectedCount > 3
    ? ` You have ${stats.wearBehavior.neglectedCount} unworn items — try styling them differently or pass them on.`
    : '';

  return {
    styleArchetype: archetypes[style] || `The ${style.charAt(0).toUpperCase() + style.slice(1)} Stylist`,
    styleMantra: mantras[style] || 'Your style, your rules.',
    styleInsight: `Your wardrobe leans ${style} with a strong preference for ${topColor} tones. ${gapText}${neglectedText}`,
    stylePersonality: `With ${stats.total} items in your wardrobe, you've built a ${style}-focused collection. Your top colors are ${stats.colorPalette.slice(0, 3).join(', ')}, and you gravitate toward ${stats.patternBreakdown[0]?.pattern || 'solid'} patterns. ${baseDNA.wardrobeBalance.strengths.length > 0 ? `Your ${baseDNA.wardrobeBalance.strengths.join(' and ')} game is strong.` : 'Keep building your collection!'}`,
    capsuleEssentials: generateCapsuleSuggestions(baseDNA, stats),
  };
}

function generateCapsuleSuggestions(baseDNA, stats) {
  const suggestions = [];
  const gaps = baseDNA.wardrobeBalance.gaps;

  // Suggest based on gaps
  const gapSuggestions = {
    top: 'A versatile neutral-tone button-down shirt',
    bottom: 'Well-fitted dark wash jeans or tailored trousers',
    dress: 'A classic wrap dress for multiple occasions',
    shoes: 'Clean white sneakers or minimal leather boots',
    outerwear: 'A structured blazer or quality jacket',
    accessory: 'A statement watch or minimal jewelry set',
  };

  gaps.forEach((g) => {
    if (gapSuggestions[g] && suggestions.length < 3) {
      suggestions.push(gapSuggestions[g]);
    }
  });

  // Fill remaining with style-specific suggestions
  const styleSpecific = {
    minimalist: ['A cashmere crew-neck sweater in oatmeal', 'Tailored wide-leg trousers', 'Structured leather tote'],
    casual: ['Premium cotton tee in a standout color', 'Versatile chino shorts', 'Canvas sneakers'],
    formal: ['Crisp white dress shirt', 'Silk pocket square set', 'Oxford leather shoes'],
    streetwear: ['Graphic oversized hoodie', 'Cargo pants in earth tone', 'Statement high-top sneakers'],
    bohemian: ['Flowy maxi skirt', 'Embroidered denim jacket', 'Layered pendant necklace'],
  };

  const extras = styleSpecific[baseDNA.primaryStyle] || styleSpecific['casual'];
  extras.forEach((e) => {
    if (suggestions.length < 3) suggestions.push(e);
  });

  return suggestions.slice(0, 3);
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

function clamp(val, fallback = 0.5) {
  if (typeof val !== 'number' || isNaN(val)) return fallback;
  return Math.max(0, Math.min(1, val));
}

function round2(val) {
  return Math.round(val * 100) / 100;
}

module.exports = router;

