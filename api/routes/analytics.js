const express = require('express');
const ClothingItem = require('../models/ClothingItem');
const Outfit = require('../models/Outfit');
const { requireFeature } = require('../middleware/planLimits');

const router = express.Router();

// ─── GET /analytics/wardrobe ─────────────────────────────────────────────────
router.get('/wardrobe', requireFeature('analytics'), async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const wardrobe = await ClothingItem.find({ userId }).lean();
    const total = wardrobe.length;
    if (total === 0) return res.json({ total: 0, empty: true });

    // ── Category distribution ──────────────────────────────────────────────
    const categoryCount = {};
    wardrobe.forEach(item => {
      const cat = item.category || 'other';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });

    // ── Colour distribution — use colorPalette array (AI-generated) ────────
    const colorCount = {};
    wardrobe.forEach(item => {
      const palette = item.colorPalette?.length ? item.colorPalette : (item.color ? [item.color] : []);
      palette.forEach(c => {
        const key = c.toLowerCase().trim();
        colorCount[key] = (colorCount[key] || 0) + 1;
      });
    });

    // ── Occasion coverage — from item.occasion array ───────────────────────
    const occasionCount = {};
    wardrobe.forEach(item => {
      (item.occasion || []).forEach(occ => {
        occasionCount[occ] = (occasionCount[occ] || 0) + 1;
      });
    });

    // ── Pattern distribution ───────────────────────────────────────────────
    const patternCount = {};
    wardrobe.forEach(item => {
      if (item.pattern) {
        const p = item.pattern.toLowerCase().trim();
        patternCount[p] = (patternCount[p] || 0) + 1;
      }
    });

    // ── Style distribution ─────────────────────────────────────────────────
    const styleCount = {};
    wardrobe.forEach(item => {
      if (item.style) {
        const s = item.style.toLowerCase().trim();
        styleCount[s] = (styleCount[s] || 0) + 1;
      }
    });

    // ── Wear data — use item.wearCount directly ────────────────────────────
    const wornItems = wardrobe.filter(item => (item.wearCount || 0) > 0);
    const neverWorn = wardrobe.filter(item => !item.wearCount || item.wearCount === 0);
    const utilizationRate = total > 0 ? Math.round((wornItems.length / total) * 100) : 0;

    const mostWorn = wardrobe
      .map(item => ({
        id: item._id.toString(),
        name: item.name,
        category: item.category,
        color: item.color,
        imageUrl: item.thumbnailUrl || item.mediumUrl || item.imageUrl,
        wearCount: item.wearCount || 0,
        lastWorn: item.lastWorn || null,
      }))
      .sort((a, b) => b.wearCount - a.wearCount)
      .slice(0, 5);

    const leastWorn = [...wardrobe]
      .sort((a, b) => (a.wearCount || 0) - (b.wearCount || 0))
      .slice(0, 5)
      .map(item => ({
        id: item._id.toString(),
        name: item.name,
        category: item.category,
        imageUrl: item.thumbnailUrl || item.mediumUrl || item.imageUrl,
        wearCount: item.wearCount || 0,
        daysSinceAdded: Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 86400000),
      }));

    // ── Favourites ─────────────────────────────────────────────────────────
    const favouriteCount = wardrobe.filter(item => item.favorite).length;

    // ── AI confidence ──────────────────────────────────────────────────────
    const processedItems = wardrobe.filter(item => item.aiProcessed && item.aiConfidence != null);
    const avgAiConfidence = processedItems.length > 0
      ? Math.round((processedItems.reduce((s, i) => s + i.aiConfidence, 0) / processedItems.length) * 100)
      : null;

    // ── Semantic axes averages (formality, boldness, warmth, etc.) ─────────
    const axisKeys = ['formality', 'structure', 'texture', 'boldness', 'softness', 'warmth', 'polish', 'ruggedness', 'minimalism', 'versatility'];
    const axisItems = wardrobe.filter(item => item.semanticProfile?.axes);
    let semanticAxes = null;
    if (axisItems.length > 0) {
      semanticAxes = {};
      axisKeys.forEach(key => {
        const values = axisItems
          .map(item => item.semanticProfile.axes[key])
          .filter(v => v != null);
        semanticAxes[key] = values.length > 0
          ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100)
          : null;
      });
    }

    // ── Aesthetic tags (top 5) ─────────────────────────────────────────────
    const aestheticCount = {};
    wardrobe.forEach(item => {
      (item.semanticProfile?.aesthetics || []).forEach(a => {
        aestheticCount[a] = (aestheticCount[a] || 0) + 1;
      });
    });
    const topAesthetics = Object.entries(aestheticCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, count]) => ({ label, count }));

    res.json({
      total,
      utilizationRate,
      wornItemsCount: wornItems.length,
      neverWornCount: neverWorn.length,
      favouriteCount,
      avgAiConfidence,
      categoryDistribution: categoryCount,
      colorDistribution: colorCount,
      occasionCoverage: occasionCount,
      patternDistribution: patternCount,
      styleDistribution: styleCount,
      mostWorn,
      leastWorn,
      semanticAxes,
      topAesthetics,
    });
  } catch (err) {
    console.error('GET /analytics/wardrobe error', err);
    res.status(500).json({ error: 'Failed to get wardrobe analytics' });
  }
});

// ─── GET /analytics/outfits ──────────────────────────────────────────────────
router.get('/outfits', requireFeature('analytics'), async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const outfits = await Outfit.find({ userId }).sort({ createdAt: -1 }).lean();
    const total = outfits.length;

    // ── Occasion distribution ──────────────────────────────────────────────
    const occasionCount = {};
    outfits.forEach(o => {
      const occ = o.occasion || 'unspecified';
      occasionCount[occ] = (occasionCount[occ] || 0) + 1;
    });

    // ── Season distribution ────────────────────────────────────────────────
    const seasonCount = {};
    outfits.forEach(o => {
      if (o.season) seasonCount[o.season] = (seasonCount[o.season] || 0) + 1;
    });

    // ── Weather distribution ───────────────────────────────────────────────
    const weatherCount = {};
    outfits.forEach(o => {
      if (o.weather) weatherCount[o.weather] = (weatherCount[o.weather] || 0) + 1;
    });

    // ── Most worn — use outfit.wearCount directly ──────────────────────────
    const mostWorn = [...outfits]
      .sort((a, b) => (b.wearCount || 0) - (a.wearCount || 0))
      .slice(0, 5)
      .map(o => ({
        id: o._id.toString(),
        name: o.name,
        occasion: o.occasion,
        season: o.season,
        wearCount: o.wearCount || 0,
        lastWorn: o.lastWorn || null,
        favorite: o.favorite || false,
        rating: o.rating || 0,
        itemCount: o.items.length,
      }));

    // ── Average rating ─────────────────────────────────────────────────────
    const ratedOutfits = outfits.filter(o => o.rating > 0);
    const avgRating = ratedOutfits.length > 0
      ? Math.round((ratedOutfits.reduce((s, o) => s + o.rating, 0) / ratedOutfits.length) * 10) / 10
      : 0;

    // ── AI analysis averages ───────────────────────────────────────────────
    const scoredOutfits = outfits.filter(o => o.aiAnalysis?.styleScore != null);
    let avgAiAnalysis = null;
    if (scoredOutfits.length > 0) {
      const avg = key => Math.round(
        (scoredOutfits.reduce((s, o) => s + (o.aiAnalysis[key] || 0), 0) / scoredOutfits.length) * 100
      );
      avgAiAnalysis = {
        styleScore: avg('styleScore'),
        colorHarmony: avg('colorHarmony'),
        compatibilityScore: avg('compatibilityScore'),
      };
    }

    // ── Activity over last 30 days ─────────────────────────────────────────
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const recentOutfits = outfits.filter(o => new Date(o.createdAt) >= thirtyDaysAgo).length;

    // ── Favourite count ────────────────────────────────────────────────────
    const favouriteCount = outfits.filter(o => o.favorite).length;

    // ── Average items per outfit ───────────────────────────────────────────
    const avgItemsPerOutfit = total > 0
      ? Math.round((outfits.reduce((s, o) => s + o.items.length, 0) / total) * 10) / 10
      : 0;

    res.json({
      total,
      favouriteCount,
      recentOutfits,
      avgRating,
      avgItemsPerOutfit,
      occasionDistribution: occasionCount,
      seasonDistribution: seasonCount,
      weatherDistribution: weatherCount,
      mostWorn,
      avgAiAnalysis,
    });
  } catch (err) {
    console.error('GET /analytics/outfits error', err);
    res.status(500).json({ error: 'Failed to get outfit analytics' });
  }
});

// ─── GET /analytics/insights ─────────────────────────────────────────────────
router.get('/insights', requireFeature('analytics'), async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const [wardrobe, outfits] = await Promise.all([
      ClothingItem.find({ userId }).lean(),
      Outfit.find({ userId }).lean(),
    ]);

    const insights = [];
    const total = wardrobe.length;
    if (total === 0) return res.json({ insights: [] });

    // ── 1. Items never worn (wearCount = 0, added >30 days ago) ───────────
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const neglectedItems = wardrobe.filter(item =>
      (!item.wearCount || item.wearCount === 0) &&
      new Date(item.createdAt) <= thirtyDaysAgo
    );
    if (neglectedItems.length > 0) {
      const oldest = neglectedItems.sort((a, b) =>
        new Date(a.createdAt) - new Date(b.createdAt)
      )[0];
      const days = Math.floor((Date.now() - new Date(oldest.createdAt).getTime()) / 86400000);
      insights.push({
        type: 'neglected_items',
        priority: 'high',
        title: `${neglectedItems.length} item${neglectedItems.length > 1 ? 's' : ''} never worn`,
        message: `"${oldest.name}" has been in your wardrobe for ${days} days and never worn. Try styling it in your next outfit.`,
        itemId: oldest._id.toString(),
      });
    }

    // ── 2. Wardrobe hero — most worn item ──────────────────────────────────
    const heroItem = wardrobe
      .filter(item => (item.wearCount || 0) > 0)
      .sort((a, b) => (b.wearCount || 0) - (a.wearCount || 0))[0];
    if (heroItem) {
      insights.push({
        type: 'hero_item',
        priority: 'low',
        title: 'Your wardrobe hero',
        message: `"${heroItem.name}" is your most-worn item at ${heroItem.wearCount} wears. It clearly fits your life well.`,
        itemId: heroItem._id.toString(),
      });
    }

    // ── 3. Category imbalance ──────────────────────────────────────────────
    const categoryCount = {};
    wardrobe.forEach(item => {
      const cat = item.category || 'other';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });
    const cats = Object.entries(categoryCount).sort((a, b) => b[1] - a[1]);
    if (cats.length >= 2) {
      const [topCat, topN] = cats[0];
      const [bottomCat, bottomN] = cats[cats.length - 1];
      if (topN >= bottomN * 4) {
        insights.push({
          type: 'category_imbalance',
          priority: 'medium',
          title: 'Wardrobe imbalance',
          message: `You have ${topN} ${topCat} items but only ${bottomN} ${bottomCat} items. A few ${bottomCat} pieces could open up many more outfit combinations.`,
        });
      }
    }

    // ── 4. Occasion gaps ───────────────────────────────────────────────────
    const allOccasions = new Set();
    wardrobe.forEach(item => (item.occasion || []).forEach(o => allOccasions.add(o)));
    const expectedOccasions = ['casual', 'work', 'formal', 'sports'];
    const missingOccasions = expectedOccasions.filter(o => !allOccasions.has(o));
    if (missingOccasions.length > 0) {
      insights.push({
        type: 'occasion_gap',
        priority: 'medium',
        title: `Gap: no ${missingOccasions[0]} items`,
        message: `Your wardrobe has no items tagged for ${missingOccasions.join(' or ')}. This limits what occasions you can dress for.`,
      });
    }

    // ── 5. Low utilisation ─────────────────────────────────────────────────
    const wornCount = wardrobe.filter(item => (item.wearCount || 0) > 0).length;
    const utilRate = total > 0 ? Math.round((wornCount / total) * 100) : 0;
    if (utilRate < 50 && total >= 10) {
      insights.push({
        type: 'low_utilisation',
        priority: 'high',
        title: `Only ${utilRate}% of your wardrobe is being worn`,
        message: `${total - wornCount} of your ${total} items have never been worn. Use the Stylist to get outfit ideas that use your neglected pieces.`,
      });
    }

    // ── 6. Highly rated outfit style pattern ──────────────────────────────
    const topRated = outfits.filter(o => (o.rating || 0) >= 4);
    if (topRated.length >= 3) {
      const occasionFreq = {};
      topRated.forEach(o => {
        if (o.occasion) occasionFreq[o.occasion] = (occasionFreq[o.occasion] || 0) + 1;
      });
      const bestOccasion = Object.entries(occasionFreq).sort((a, b) => b[1] - a[1])[0];
      if (bestOccasion) {
        insights.push({
          type: 'style_strength',
          priority: 'low',
          title: 'You dress best for ' + bestOccasion[0],
          message: `${bestOccasion[1]} of your top-rated outfits are for ${bestOccasion[0]} occasions. This is where your style really shines.`,
        });
      }
    }

    // ── 7. Low AI confidence items (need re-categorising) ─────────────────
    const lowConfidence = wardrobe.filter(item =>
      item.aiProcessed && item.aiConfidence != null && item.aiConfidence < 0.5
    );
    if (lowConfidence.length > 0) {
      insights.push({
        type: 'low_confidence',
        priority: 'medium',
        title: `${lowConfidence.length} item${lowConfidence.length > 1 ? 's' : ''} need better photos`,
        message: `The AI had low confidence categorising ${lowConfidence.length} item${lowConfidence.length > 1 ? 's' : ''}. Re-uploading with clearer photos will improve your recommendations.`,
      });
    }

    // ── 8. Dominant semantic axis ──────────────────────────────────────────
    const axisItems = wardrobe.filter(item => item.semanticProfile?.axes);
    if (axisItems.length >= 5) {
      const axisKeys = ['formality', 'boldness', 'minimalism', 'softness', 'ruggedness'];
      const axisAvg = {};
      axisKeys.forEach(key => {
        const vals = axisItems.map(i => i.semanticProfile.axes[key]).filter(v => v != null);
        axisAvg[key] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      });
      const dominantAxis = Object.entries(axisAvg).sort((a, b) => b[1] - a[1])[0];
      if (dominantAxis && dominantAxis[1] > 0.6) {
        const axisLabels = {
          formality: 'polished and formal',
          boldness: 'bold and expressive',
          minimalism: 'clean and minimal',
          softness: 'soft and relaxed',
          ruggedness: 'rugged and casual',
        };
        insights.push({
          type: 'style_identity',
          priority: 'low',
          title: 'Your wardrobe is ' + axisLabels[dominantAxis[0]],
          message: `Across all your items, your wardrobe scores highest on ${dominantAxis[0]} (${Math.round(dominantAxis[1] * 100)}%). This is the core of your personal style.`,
        });
      }
    }

    const priorityOrder = { high: 3, medium: 2, low: 1 };
    res.json({
      insights: insights.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]),
    });
  } catch (err) {
    console.error('GET /analytics/insights error', err);
    res.status(500).json({ error: 'Failed to get insights' });
  }
});

module.exports = router;
