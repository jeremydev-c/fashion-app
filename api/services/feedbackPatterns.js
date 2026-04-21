/**
 * feedbackPatterns.js — Mines LearningHistory for combination preferences.
 * Learns which color pairs, style pairs, and category structures the user
 * has loved or rejected, then scores outfits against those patterns.
 */

const LearningHistory = require('../models/LearningHistory');

async function mineFeedbackPatterns(userId) {
  const history = await LearningHistory.find({ userId }).sort({ timestamp: -1 }).limit(200).lean();
  if (!history.length) return { colorCombos: {}, styleCombos: {}, categoryCombos: {}, totalPositive: 0, totalNegative: 0 };

  const colorCombos = {};    // 'navy+white' -> { positive: 3, negative: 0 }
  const styleCombos = {};    // 'classic+minimalist' -> ...
  const categoryCombos = {}; // 'top+bottom+shoes' -> ...

  let totalPositive = 0;
  let totalNegative = 0;

  for (const entry of history) {
    const isPositive = entry.interactionType === 'save' || entry.interactionType === 'saved' ||
                       entry.interactionType === 'swipe_right' ||
                       ((entry.interactionType === 'rate' || entry.interactionType === 'rated') && entry.rating >= 4);
    const isNegative = entry.interactionType === 'reject' || entry.interactionType === 'rejected' ||
                       entry.interactionType === 'swipe_left' ||
                       ((entry.interactionType === 'rate' || entry.interactionType === 'rated') && entry.rating <= 2);
    if (!isPositive && !isNegative) continue;

    const signal = isPositive ? 'positive' : 'negative';
    if (isPositive) totalPositive++;
    else totalNegative++;

    const meta = entry.metadata || {};
    const colors = (meta.colors || []).map(c => c.toLowerCase()).filter(Boolean).sort();
    const styles = (meta.styles || []).map(s => s.toLowerCase()).filter(Boolean).sort();
    const categories = (meta.categories || []).map(c => c.toLowerCase()).filter(Boolean).sort();

    // Record color combinations (pairs)
    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        const key = `${colors[i]}+${colors[j]}`;
        if (!colorCombos[key]) colorCombos[key] = { positive: 0, negative: 0 };
        colorCombos[key][signal]++;
      }
    }

    // Record style combinations
    const uniqueStyles = [...new Set(styles)];
    for (let i = 0; i < uniqueStyles.length; i++) {
      for (let j = i + 1; j < uniqueStyles.length; j++) {
        const key = `${uniqueStyles[i]}+${uniqueStyles[j]}`;
        if (!styleCombos[key]) styleCombos[key] = { positive: 0, negative: 0 };
        styleCombos[key][signal]++;
      }
    }

    // Record category structure
    if (categories.length >= 2) {
      const key = categories.join('+');
      if (!categoryCombos[key]) categoryCombos[key] = { positive: 0, negative: 0 };
      categoryCombos[key][signal]++;
    }
  }

  return { colorCombos, styleCombos, categoryCombos, totalPositive, totalNegative };
}

function feedbackPatternScore(items, feedbackPatterns) {
  if (!feedbackPatterns || (feedbackPatterns.totalPositive + feedbackPatterns.totalNegative) < 3) return 0;

  let score = 0;
  const colors = items.map(i => (i.color || '').toLowerCase()).filter(Boolean).sort();
  const styles = [...new Set(items.map(i => (i.style || '').toLowerCase()).filter(Boolean))].sort();
  const categories = items.map(i => (i.category || '').toLowerCase()).filter(Boolean).sort();

  // Color combo scoring
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const key = `${colors[i]}+${colors[j]}`;
      const combo = feedbackPatterns.colorCombos[key];
      if (combo) {
        const net = combo.positive - combo.negative;
        score += net * 0.02;
      }
    }
  }

  // Style combo scoring
  for (let i = 0; i < styles.length; i++) {
    for (let j = i + 1; j < styles.length; j++) {
      const key = `${styles[i]}+${styles[j]}`;
      const combo = feedbackPatterns.styleCombos[key];
      if (combo) {
        const net = combo.positive - combo.negative;
        score += net * 0.025;
      }
    }
  }

  // Category structure scoring
  const catKey = categories.join('+');
  const catCombo = feedbackPatterns.categoryCombos[catKey];
  if (catCombo) {
    const net = catCombo.positive - catCombo.negative;
    score += net * 0.015;
  }

  return Math.max(-0.15, Math.min(0.15, score));
}

module.exports = { mineFeedbackPatterns, feedbackPatternScore };
