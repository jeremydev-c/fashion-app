const express = require('express');
const User = require('../models/User');
const ClothingItem = require('../models/ClothingItem');
const Outfit = require('../models/Outfit');
const StyleDNA = require('../models/StyleDNA');
const ChatHistory = require('../models/ChatHistory');
const ApiUsage = require('../models/ApiUsage');
const { cloudinary } = require('../utils/cloudinary');

const router = express.Router();

// Admin secret MUST be set in .env — reject all requests if missing
const ADMIN_SECRET = process.env.ADMIN_SECRET;
if (!ADMIN_SECRET) {
  console.warn('⚠️  ADMIN_SECRET not set — admin endpoints will reject all requests');
}

/**
 * GET /admin/analytics
 * Get comprehensive analytics for all users
 */
router.get('/analytics', async (req, res) => {
  try {
    const { secret } = req.query;
    
    // Verify admin secret
    if (secret !== ADMIN_SECRET) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Get all users
    const allUsers = await User.find({}).select('email name username avatar isVerified createdAt onboardingCompleted subscription');
    const totalUsers = allUsers.length;
    const verifiedUsers = allUsers.filter(u => u.isVerified).length;
    const onboardedUsers = allUsers.filter(u => u.onboardingCompleted).length;
    const premiumUsers = allUsers.filter(u => u.subscription?.planId !== 'free').length;

    // Get all wardrobe items
    const allItems = await ClothingItem.find({});
    const totalItems = allItems.length;
    
    // Category distribution
    const categoryDistribution = {};
    allItems.forEach(item => {
      categoryDistribution[item.category] = (categoryDistribution[item.category] || 0) + 1;
    });

    // Color distribution
    const colorDistribution = {};
    allItems.forEach(item => {
      if (item.color) {
        const color = item.color.toLowerCase();
        colorDistribution[color] = (colorDistribution[color] || 0) + 1;
      }
    });

    // Get all outfits
    const allOutfits = await Outfit.find({});
    const totalOutfits = allOutfits.length;
    const savedOutfits = allOutfits.filter(o => o.favorite).length;

    // Get all Style DNA records
    const allStyleDNA = await StyleDNA.find({});
    const usersWithStyleDNA = allStyleDNA.length;

    // Get all chat conversations
    const allChats = await ChatHistory.find({});
    const totalConversations = allChats.length;
    const totalMessages = allChats.reduce((sum, chat) => sum + (chat.messages?.length || 0), 0);

    // User activity (users with items)
    const usersWithItems = await ClothingItem.distinct('userId');
    
    // Active users = users who have been active in the last 24 hours (more accurate for "currently active")
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    // Get users who have added items in the last 24 hours
    const recentItemActivity = await ClothingItem.distinct('userId', {
      createdAt: { $gte: oneDayAgo }
    });
    
    // Get users who have updated their profile in last 24 hours
    const recentProfileActivity = allUsers.filter(u => {
      const updatedAt = u.updatedAt || u.createdAt;
      return new Date(updatedAt) > oneDayAgo;
    }).map(u => u._id.toString());
    
    // Get users with recent chat activity in last 24 hours
    const recentChatActivity = await ChatHistory.distinct('userId', {
      updatedAt: { $gte: oneDayAgo }
    });
    
    // Combine all active user IDs (unique) - users active in last 24 hours
    const activeUserIds = new Set([
      ...recentItemActivity,
      ...recentProfileActivity,
      ...recentChatActivity.map(id => id.toString())
    ]);
    
    const activeUsers = activeUserIds.size;
    
    // Recent users (new signups in last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentUsers = allUsers.filter(u => new Date(u.createdAt) > sevenDaysAgo).length;

    // Average items per user
    const avgItemsPerUser = activeUsers > 0 ? (totalItems / activeUsers).toFixed(2) : 0;

    // Top users by item count
    const userItemCounts = {};
    allItems.forEach(item => {
      userItemCounts[item.userId] = (userItemCounts[item.userId] || 0) + 1;
    });
    const topUsers = Object.entries(userItemCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId, count]) => {
        const user = allUsers.find(u => u._id.toString() === userId);
        return {
          userId,
          email: user?.email || 'Unknown',
          name: user?.name || 'Unknown',
          itemCount: count,
        };
      });

    // System health
    const systemHealth = {
      database: 'connected',
      cloudinary: process.env.CLOUDINARY_CLOUD_NAME ? 'configured' : 'not configured',
      openai: process.env.OPENAI_API_KEY ? 'configured' : 'not configured',
      paystack: process.env.PAYSTACK_SECRET_KEY ? 'configured' : 'not configured',
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
      },
    };

    // AI usage stats
    const aiStats = {
      totalCategorizations: totalItems, // Each item was categorized by AI
      totalOutfitGenerations: totalOutfits,
      totalChatMessages: totalMessages,
      totalStyleDNACalculations: usersWithStyleDNA,
    };

    // Get OpenAI API usage and costs
    let openaiUsage = {
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalCost: 0,
      estimatedCost: 0,
      calls: {
        categorizeImage: 0,
        chat: 0,
        styleDNA: 0,
      },
    };

    try {
      const usageRecords = await ApiUsage.find({ service: 'openai' }).lean();
      if (usageRecords && usageRecords.length > 0) {
        openaiUsage.totalTokens = usageRecords.reduce((sum, r) => sum + (r.tokens?.prompt || 0) + (r.tokens?.completion || 0), 0);
        openaiUsage.promptTokens = usageRecords.reduce((sum, r) => sum + (r.tokens?.prompt || 0), 0);
        openaiUsage.completionTokens = usageRecords.reduce((sum, r) => sum + (r.tokens?.completion || 0), 0);
        openaiUsage.totalCost = usageRecords.reduce((sum, r) => sum + (r.cost || 0), 0);
        
        // Count calls by operation
        usageRecords.forEach(record => {
          if (record.operation === 'categorize-image') openaiUsage.calls.categorizeImage++;
          else if (record.operation === 'chat') openaiUsage.calls.chat++;
          else if (record.operation === 'style-dna') openaiUsage.calls.styleDNA++;
        });

        // Estimate cost if not tracked (based on model pricing)
        // GPT-4o: $2.50/1M input, $10/1M output
        // GPT-4o-mini: $0.15/1M input, $0.60/1M output
        if (openaiUsage.totalCost === 0 && openaiUsage.totalTokens > 0) {
          const gpt4oTokens = usageRecords.filter(r => r.model === 'gpt-4o').reduce((sum, r) => ({
            prompt: sum.prompt + (r.tokens?.prompt || 0),
            completion: sum.completion + (r.tokens?.completion || 0),
          }), { prompt: 0, completion: 0 });
          
          const gpt4oMiniTokens = usageRecords.filter(r => r.model === 'gpt-4o-mini').reduce((sum, r) => ({
            prompt: sum.prompt + (r.tokens?.prompt || 0),
            completion: sum.completion + (r.tokens?.completion || 0),
          }), { prompt: 0, completion: 0 });

          const gpt4oCost = (gpt4oTokens.prompt / 1000000 * 2.50) + (gpt4oTokens.completion / 1000000 * 10);
          const gpt4oMiniCost = (gpt4oMiniTokens.prompt / 1000000 * 0.15) + (gpt4oMiniTokens.completion / 1000000 * 0.60);
          openaiUsage.estimatedCost = gpt4oCost + gpt4oMiniCost;
        }
      }
    } catch (error) {
      console.error('Failed to fetch OpenAI usage:', error);
      // Keep default values
    }

    // Get Cloudinary storage usage
    let cloudinaryUsage = {
      totalStorage: 0, // bytes
      totalStorageMB: 0,
      totalStorageGB: 0,
      totalImages: 0,
      storageLimit: null, // Will be null if no limit
      storageUsedPercent: 0,
      bandwidthUsed: 0, // bytes
      bandwidthUsedGB: 0,
    };

    try {
      if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
        // Get Cloudinary instance and ensure it's configured
        const cloudinaryModule = require('cloudinary').v2;
        
        // Configure Cloudinary if not already configured
        if (!cloudinaryModule.config().api_key) {
          cloudinaryModule.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
          });
        }
        
        // Get account usage from Cloudinary Admin API
        const accountUsage = await cloudinaryModule.api.usage();
        
        // Cloudinary API returns storage in bytes
        cloudinaryUsage.totalStorage = accountUsage.used_quota?.storage || accountUsage.storage?.used || 0;
        cloudinaryUsage.totalStorageMB = parseFloat((cloudinaryUsage.totalStorage / 1024 / 1024).toFixed(2));
        cloudinaryUsage.totalStorageGB = parseFloat((cloudinaryUsage.totalStorage / 1024 / 1024 / 1024).toFixed(2));
        
        // Storage limit
        cloudinaryUsage.storageLimit = accountUsage.plan?.max_storage_bytes || accountUsage.storage?.limit || null;
        
        if (cloudinaryUsage.storageLimit) {
          cloudinaryUsage.storageUsedPercent = parseFloat(((cloudinaryUsage.totalStorage / cloudinaryUsage.storageLimit) * 100).toFixed(2));
        }

        // Bandwidth usage
        cloudinaryUsage.bandwidthUsed = accountUsage.used_quota?.bandwidth || accountUsage.bandwidth?.used || 0;
        cloudinaryUsage.bandwidthUsedGB = parseFloat((cloudinaryUsage.bandwidthUsed / 1024 / 1024 / 1024).toFixed(2));

        // Count images in our folders
        try {
          const wardrobeImages = await cloudinaryModule.search
            .expression('folder:fashion-fit/wardrobe')
            .max_results(1000)
            .execute();
          
          const profileImages = await cloudinaryModule.search
            .expression('folder:fashion-fit/profiles')
            .max_results(1000)
            .execute();

          cloudinaryUsage.totalImages = (wardrobeImages?.total_count || 0) + (profileImages?.total_count || 0);
        } catch (searchError) {
          console.error('Failed to count Cloudinary images:', searchError);
          // Fallback: count images from database
          cloudinaryUsage.totalImages = totalItems + allUsers.filter(u => u.avatar).length;
        }
      } else {
        // Fallback: count images from database
        cloudinaryUsage.totalImages = totalItems + allUsers.filter(u => u.avatar).length;
      }
    } catch (error) {
      console.error('Failed to fetch Cloudinary usage:', error);
      // Fallback: count images from database
      cloudinaryUsage.totalImages = totalItems + allUsers.filter(u => u.avatar).length;
    }

    // Response
    res.json({
      timestamp: new Date().toISOString(),
      users: {
        total: totalUsers,
        verified: verifiedUsers,
        onboarded: onboardedUsers,
        active: activeUsers,
        premium: premiumUsers,
        recent: recentUsers,
        topUsers,
      },
      wardrobe: {
        totalItems,
        avgItemsPerUser: parseFloat(avgItemsPerUser),
        categoryDistribution,
        colorDistribution: Object.entries(colorDistribution)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([color, count]) => ({ color, count })),
      },
      outfits: {
        total: totalOutfits,
        saved: savedOutfits,
      },
      styleDNA: {
        total: usersWithStyleDNA,
        coverage: totalUsers > 0 ? ((usersWithStyleDNA / totalUsers) * 100).toFixed(2) : 0,
      },
      chat: {
        totalConversations,
        totalMessages,
        avgMessagesPerConversation: totalConversations > 0 ? (totalMessages / totalConversations).toFixed(2) : 0,
      },
      ai: aiStats,
      system: systemHealth,
      apiCosts: {
        openai: openaiUsage,
        cloudinary: cloudinaryUsage,
        totalEstimatedCost: openaiUsage.totalCost || openaiUsage.estimatedCost,
      },
    });
  } catch (error) {
    console.error('Admin analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

/**
 * GET /admin/users
 * Get all users with details
 */
router.get('/users', async (req, res) => {
  try {
    const { secret } = req.query;
    
    if (secret !== ADMIN_SECRET) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const users = await User.find({})
      .select('email name username avatar isVerified createdAt onboardingCompleted subscription')
      .sort({ createdAt: -1 });

    // Add item counts for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const itemCount = await ClothingItem.countDocuments({ userId: user._id.toString() });
        const outfitCount = await Outfit.countDocuments({ userId: user._id.toString() });
        const hasStyleDNA = await StyleDNA.exists({ userId: user._id.toString() });
        
        return {
          ...user.toJSON(),
          stats: {
            items: itemCount,
            outfits: outfitCount,
            hasStyleDNA: !!hasStyleDNA,
          },
        };
      })
    );

    res.json({ users: usersWithStats });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// VISUAL RE-ANALYSIS — upgrade heuristic-only items with GPT-4o vision
// ═══════════════════════════════════════════════════════════════════════════

const {
  runReanalysisJob,
  getJobStatus,
  cancelJob,
  getReanalysisStats,
} = require('../services/visualReanalysis');

/**
 * GET /admin/reanalyze/stats?secret=...&userId=...
 * Check how many items need re-analysis
 */
router.get('/reanalyze/stats', async (req, res) => {
  try {
    const { secret, userId } = req.query;
    if (secret !== ADMIN_SECRET) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const stats = await getReanalysisStats(userId);
    res.json(stats);
  } catch (err) {
    console.error('Reanalyze stats error:', err);
    res.status(500).json({ error: 'Failed to get reanalysis stats' });
  }
});

/**
 * POST /admin/reanalyze/start
 * body: { secret, userId?, limit? }
 * Start a background re-analysis job
 */
router.post('/reanalyze/start', async (req, res) => {
  try {
    const { secret, userId, limit } = req.body || {};
    if (secret !== ADMIN_SECRET) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
    }

    const result = await runReanalysisJob({
      userId: userId || undefined,
      limit: limit || undefined,
    });
    res.json(result);
  } catch (err) {
    console.error('Reanalyze start error:', err);
    res.status(500).json({ error: 'Failed to start re-analysis' });
  }
});

/**
 * GET /admin/reanalyze/status?secret=...
 * Check progress of the running re-analysis job
 */
router.get('/reanalyze/status', async (req, res) => {
  try {
    const { secret } = req.query;
    if (secret !== ADMIN_SECRET) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json(getJobStatus());
  } catch (err) {
    console.error('Reanalyze status error:', err);
    res.status(500).json({ error: 'Failed to get job status' });
  }
});

/**
 * POST /admin/reanalyze/cancel
 * body: { secret }
 * Cancel a running re-analysis job
 */
router.post('/reanalyze/cancel', async (req, res) => {
  try {
    const { secret } = req.body || {};
    if (secret !== ADMIN_SECRET) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json(cancelJob());
  } catch (err) {
    console.error('Reanalyze cancel error:', err);
    res.status(500).json({ error: 'Failed to cancel job' });
  }
});

module.exports = router;
