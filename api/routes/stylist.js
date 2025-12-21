const express = require('express');
const OutfitFeedback = require('../models/OutfitFeedback');
const UserPreferences = require('../models/UserPreferences');
const ClothingItem = require('../models/ClothingItem');
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
    await updateUserPreferences(userId, feedback, itemIds);

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

    // Set preferences from onboarding
    prefs.preferredStyles = styles || [];
    prefs.preferredColors = colors || [];
    prefs.preferredOccasions = occasions || [];
    prefs.avoidedColors = avoidColors || [];
    prefs.bodyType = bodyType || '';
    prefs.ageRange = ageRange || '';
    prefs.onboardingCompleted = true;
    prefs.lastUpdated = new Date();

    await prefs.save();

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
      avoidedCombinations: [],
      preferredOccasions: [],
      feedbackCount: 0,
    });
  }

  // Get the actual clothing items to analyze
  const items = await ClothingItem.find({ _id: { $in: itemIds } });

  if (feedback.action === 'saved' || (feedback.action === 'rated' && feedback.rating >= 4)) {
    // Positive feedback: learn what they like
    items.forEach((item) => {
      if (item.color && !prefs.preferredColors.includes(item.color.toLowerCase())) {
        prefs.preferredColors.push(item.color.toLowerCase());
      }
      if (item.tags && item.tags.length > 0) {
        item.tags.forEach((tag) => {
          if (!prefs.preferredStyles.includes(tag.toLowerCase())) {
            prefs.preferredStyles.push(tag.toLowerCase());
          }
        });
      }
    });
    if (feedback.occasion && !prefs.preferredOccasions.includes(feedback.occasion)) {
      prefs.preferredOccasions.push(feedback.occasion);
    }
  } else if (feedback.action === 'rejected' || (feedback.action === 'rated' && feedback.rating <= 2)) {
    // Negative feedback: learn what to avoid
    const colors = items.map((i) => i.color?.toLowerCase()).filter(Boolean);
    if (colors.length >= 2) {
      const combo = colors.sort().join('+');
      if (!prefs.avoidedCombinations.includes(combo)) {
        prefs.avoidedCombinations.push(combo);
      }
    }
  }

  prefs.feedbackCount += 1;
  prefs.lastUpdated = new Date();
  await prefs.save();
}

module.exports = router;


