const express = require('express');
const OutfitFeedback = require('../models/OutfitFeedback');
const UserPreferences = require('../models/UserPreferences');
const ClothingItem = require('../models/ClothingItem');
const User = require('../models/User');
const { recordInteraction } = require('../utils/continuousLearning');

const router = express.Router();

// POST /stylist/feedback
// Record user feedback on an outfit (save, reject, or rate)
router.post('/feedback', async (req, res) => {
  try {
    const { userId, outfitId, itemIds, occasion, timeOfDay, action, rating } = req.body;

    if (!userId || !outfitId || !action) {
      return res.status(400).json({ error: 'userId, outfitId, and action are required' });
    }

    if (action === 'rated' && (!rating || rating < 1 || rating > 5)) {
      return res.status(400).json({ error: 'rating must be 1-5 when action is "rated"' });
    }

    const feedback = await OutfitFeedback.create({
      userId,
      outfitId,
      itemIds: itemIds || [],
      occasion,
      timeOfDay,
      action,
      rating: action === 'rated' ? rating : undefined,
    });

    // Update user preferences based on this feedback
    if (itemIds && itemIds.length > 0) {
      await updateUserPreferences(userId, feedback, itemIds);
    }

    // Record for continuous learning (never stops learning!)
    await recordInteraction({
      userId,
      interactionType: feedback.action,
      recommendationId: outfitId,
      itemIds: itemIds || [],
      occasion,
      timeOfDay,
      rating: action === 'rated' ? rating : undefined,
    });

    res.json({ success: true, feedback });
  } catch (err) {
    console.error('POST /stylist/feedback error', err);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

// GET /stylist/preferences?userId=123
// Get learned user preferences
router.get('/preferences', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    let prefs = await UserPreferences.findOne({ userId });
    if (!prefs) {
      // Create default preferences if none exist
      prefs = await UserPreferences.create({
        userId,
        preferredColors: [],
        preferredStyles: [],
        avoidedColors: [],
        avoidedCombinations: [],
        preferredOccasions: [],
        feedbackCount: 0,
        onboardingCompleted: false,
      });
    }

    res.json({ preferences: prefs });
  } catch (err) {
    console.error('GET /stylist/preferences error', err);
    res.status(500).json({ error: 'Failed to load preferences' });
  }
});

// Map onboarding occasion names to recommendation engine names
const OCCASION_NAME_MAP = {
  workout: 'gym',
  travel: 'casual',
  lounge: 'casual',
};

function normalizeOccasions(occasions) {
  if (!occasions || !Array.isArray(occasions)) return [];
  return [...new Set(occasions.map(o => {
    const lower = o.toLowerCase();
    return OCCASION_NAME_MAP[lower] || lower;
  }))];
}

// POST /stylist/onboarding
// Save onboarding questionnaire data
router.post('/onboarding', async (req, res) => {
  try {
    const { userId, styles, colors, occasions, avoidColors, bodyType, ageRange } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    let prefs = await UserPreferences.findOne({ userId });
    if (!prefs) {
      prefs = new UserPreferences({ userId });
    }

    prefs.preferredStyles = (styles || []).map(s => s.toLowerCase());
    prefs.preferredColors = (colors || []).map(c => c.toLowerCase());
    prefs.preferredOccasions = normalizeOccasions(occasions);
    prefs.avoidedColors = (avoidColors || []).map(c => c.toLowerCase());
    prefs.bodyType = bodyType || '';
    prefs.ageRange = ageRange || '';
    prefs.onboardingCompleted = true;
    prefs.lastUpdated = new Date();

    await prefs.save();

    // Also set the flag on the User model for admin stats
    await User.findByIdAndUpdate(userId, { onboardingCompleted: true }).catch(() => {});

    res.json({ success: true, preferences: prefs });
  } catch (err) {
    console.error('POST /stylist/onboarding error', err);
    res.status(500).json({ error: 'Failed to save onboarding data' });
  }
});

// Helper: Update user preferences based on feedback
async function updateUserPreferences(userId, feedback, itemIds) {
  let prefs = await UserPreferences.findOne({ userId });
  if (!prefs) {
    prefs = await UserPreferences.create({
      userId,
      preferredColors: [],
      preferredStyles: [],
      avoidedColors: [],
      avoidedCombinations: [],
      preferredOccasions: [],
      feedbackCount: 0,
    });
  }

  const items = await ClothingItem.find({ _id: { $in: itemIds } });

  const isPositive = feedback.action === 'saved' || (feedback.action === 'rated' && feedback.rating >= 4);
  const isNegative = feedback.action === 'rejected' || (feedback.action === 'rated' && feedback.rating <= 2);

  if (isPositive) {
    items.forEach((item) => {
      // Learn preferred colors
      if (item.color && !prefs.preferredColors.includes(item.color.toLowerCase())) {
        prefs.preferredColors.push(item.color.toLowerCase());
      }
      // Learn preferred styles from the item's style field (primary signal)
      if (item.style && !prefs.preferredStyles.includes(item.style.toLowerCase())) {
        prefs.preferredStyles.push(item.style.toLowerCase());
      }
      // Also learn from tags as secondary signal
      if (item.tags && item.tags.length > 0) {
        item.tags.forEach((tag) => {
          if (!prefs.preferredStyles.includes(tag.toLowerCase())) {
            prefs.preferredStyles.push(tag.toLowerCase());
          }
        });
      }
    });
    if (feedback.occasion && !prefs.preferredOccasions.includes(feedback.occasion.toLowerCase())) {
      prefs.preferredOccasions.push(feedback.occasion.toLowerCase());
    }
  } else if (isNegative) {
    // Avoid color combinations from rejected outfits
    const colors = items.map((i) => i.color?.toLowerCase()).filter(Boolean);
    if (colors.length >= 2) {
      const combo = [...new Set(colors)].sort().join('+');
      if (!prefs.avoidedCombinations.includes(combo)) {
        prefs.avoidedCombinations.push(combo);
      }
    }
    // If strongly negative (rating 1-2), track avoided styles too
    if (feedback.action === 'rated' && feedback.rating <= 2) {
      const styles = items.map(i => i.style?.toLowerCase()).filter(Boolean);
      const uniqueStyles = [...new Set(styles)];
      uniqueStyles.forEach(s => {
        // Only mark as avoided if it appears in rejected outfits 3+ times
        // (tracked via avoidedCombinations with style: prefix)
        const key = `style:${s}`;
        const existingCount = prefs.avoidedCombinations.filter(c => c === key).length;
        if (existingCount < 3) {
          prefs.avoidedCombinations.push(key);
        }
      });
    }
  }

  // Keep lists manageable
  prefs.preferredColors = prefs.preferredColors.slice(0, 20);
  prefs.preferredStyles = prefs.preferredStyles.slice(0, 15);
  prefs.avoidedCombinations = prefs.avoidedCombinations.slice(0, 30);
  prefs.preferredOccasions = prefs.preferredOccasions.slice(0, 10);

  prefs.feedbackCount += 1;
  prefs.lastUpdated = new Date();
  await prefs.save();
}

module.exports = router;


