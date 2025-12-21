const express = require('express');
const { recordInteraction, getLearningInsights, analyzeUserPatterns } = require('../utils/continuousLearning');

const router = express.Router();

/**
 * POST /learning/interaction
 * Record any user interaction for continuous learning
 * This is called for EVERY user action - views, swipes, saves, etc.
 */
router.post('/interaction', async (req, res) => {
  try {
    const {
      userId,
      interactionType,
      recommendationId,
      itemIds,
      occasion,
      timeOfDay,
      weather,
      rating,
      confidence,
      sessionId,
    } = req.body;

    if (!userId || !interactionType) {
      return res.status(400).json({ error: 'userId and interactionType are required' });
    }

    // Record the interaction (async, non-blocking)
    recordInteraction({
      userId,
      interactionType,
      recommendationId,
      itemIds: itemIds || [],
      occasion,
      timeOfDay,
      weather,
      rating,
      confidence,
      sessionId,
    }).catch(err => {
      console.error('Error recording interaction (non-blocking):', err);
    });

    // Return immediately - learning happens in background
    res.json({ success: true, message: 'Interaction recorded for learning' });
  } catch (err) {
    console.error('POST /learning/interaction error', err);
    res.status(500).json({ error: 'Failed to record interaction' });
  }
});

/**
 * GET /learning/insights?userId=123
 * Get learning insights and improvement metrics
 */
router.get('/insights', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const insights = await getLearningInsights(userId);
    const patterns = await analyzeUserPatterns(userId);

    res.json({
      insights,
      patterns,
    });
  } catch (err) {
    console.error('GET /learning/insights error', err);
    res.status(500).json({ error: 'Failed to get learning insights' });
  }
});

module.exports = router;

