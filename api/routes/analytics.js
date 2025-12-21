const express = require('express');
const ClothingItem = require('../models/ClothingItem');
const Outfit = require('../models/Outfit');
const StyleDNA = require('../models/StyleDNA');
const UserPreferences = require('../models/UserPreferences');

const router = express.Router();

/**
 * GET /analytics/wardrobe?userId=123
 * Get comprehensive wardrobe analytics
 */
router.get('/wardrobe', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const wardrobe = await ClothingItem.find({ userId });
    const outfits = await Outfit.find({ userId });
    const styleDNA = await StyleDNA.findOne({ userId });

    // Total items
    const totalItems = wardrobe.length;

    // Category distribution
    const categoryCount = {};
    wardrobe.forEach(item => {
      const cat = item.category || 'other';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });

    // Color distribution
    const colorCount = {};
    wardrobe.forEach(item => {
      if (item.color) {
        const color = item.color.toLowerCase();
        colorCount[color] = (colorCount[color] || 0) + 1;
      }
    });

    // Style distribution
    const styleCount = {};
    wardrobe.forEach(item => {
      if (item.style) {
        const style = item.style.toLowerCase();
        styleCount[style] = (styleCount[style] || 0) + 1;
      }
    });

    // Items used in outfits
    const itemUsageCount = {};
    outfits.forEach(outfit => {
      outfit.items.forEach(outfitItem => {
        const itemId = outfitItem.itemId?.toString();
        if (itemId) {
          itemUsageCount[itemId] = (itemUsageCount[itemId] || 0) + 1;
        }
      });
    });

    // Most worn items
    const mostWorn = wardrobe
      .map(item => ({
        id: item._id.toString(),
        name: item.name,
        category: item.category,
        color: item.color,
        imageUrl: item.thumbnailUrl || item.mediumUrl || item.imageUrl,
        wearCount: itemUsageCount[item._id.toString()] || 0,
      }))
      .sort((a, b) => b.wearCount - a.wearCount)
      .slice(0, 5);

    // Unused items (never worn)
    const unusedItems = wardrobe
      .filter(item => !itemUsageCount[item._id.toString()])
      .map(item => ({
        id: item._id.toString(),
        name: item.name,
        category: item.category,
        color: item.color,
        imageUrl: item.thumbnailUrl || item.mediumUrl || item.imageUrl,
        daysSinceAdded: Math.floor((Date.now() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
      }))
      .sort((a, b) => b.daysSinceAdded - a.daysSinceAdded)
      .slice(0, 5);

    // Wardrobe utilization
    const usedItems = Object.keys(itemUsageCount).length;
    const utilizationRate = totalItems > 0 ? (usedItems / totalItems) * 100 : 0;

    // Average items per outfit
    const avgItemsPerOutfit = outfits.length > 0
      ? outfits.reduce((sum, outfit) => sum + outfit.items.length, 0) / outfits.length
      : 0;

    res.json({
      totalItems,
      categoryDistribution: categoryCount,
      colorDistribution: colorCount,
      styleDistribution: styleCount,
      mostWorn,
      unusedItems,
      utilizationRate: Math.round(utilizationRate),
      avgItemsPerOutfit: Math.round(avgItemsPerOutfit * 10) / 10,
      totalOutfits: outfits.length,
      usedItemsCount: usedItems,
    });
  } catch (err) {
    console.error('GET /analytics/wardrobe error', err);
    res.status(500).json({ error: 'Failed to get wardrobe analytics' });
  }
});

/**
 * GET /analytics/outfits?userId=123
 * Get outfit analytics
 */
router.get('/outfits', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const outfits = await Outfit.find({ userId }).sort({ createdAt: -1 });

    // Outfits by occasion
    const occasionCount = {};
    outfits.forEach(outfit => {
      const occ = outfit.occasion || 'casual';
      occasionCount[occ] = (occasionCount[occ] || 0) + 1;
    });

    // Most worn outfits
    const mostWornOutfits = outfits
      .map(outfit => ({
        id: outfit._id.toString(),
        name: outfit.name,
        occasion: outfit.occasion,
        wearCount: outfit.wearCount || 0,
        lastWorn: outfit.lastWorn,
        favorite: outfit.favorite || false,
        items: outfit.items.length,
      }))
      .sort((a, b) => b.wearCount - a.wearCount)
      .slice(0, 5);

    // Favorite outfits
    const favoriteOutfits = outfits.filter(outfit => outfit.favorite).length;

    // Outfits created over time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentOutfits = outfits.filter(outfit => 
      new Date(outfit.createdAt) >= thirtyDaysAgo
    ).length;

    // Average rating
    const ratedOutfits = outfits.filter(outfit => outfit.rating);
    const avgRating = ratedOutfits.length > 0
      ? ratedOutfits.reduce((sum, outfit) => sum + (outfit.rating || 0), 0) / ratedOutfits.length
      : 0;

    res.json({
      totalOutfits: outfits.length,
      occasionDistribution: occasionCount,
      mostWornOutfits,
      favoriteOutfits,
      recentOutfits,
      avgRating: Math.round(avgRating * 10) / 10,
    });
  } catch (err) {
    console.error('GET /analytics/outfits error', err);
    res.status(500).json({ error: 'Failed to get outfit analytics' });
  }
});

/**
 * GET /analytics/insights?userId=123
 * Get personalized insights and recommendations
 */
router.get('/insights', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const wardrobe = await ClothingItem.find({ userId });
    const outfits = await Outfit.find({ userId });
    const styleDNA = await StyleDNA.findOne({ userId });
    const preferences = await UserPreferences.findOne({ userId });

    const insights = [];

    // Item usage insights
    const itemUsageCount = {};
    outfits.forEach(outfit => {
      outfit.items.forEach(outfitItem => {
        const itemId = outfitItem.itemId?.toString();
        if (itemId) {
          itemUsageCount[itemId] = (itemUsageCount[itemId] || 0) + 1;
        }
      });
    });

    const unusedItems = wardrobe.filter(item => !itemUsageCount[item._id.toString()]);
    if (unusedItems.length > 0) {
      const oldestUnused = unusedItems
        .map(item => ({
          item,
          daysSinceAdded: Math.floor((Date.now() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
        }))
        .sort((a, b) => b.daysSinceAdded - a.daysSinceAdded)[0];

      if (oldestUnused.daysSinceAdded >= 30) {
        insights.push({
          type: 'unused_item',
          priority: 'high',
          title: 'Unused Item Alert',
          message: `You haven't worn "${oldestUnused.item.name}" in ${oldestUnused.daysSinceAdded} days. Consider creating an outfit with it!`,
          itemId: oldestUnused.item._id.toString(),
        });
      }
    }

    // Category balance insights
    const categoryCount = {};
    wardrobe.forEach(item => {
      const cat = item.category || 'other';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });

    const categories = Object.keys(categoryCount);
    if (categories.length > 0) {
      const maxCategory = categories.reduce((a, b) => 
        categoryCount[a] > categoryCount[b] ? a : b
      );
      const minCategory = categories.reduce((a, b) => 
        categoryCount[a] < categoryCount[b] ? a : b
      );

      if (categoryCount[maxCategory] > categoryCount[minCategory] * 3) {
        insights.push({
          type: 'category_imbalance',
          priority: 'medium',
          title: 'Wardrobe Balance',
          message: `You have many ${maxCategory} items but few ${minCategory} items. Consider diversifying your wardrobe!`,
        });
      }
    }

    // Style evolution insight
    if (styleDNA && styleDNA.styleEvolution && styleDNA.styleEvolution.length > 1) {
      const latest = styleDNA.styleEvolution[styleDNA.styleEvolution.length - 1];
      const previous = styleDNA.styleEvolution[styleDNA.styleEvolution.length - 2];
      
      if (latest.primaryStyle !== previous.primaryStyle) {
        insights.push({
          type: 'style_evolution',
          priority: 'low',
          title: 'Style Evolution',
          message: `Your style has evolved from ${previous.primaryStyle} to ${latest.primaryStyle}!`,
        });
      }
    }

    // Outfit success rate
    if (preferences && preferences.feedbackCount > 10) {
      const savedOutfits = outfits.length;
      const totalInteractions = preferences.feedbackCount;
      const successRate = (savedOutfits / totalInteractions) * 100;

      if (successRate > 70) {
        insights.push({
          type: 'high_success',
          priority: 'low',
          title: 'Great Style Match!',
          message: `You've saved ${Math.round(successRate)}% of recommendations. The AI is learning your style well!`,
        });
      } else if (successRate < 30) {
        insights.push({
          type: 'low_success',
          priority: 'medium',
          title: 'Refine Your Preferences',
          message: 'Try rating more outfits to help the AI learn your style better!',
        });
      }
    }

    // Color preference insight
    if (preferences && preferences.preferredColors && preferences.preferredColors.length > 0) {
      const topColor = preferences.preferredColors[0];
      insights.push({
        type: 'color_preference',
        priority: 'low',
        title: 'Color Preference',
        message: `Your favorite color is ${topColor}. The AI prioritizes this in recommendations!`,
      });
    }

    res.json({
      insights: insights.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }),
    });
  } catch (err) {
    console.error('GET /analytics/insights error', err);
    res.status(500).json({ error: 'Failed to get insights' });
  }
});

module.exports = router;

