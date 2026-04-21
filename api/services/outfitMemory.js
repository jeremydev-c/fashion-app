/**
 * outfitMemory.js — Cross-day outfit tracking.
 * Prevents the engine from recommending identical or highly similar
 * outfits across consecutive days.  Records auto-expire after 7 days.
 */

const RecentRecommendation = require('../models/RecentRecommendation');

async function getRecentlyServed(userId, days = 7) {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  try {
    return await RecentRecommendation.find({ userId, servedAt: { $gte: since } }).lean();
  } catch (_) {
    return [];
  }
}

async function recordServedOutfits(userId, recommendations) {
  if (!recommendations?.length) return;
  const docs = recommendations.map(rec => {
    const itemIds = (rec.items || []).map(i => (i.id || i._id || '').toString()).filter(Boolean).sort();
    return {
      userId,
      itemSignature: itemIds.join('|'),
      directionKey: rec._directionKey || '',
      occasion: rec.occasion || '',
      topItemId: rec.items?.find(i => i.category === 'top')?.id || '',
      bottomItemId: rec.items?.find(i => i.category === 'bottom')?.id || '',
      dressItemId: rec.items?.find(i => i.category === 'dress')?.id || '',
      itemIds,
      servedAt: new Date(),
    };
  });
  try {
    await RecentRecommendation.insertMany(docs, { ordered: false });
  } catch (_) {}
}

function crossDayPenalty(items, recentlyServed) {
  if (!recentlyServed?.length) return 0;
  const currentIds = new Set(items.map(i => (i._id || i.id || '').toString()));
  const currentSig = [...currentIds].sort().join('|');

  let penalty = 0;
  for (const recent of recentlyServed) {
    // Exact match — heavy penalty
    if (recent.itemSignature === currentSig) {
      penalty += 0.25;
      continue;
    }
    // Core piece overlap (same top AND bottom = too similar)
    const topId = items.find(i => i.category === 'top');
    const botId = items.find(i => i.category === 'bottom');
    const topMatch = topId && recent.topItemId && (topId._id || topId.id || '').toString() === recent.topItemId;
    const botMatch = botId && recent.bottomItemId && (botId._id || botId.id || '').toString() === recent.bottomItemId;
    if (topMatch && botMatch) {
      penalty += 0.12;
      continue;
    }
    // Partial overlap
    const recentIds = new Set(recent.itemIds || []);
    const shared = [...currentIds].filter(id => recentIds.has(id)).length;
    const overlap = shared / Math.max(currentIds.size, 1);
    if (overlap >= 0.75) penalty += 0.08;
    else if (overlap >= 0.5) penalty += 0.03;
  }

  return Math.min(penalty, 0.35);
}

module.exports = { getRecentlyServed, recordServedOutfits, crossDayPenalty };
