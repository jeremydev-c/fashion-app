const express = require('express');
const ClothingItem = require('../models/ClothingItem');
const StyleDNA = require('../models/StyleDNA');
const UserPreferences = require('../models/UserPreferences');
const Outfit = require('../models/Outfit');
const LearningHistory = require('../models/LearningHistory');

const { generateHybridRecommendations, __testables } = require('../services/recommendationEngine');
const { clamp, normalizeOccasion, normalizeTimeOfDay, normalizeWeatherBand, buildRequestSeed, normalizeSeedPart, getWardrobeProfile } = __testables;

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
    const { userId, occasion, timeOfDay, weather, limit, variant, needsLayers, hasRainRisk, tempSwing, temperature, condition, humidity, windSpeed } = req.query;
    const recommendationLimit = Math.max(1, Math.min(6, parseInt(limit, 10) || 3));

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
    
    // Get normalization explicitly from testables
    const occasionResolved = __testables.normalizeOccasion ? __testables.normalizeOccasion(occasion) : (occasion || 'casual');
    const timeResolved = __testables.normalizeTimeOfDay ? __testables.normalizeTimeOfDay(timeOfDay) : (timeOfDay || 'afternoon');
    const weatherResolved = __testables.normalizeWeatherBand ? __testables.normalizeWeatherBand(weather, parsedTemp) : (weather || 'warm');
    const requestVariant = String(variant || 'base').toLowerCase().trim();

    // Rebuild wardrobe Profile internally since it's exposed on testables
    // This is safe since we just use it for pure data
    const wardrobeProfile = __testables.getWardrobeProfile ? __testables.getWardrobeProfile(wardrobe) : {};

    // Generate Request Seed
    const dayKey = new Date().toISOString().slice(0, 10);
    const wKey = [
      forecast.needsLayers ? 'layer' : 'nolayer',
      forecast.hasRainRisk ? 'rain' : 'dry',
      Math.round(Number(forecast.tempSwing) || 0)
    ].join(':');
    const requestSeed = `${userId}:${dayKey}:${occasionResolved}:${timeResolved}:${wKey}`;

    const ctx = {
      wardrobe,
      wardrobeProfile,
      wardrobeById: new Map(wardrobe.map(item => [(item._id || item.id || '').toString(), item])),
      semanticProfileMap: new Map(), // Filled by engine
      styleDNA,
      preferences,
      savedOutfits: savedOutfits || [],
      recentFeedback: recentFeedback || [],
      rejectedItemIds,
      likedItemIds,
      occasion: occasionResolved,
      timeOfDay: timeResolved,
      weather: weatherResolved,
      weatherDetail,
      limit: recommendationLimit,
      requestVariant,
      requestSeed,
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

router.__testables = __testables;

module.exports = router;
