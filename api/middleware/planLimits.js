const User = require('../models/User');
const ClothingItem = require('../models/ClothingItem');

// Set to false to enforce plan limits in production
const BYPASS_LIMITS = true;

const PLAN_LIMITS = {
  free: { maxItems: 30, dailyRecommendations: 3, bulkUpload: false, destinationWeather: false, styleCoach: false, analytics: false, planner: false },
  pro: { maxItems: 200, dailyRecommendations: Infinity, bulkUpload: true, destinationWeather: false, styleCoach: true, analytics: true, planner: true },
  'pro-yearly': { maxItems: 200, dailyRecommendations: Infinity, bulkUpload: true, destinationWeather: true, styleCoach: true, analytics: true, planner: true },
  elite: { maxItems: Infinity, dailyRecommendations: Infinity, bulkUpload: true, destinationWeather: true, styleCoach: true, analytics: true, planner: true },
};

const FEATURE_LABELS = {
  bulkUpload: 'Bulk Upload',
  destinationWeather: 'Destination Weather',
  styleCoach: 'AI Style Coach',
  analytics: 'Wardrobe Analytics',
  planner: 'Outfit Planner',
};

const FEATURE_MIN_PLAN = {
  bulkUpload: 'Pro',
  destinationWeather: 'Pro Yearly or Elite',
  styleCoach: 'Pro',
  analytics: 'Pro',
  planner: 'Pro',
};

// In-memory daily recommendation counter (resets on server restart, fine for MVP)
const dailyRecCounts = new Map();

function getDayKey(userId) {
  const today = new Date().toISOString().slice(0, 10);
  return `${userId}:${today}`;
}

function getLimits(planId) {
  return PLAN_LIMITS[planId] || PLAN_LIMITS.free;
}

async function resolveUserPlan(req) {
  const userId = req.userId || req.query?.userId || req.body?.userId;
  if (!userId) return { userId: null, planId: 'free', limits: PLAN_LIMITS.free };

  const user = await User.findById(userId).select('subscription').lean();
  const status = user?.subscription?.status || 'active';
  const isActive = status === 'active' || status === 'non-renewing';
  const planId = isActive ? (user?.subscription?.planId || 'free') : 'free';
  return { userId, planId, limits: getLimits(planId), isActive, status };
}

function requireFeature(featureKey) {
  return async (req, res, next) => {
    if (BYPASS_LIMITS) return next();
    try {
      const { planId, limits } = await resolveUserPlan(req);
      if (!limits[featureKey]) {
        return res.status(403).json({
          error: 'upgrade_required',
          message: `${FEATURE_LABELS[featureKey] || featureKey} requires a ${FEATURE_MIN_PLAN[featureKey] || 'Pro'} plan.`,
          feature: featureKey,
          currentPlan: planId,
        });
      }
      next();
    } catch (err) {
      console.error('Plan limits middleware error:', err);
      next();
    }
  };
}

function enforceItemLimit() {
  return async (req, res, next) => {
    if (BYPASS_LIMITS) return next();
    try {
      const { userId, planId, limits } = await resolveUserPlan(req);
      if (!userId || limits.maxItems === Infinity) return next();

      const count = await ClothingItem.countDocuments({ userId });
      if (count >= limits.maxItems) {
        return res.status(403).json({
          error: 'item_limit_reached',
          message: `You've reached the ${limits.maxItems} item limit on your ${planId === 'free' ? 'Free' : 'current'} plan. Upgrade to add more items.`,
          currentCount: count,
          maxItems: limits.maxItems,
          currentPlan: planId,
        });
      }
      next();
    } catch (err) {
      console.error('Item limit middleware error:', err);
      next();
    }
  };
}

function enforceDailyRecommendations() {
  return async (req, res, next) => {
    if (BYPASS_LIMITS) return next();
    try {
      const { userId, planId, limits } = await resolveUserPlan(req);
      if (!userId || limits.dailyRecommendations === Infinity) return next();

      const key = getDayKey(userId);
      const current = dailyRecCounts.get(key) || 0;

      if (current >= limits.dailyRecommendations) {
        return res.status(403).json({
          error: 'daily_limit_reached',
          message: `You've used all ${limits.dailyRecommendations} outfit recommendations for today. Upgrade to Pro for unlimited recommendations.`,
          used: current,
          limit: limits.dailyRecommendations,
          currentPlan: planId,
        });
      }

      dailyRecCounts.set(key, current + 1);

      // Clean up old entries once an hour-ish
      if (Math.random() < 0.01) {
        const todayPrefix = new Date().toISOString().slice(0, 10);
        for (const k of dailyRecCounts.keys()) {
          if (!k.endsWith(todayPrefix)) dailyRecCounts.delete(k);
        }
      }

      next();
    } catch (err) {
      console.error('Daily rec limit middleware error:', err);
      next();
    }
  };
}

module.exports = { requireFeature, enforceItemLimit, enforceDailyRecommendations, getLimits, PLAN_LIMITS };
