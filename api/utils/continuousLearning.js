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
 * Continuous learning update - runs after every interaction.
 * Aggregates weighted preference signals into UserPreferences.
 */
async function updateContinuousLearning(userId) {
  try {
    const recentInteractions = await LearningHistory.find({ userId })
      .sort({ timestamp: -1 })
      .limit(200)
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

    const isPositive = i =>
      i.interactionType === 'swipe_right' ||
      i.interactionType === 'save' || i.interactionType === 'saved' ||
      ((i.interactionType === 'rate' || i.interactionType === 'rated') && i.rating >= 4);

    const isNegative = i =>
      i.interactionType === 'swipe_left' ||
      i.interactionType === 'reject' || i.interactionType === 'rejected' ||
      ((i.interactionType === 'rate' || i.interactionType === 'rated') && i.rating <= 2);

    const positiveSignals = recentInteractions.filter(isPositive);
    const negativeSignals = recentInteractions.filter(isNegative);

    // ── Weighted frequency counters (recency-weighted) ──
    const colorW = {};
    const styleW = {};
    const categoryW = {};
    const patternW = {};
    const occasionW = {};
    const timeW = {};
    const occasionPrefs = {};

    function addWeight(map, key, weight) {
      if (key) map[key] = (map[key] || 0) + weight;
    }

    // Rating gives extra signal strength (5-star = 1.5x, 4-star = 1.2x)
    function ratingMultiplier(signal) {
      if (signal.rating === 5) return 1.5;
      if (signal.rating === 4) return 1.2;
      return 1.0;
    }

    positiveSignals.forEach((signal, index) => {
      const recency = 1 / (1 + index * 0.1);
      const rMult = ratingMultiplier(signal);
      const w = recency * rMult;

      (signal.metadata?.colors || []).forEach(c => addWeight(colorW, c, w));
      (signal.metadata?.styles || []).forEach(s => addWeight(styleW, s, w));
      (signal.metadata?.categories || []).forEach(c => addWeight(categoryW, c, w));
      (signal.metadata?.patterns || []).forEach(p => addWeight(patternW, p, w));

      if (signal.occasion) {
        const occ = signal.occasion.toLowerCase();
        addWeight(occasionW, occ, w);

        if (!occasionPrefs[occ]) {
          occasionPrefs[occ] = { colors: {}, styles: {}, categories: {}, pos: 0, neg: 0 };
        }
        occasionPrefs[occ].pos += 1;
        (signal.metadata?.colors || []).forEach(c => addWeight(occasionPrefs[occ].colors, c, w));
        (signal.metadata?.styles || []).forEach(s => addWeight(occasionPrefs[occ].styles, s, w));
        (signal.metadata?.categories || []).forEach(c => addWeight(occasionPrefs[occ].categories, c, w));
      }

      if (signal.timeOfDay) addWeight(timeW, signal.timeOfDay.toLowerCase(), w);
    });

    // Negative signals reduce weights
    negativeSignals.forEach((signal, index) => {
      const recency = 1 / (1 + index * 0.1);
      const w = recency * 0.6;

      (signal.metadata?.colors || []).forEach(c => addWeight(colorW, c, -w));
      (signal.metadata?.styles || []).forEach(s => addWeight(styleW, s, -w));
      (signal.metadata?.categories || []).forEach(c => addWeight(categoryW, c, -w));
      (signal.metadata?.patterns || []).forEach(p => addWeight(patternW, p, -w));

      if (signal.metadata?.colors && signal.metadata.colors.length >= 2) {
        const combo = [...new Set(signal.metadata.colors)].sort().join('+');
        if (!prefs.avoidedCombinations.includes(combo)) {
          prefs.avoidedCombinations.push(combo);
        }
      }

      if (signal.occasion) {
        const occ = signal.occasion.toLowerCase();
        if (!occasionPrefs[occ]) {
          occasionPrefs[occ] = { colors: {}, styles: {}, categories: {}, pos: 0, neg: 0 };
        }
        occasionPrefs[occ].neg += 1;
      }
    });

    // ── Derive top-N lists from weighted scores ──
    function topKeys(map, n) {
      return Object.entries(map)
        .filter(([, v]) => v > 0)
        .sort(([, a], [, b]) => b - a)
        .slice(0, n)
        .map(([k]) => k);
    }

    // Merge learned with onboarding (onboarding values stay, learned ones get added)
    const onboardingColors = new Set((prefs.preferredColors || []).filter(Boolean));
    const learnedColors = topKeys(colorW, 12);
    prefs.preferredColors = [...new Set([...onboardingColors, ...learnedColors])].slice(0, 20);

    const onboardingStyles = new Set((prefs.preferredStyles || []).filter(Boolean));
    const learnedStyles = topKeys(styleW, 10);
    prefs.preferredStyles = [...new Set([...onboardingStyles, ...learnedStyles])].slice(0, 15);

    prefs.preferredCategories = topKeys(categoryW, 8);
    prefs.preferredPatterns = topKeys(patternW, 6);

    const onboardingOccasions = new Set((prefs.preferredOccasions || []).filter(Boolean));
    const learnedOccasions = topKeys(occasionW, 6);
    prefs.preferredOccasions = [...new Set([...onboardingOccasions, ...learnedOccasions])].slice(0, 10);

    // Avoided styles: styles that appear more in negative than positive
    const avoidedStyles = Object.entries(styleW)
      .filter(([, v]) => v < -0.3)
      .map(([k]) => k);
    prefs.avoidedStyles = avoidedStyles.slice(0, 10);

    // Save weighted maps for the recommendation engine
    prefs.colorWeights = colorW;
    prefs.styleWeights = styleW;
    prefs.categoryWeights = categoryW;
    prefs.patternWeights = patternW;
    prefs.occasionWeights = occasionW;
    prefs.timeWeights = timeW;

    // Save per-occasion preferences
    const occasionPrefsMap = {};
    for (const [occ, data] of Object.entries(occasionPrefs)) {
      occasionPrefsMap[occ] = {
        preferredColors: topKeys(data.colors, 5),
        preferredStyles: topKeys(data.styles, 4),
        preferredCategories: topKeys(data.categories, 4),
        positiveCount: data.pos,
        negativeCount: data.neg,
      };
    }
    prefs.occasionPreferences = occasionPrefsMap;

    prefs.avoidedCombinations = prefs.avoidedCombinations.slice(0, 30);
    prefs.feedbackCount = recentInteractions.length;
    prefs.lastUpdated = new Date();
    
    await prefs.save();
  } catch (error) {
    console.error('Error in continuous learning update:', error);
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

    const isPosSignal = i =>
      i.interactionType === 'swipe_right' ||
      i.interactionType === 'save' || i.interactionType === 'saved' ||
      ((i.interactionType === 'rate' || i.interactionType === 'rated') && i.rating >= 4);

    const positiveRate = interactions.filter(isPosSignal).length / interactions.length;

    const recent = interactions.slice(0, 50);
    const older = interactions.slice(50, 100);
    
    const recentPositiveRate = recent.filter(isPosSignal).length / (recent.length || 1);
    const olderPositiveRate = older.filter(isPosSignal).length / (older.length || 1);

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
      i => i.interactionType === 'swipe_right' ||
           i.interactionType === 'save' || i.interactionType === 'saved' ||
           ((i.interactionType === 'rate' || i.interactionType === 'rated') && i.rating >= 4)
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

