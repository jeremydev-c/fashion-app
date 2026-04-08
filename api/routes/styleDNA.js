const express = require('express');
const ClothingItem = require('../models/ClothingItem');
const StyleDNA = require('../models/StyleDNA');

const router = express.Router();

/**
 * Calculate or recalculate Style DNA for a user
 * GET /style-dna/:userId
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Fetch all user's wardrobe items
    const items = await ClothingItem.find({ userId });

    if (items.length === 0) {
      return res.status(404).json({ error: 'No wardrobe items found. Add items to calculate Style DNA.' });
    }

    // Calculate Style DNA
    const styleDNA = await calculateStyleDNA(userId, items);

    res.json({ styleDNA });
  } catch (err) {
    console.error('GET /style-dna/:userId error', err);
    res.status(500).json({ error: 'Failed to calculate Style DNA' });
  }
});

/**
 * POST /style-dna/:userId/recalculate
 * Force recalculation of Style DNA
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

/**
 * Calculate Style DNA from wardrobe items using AI
 */
async function calculateStyleDNA(userId, items, forceRecalculate = false) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('AI service not available');
  }

  // ── Smart cache: skip AI if calculated within 24 h and item count unchanged ──
  if (!forceRecalculate) {
    const existing = await StyleDNA.findOne({ userId }).lean();
    if (existing && existing.lastCalculated) {
      const ageHours = (Date.now() - new Date(existing.lastCalculated).getTime()) / 3_600_000;
      const itemDelta = Math.abs(items.length - (existing.itemCountAtCalculation || 0));
      if (ageHours < 24 && itemDelta < 3) return existing;
    }
  }

  // ── Compact wardrobe summary (fewer tokens) ──────────────────────────────────
  const summary = items.map((i) => ({
    cat: i.category,
    color: i.color || '',
    style: i.style || '',
    pattern: i.pattern || '',
    occasion: (i.occasion || []).join(','),
    brand: i.brand || '',
  }));

  const prompt = `Analyze this ${items.length}-item wardrobe and return a Style DNA JSON object.

WARDROBE:
${JSON.stringify(summary)}

Return ONLY valid JSON (no markdown) with exactly this structure:
{
  "primaryStyle": "one-word style (e.g. minimalist, streetwear, bohemian, classic, elegant)",
  "styleArchetype": "creative title like 'The Polished Minimalist' or 'The Bold Streetwear Icon'",
  "styleMantra": "one punchy sentence that captures their fashion philosophy",
  "styleInsight": "2 sentences: first describes their style identity, second gives a personalized tip",
  "secondaryStyles": ["up to 3 secondary styles"],
  "capsuleEssentials": ["3 specific items that would elevate their wardrobe"],
  "colorPreferences": {
    "dominantColors": [{"color": "#hexcode", "name": "color name", "percentage": number}],
    "colorPalette": ["up to 6 hex codes"],
    "seasonalColors": {"spring": ["hex"], "summer": ["hex"], "fall": ["hex"], "winter": ["hex"]}
  },
  "brandAffinity": [{"brand": "string", "count": number, "score": 0.0}],
  "uniquenessScore": 0.0,
  "styleConsistency": 0.0,
  "trendAlignment": 0.0
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are a fashion analyst. Output only valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 800,
      }),
    });

    if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);

    const json = await response.json();
    const parsed = JSON.parse(json.choices?.[0]?.message?.content || '{}');

    // Track cost (gpt-4o-mini: $0.15/1M input, $0.60/1M output)
    try {
      const ApiUsage = require('../models/ApiUsage');
      const u = json.usage || {};
      await ApiUsage.create({
        service: 'openai', operation: 'style-dna', model: 'gpt-4o-mini',
        tokens: { prompt: u.prompt_tokens || 0, completion: u.completion_tokens || 0 },
        cost: ((u.prompt_tokens || 0) / 1_000_000 * 0.15) + ((u.completion_tokens || 0) / 1_000_000 * 0.60),
      });
    } catch (_) {}

    // Count actual items per category
    const categoryDistribution = { top: 0, bottom: 0, dress: 0, shoes: 0, outerwear: 0, accessory: 0 };
    items.forEach((item) => { if (item.category in categoryDistribution) categoryDistribution[item.category]++; });

    const styleDNAContent = {
      userId,
      primaryStyle: parsed.primaryStyle || 'casual',
      styleArchetype: parsed.styleArchetype || '',
      styleMantra: parsed.styleMantra || '',
      styleInsight: parsed.styleInsight || '',
      capsuleEssentials: Array.isArray(parsed.capsuleEssentials) ? parsed.capsuleEssentials.slice(0, 3) : [],
      secondaryStyles: Array.isArray(parsed.secondaryStyles) ? parsed.secondaryStyles.slice(0, 3) : [],
      colorPreferences: {
        dominantColors: Array.isArray(parsed.colorPreferences?.dominantColors)
          ? parsed.colorPreferences.dominantColors.slice(0, 5)
          : [],
        colorPalette: Array.isArray(parsed.colorPreferences?.colorPalette)
          ? parsed.colorPreferences.colorPalette.slice(0, 6)
          : [],
        seasonalColors: parsed.colorPreferences?.seasonalColors || { spring: [], summer: [], fall: [], winter: [] },
      },
      brandAffinity: Array.isArray(parsed.brandAffinity) ? parsed.brandAffinity.slice(0, 8) : [],
      categoryDistribution,
      uniquenessScore: clamp(parsed.uniquenessScore, 0.5),
      styleConsistency: clamp(parsed.styleConsistency, 0.5),
      trendAlignment: clamp(parsed.trendAlignment, 0.5),
      itemCountAtCalculation: items.length,
      lastCalculated: new Date(),
    };

    return StyleDNA.findOneAndUpdate({ userId }, styleDNAContent, { upsert: true, new: true });
  } catch (error) {
    console.error('Style DNA AI error:', error.message);
    return calculateStyleDNABasic(userId, items);
  }
}

function clamp(val, fallback = 0.5) {
  return typeof val === 'number' ? Math.max(0, Math.min(1, val)) : fallback;
}

/**
 * Basic Style DNA calculation (fallback if AI fails)
 */
async function calculateStyleDNABasic(userId, items) {
  const categoryDistribution = {
    top: 0,
    bottom: 0,
    dress: 0,
    shoes: 0,
    outerwear: 0,
    accessory: 0,
  };

  const colorCounts = {};
  const brandCounts = {};

  items.forEach((item) => {
    if (categoryDistribution.hasOwnProperty(item.category)) {
      categoryDistribution[item.category]++;
    }
    if (item.color) {
      const color = item.color.toLowerCase();
      colorCounts[color] = (colorCounts[color] || 0) + 1;
    }
    if (item.brand) {
      const brand = item.brand.toLowerCase();
      brandCounts[brand] = (brandCounts[brand] || 0) + 1;
    }
  });

  const dominantColors = Object.entries(colorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([color, count]) => ({
      color,
      percentage: (count / items.length) * 100,
    }));

  const brandAffinity = Object.entries(brandCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([brand, count]) => ({
      brand: brand.charAt(0).toUpperCase() + brand.slice(1),
      count,
      score: Math.min(count / items.length, 1),
    }));

  const styleDNAContent = {
    userId,
    primaryStyle: 'casual',
    secondaryStyles: [],
    colorPreferences: {
      dominantColors,
      colorPalette: dominantColors.map((c) => c.color),
      seasonalColors: {
        spring: [],
        summer: [],
        fall: [],
        winter: [],
      },
    },
    brandAffinity,
    categoryDistribution,
    uniquenessScore: 0.5,
    styleConsistency: 0.5,
    trendAlignment: 0.5,
    itemCountAtCalculation: items.length,
    lastCalculated: new Date(),
  };

  const styleDNA = await StyleDNA.findOneAndUpdate(
    { userId },
    styleDNAContent,
    { upsert: true, new: true }
  );

  return styleDNA;
}

module.exports = router;

