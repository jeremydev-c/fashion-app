/**
 * Continuous Learning Engine
 * Never stops learning from every user interaction
 */

const LearningHistory = require('../models/LearningHistory');
const UserPreferences = require('../models/UserPreferences');
const ClothingItem = require('../models/ClothingItem');

/**
 * Record any user interaction for learning
 */
async function recordInteraction({
  userId,
  interactionType,
  recommendationId,
  itemIds = [],
  occasion,
  timeOfDay,
  weather,
  rating,
  confidence,
  sessionId,
}) {
  try {
    // Get item metadata if available
    let metadata = {};
    if (itemIds.length > 0) {
      const items = await ClothingItem.find({ _id: { $in: itemIds } });
      metadata = {
        colors: items.map(i => i.color?.toLowerCase()).filter(Boolean),
        styles: items.map(i => i.style?.toLowerCase()).filter(Boolean),
        categories: items.map(i => i.category?.toLowerCase()).filter(Boolean),
        patterns: items.map(i => i.pattern?.toLowerCase()).filter(Boolean),
      };
    }

    await LearningHistory.create({
      userId,
      interactionType,
      recommendationId,
      itemIds,
      occasion,
      timeOfDay,
      weather,
      rating,
      confidence,
      sessionId: sessionId || `session_${Date.now()}`,
      metadata,
    });

    // Trigger continuous learning update
    await updateContinuousLearning(userId);
  } catch (error) {
    console.error('Error recording interaction:', error);
    // Don't throw - learning should never break the app
  }
}

/**
 * Continuous learning update - runs after every interaction
 */
async function updateContinuousLearning(userId) {
  try {
    // Get recent interactions (last 100)
    const recentInteractions = await LearningHistory.find({ userId })
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();

    if (recentInteractions.length === 0) return;

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

    // Analyze patterns from recent interactions
    const positiveSignals = recentInteractions.filter(
      i => i.interactionType === 'swipe_right' || 
           i.interactionType === 'save' || 
           (i.interactionType === 'rate' && i.rating >= 4)
    );

    const negativeSignals = recentInteractions.filter(
      i => i.interactionType === 'swipe_left' || 
           i.interactionType === 'reject' || 
           (i.interactionType === 'rate' && i.rating <= 2)
    );

    // Learn from positive signals (weighted by recency)
    const colorFrequency = {};
    const styleFrequency = {};
    const occasionFrequency = {};
    const categoryFrequency = {};

    positiveSignals.forEach((signal, index) => {
      const recencyWeight = 1 / (index + 1); // More recent = higher weight
      
      if (signal.metadata?.colors) {
        signal.metadata.colors.forEach(color => {
          colorFrequency[color] = (colorFrequency[color] || 0) + recencyWeight;
        });
      }
      
      if (signal.metadata?.styles) {
        signal.metadata.styles.forEach(style => {
          styleFrequency[style] = (styleFrequency[style] || 0) + recencyWeight;
        });
      }
      
      if (signal.occasion) {
        occasionFrequency[signal.occasion] = (occasionFrequency[signal.occasion] || 0) + recencyWeight;
      }
      
      if (signal.metadata?.categories) {
        signal.metadata.categories.forEach(cat => {
          categoryFrequency[cat] = (categoryFrequency[cat] || 0) + recencyWeight;
        });
      }
    });

    // Update preferred colors (top 10 most frequent)
    const topColors = Object.entries(colorFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([color]) => color);
    
    // Merge with existing, keeping top preferences
    const allColors = [...new Set([...prefs.preferredColors, ...topColors])];
    prefs.preferredColors = allColors.slice(0, 15); // Keep top 15

    // Update preferred styles
    const topStyles = Object.entries(styleFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([style]) => style);
    
    const allStyles = [...new Set([...prefs.preferredStyles, ...topStyles])];
    prefs.preferredStyles = allStyles.slice(0, 12);

    // Update preferred occasions
    const topOccasions = Object.entries(occasionFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([occasion]) => occasion);
    
    const allOccasions = [...new Set([...prefs.preferredOccasions, ...topOccasions])];
    prefs.preferredOccasions = allOccasions.slice(0, 8);

    // Learn from negative signals - avoid these combinations
    negativeSignals.forEach(signal => {
      if (signal.metadata?.colors && signal.metadata.colors.length >= 2) {
        const combo = signal.metadata.colors.sort().join('+');
        if (!prefs.avoidedCombinations.includes(combo)) {
          prefs.avoidedCombinations.push(combo);
        }
      }
    });

    // Keep avoided combinations list manageable (top 20)
    prefs.avoidedCombinations = prefs.avoidedCombinations.slice(0, 20);

    // Update feedback count
    prefs.feedbackCount = recentInteractions.length;
    prefs.lastUpdated = new Date();
    
    await prefs.save();
  } catch (error) {
    console.error('Error in continuous learning update:', error);
    // Don't throw - learning should be resilient
  }
}

/**
 * Get learning insights for a user
 */
async function getLearningInsights(userId) {
  try {
    const interactions = await LearningHistory.find({ userId })
      .sort({ timestamp: -1 })
      .limit(500)
      .lean();

    if (interactions.length === 0) {
      return {
        totalInteractions: 0,
        learningRate: 0,
        improvementTrend: 'stable',
        confidence: 0,
      };
    }

    // Calculate learning metrics
    const positiveRate = interactions.filter(
      i => i.interactionType === 'swipe_right' || i.interactionType === 'save'
    ).length / interactions.length;

    // Recent vs older performance (last 50 vs previous 50)
    const recent = interactions.slice(0, 50);
    const older = interactions.slice(50, 100);
    
    const recentPositiveRate = recent.filter(
      i => i.interactionType === 'swipe_right' || i.interactionType === 'save'
    ).length / (recent.length || 1);
    
    const olderPositiveRate = older.filter(
      i => i.interactionType === 'swipe_right' || i.interactionType === 'save'
    ).length / (older.length || 1);

    const improvement = recentPositiveRate - olderPositiveRate;
    
    let improvementTrend = 'stable';
    if (improvement > 0.1) improvementTrend = 'improving';
    else if (improvement < -0.1) improvementTrend = 'declining';

    // Calculate confidence based on data volume
    const confidence = Math.min(interactions.length / 100, 1) * 100;

    return {
      totalInteractions: interactions.length,
      learningRate: Math.round(positiveRate * 100),
      improvementTrend,
      confidence: Math.round(confidence),
      recentPositiveRate: Math.round(recentPositiveRate * 100),
      olderPositiveRate: Math.round(olderPositiveRate * 100),
    };
  } catch (error) {
    console.error('Error getting learning insights:', error);
    return {
      totalInteractions: 0,
      learningRate: 0,
      improvementTrend: 'stable',
      confidence: 0,
    };
  }
}

/**
 * Analyze what works best for this user
 */
async function analyzeUserPatterns(userId) {
  try {
    const interactions = await LearningHistory.find({ userId })
      .sort({ timestamp: -1 })
      .limit(200)
      .lean();

    const patterns = {
      bestOccasions: {},
      bestTimeOfDay: {},
      bestWeather: {},
      bestColorCombos: {},
      bestStyleCombos: {},
    };

    const positiveInteractions = interactions.filter(
      i => i.interactionType === 'swipe_right' || i.interactionType === 'save'
    );

    positiveInteractions.forEach(interaction => {
      if (interaction.occasion) {
        patterns.bestOccasions[interaction.occasion] = 
          (patterns.bestOccasions[interaction.occasion] || 0) + 1;
      }
      if (interaction.timeOfDay) {
        patterns.bestTimeOfDay[interaction.timeOfDay] = 
          (patterns.bestTimeOfDay[interaction.timeOfDay] || 0) + 1;
      }
      if (interaction.weather) {
        patterns.bestWeather[interaction.weather] = 
          (patterns.bestWeather[interaction.weather] || 0) + 1;
      }
      if (interaction.metadata?.colors && interaction.metadata.colors.length >= 2) {
        const combo = interaction.metadata.colors.sort().join('+');
        patterns.bestColorCombos[combo] = 
          (patterns.bestColorCombos[combo] || 0) + 1;
      }
    });

    return patterns;
  } catch (error) {
    console.error('Error analyzing user patterns:', error);
    return {};
  }
}

module.exports = {
  recordInteraction,
  updateContinuousLearning,
  getLearningInsights,
  analyzeUserPatterns,
};

