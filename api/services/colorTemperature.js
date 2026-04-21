/**
 * colorTemperature.js — Detects user's warm/cool/neutral tendency from
 * wardrobe composition and preferences, then scores outfits for alignment.
 */

const { getColorTemp } = require('../utils/fashionIntelligence');

function detectUserColorTemperature(wardrobe, preferences) {
  let warm = 0, cool = 0, neutral = 0;

  wardrobe.forEach(item => {
    const temp = getColorTemp(item.color);
    if (temp === 'warm') warm++;
    else if (temp === 'cool') cool++;
    else neutral++;
  });

  // Factor in stated preferences
  if (preferences?.preferredColors) {
    for (const c of preferences.preferredColors) {
      const temp = getColorTemp(c);
      if (temp === 'warm') warm += 2;
      else if (temp === 'cool') cool += 2;
    }
  }

  const total = warm + cool + neutral;
  if (total === 0) return { tendency: 'neutral', warmRatio: 0.5, coolRatio: 0.5 };

  const warmRatio = warm / total;
  const coolRatio = cool / total;

  let tendency = 'neutral';
  if (warmRatio > 0.5) tendency = 'warm';
  else if (coolRatio > 0.5) tendency = 'cool';

  return { tendency, warmRatio, coolRatio };
}

function userColorTempScore(items, userColorTemp) {
  if (!userColorTemp || userColorTemp.tendency === 'neutral') return 0;

  const itemTemps = items.map(i => getColorTemp(i.color)).filter(t => t !== 'neutral');
  if (itemTemps.length === 0) return 0;

  const matchCount = itemTemps.filter(t => t === userColorTemp.tendency).length;
  const matchRatio = matchCount / itemTemps.length;

  // Reward outfits that lean into the user's natural temperature
  if (matchRatio >= 0.8) return 0.06;
  if (matchRatio >= 0.6) return 0.03;
  if (matchRatio <= 0.2) return -0.03;
  return 0;
}

module.exports = { detectUserColorTemperature, userColorTempScore };
