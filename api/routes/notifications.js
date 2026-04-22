const express = require('express');
const router = express.Router();
const User = require('../models/User');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// ─── Helpers ────────────────────────────────────────────────────────────────

function isValidPushToken(token) {
  if (!token || typeof token !== 'string') return false;
  // Accept Expo push tokens (ExponentPushToken[...]) and native device tokens (alphanumeric strings 20+ chars)
  if (token.startsWith('ExponentPushToken')) return true;
  if (/^[a-zA-Z0-9_:=-]{20,}$/.test(token)) return true;
  return false;
}

function buildExpoPushHeaders() {
  const headers = {
    'Accept': 'application/json',
    'Accept-encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
  };
  // Required for standalone APK/AAB builds — without this, push is silently dropped
  if (process.env.EXPO_ACCESS_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  } else {
    console.warn('⚠️  EXPO_ACCESS_TOKEN not set — push notifications will NOT reach standalone builds');
  }
  return headers;
}

async function sendExpoPushNotification({ token, title, body, subtitle, data = {}, channelId = 'default', badge }) {
  if (!isValidPushToken(token)) {
    console.warn('⚠️  Skipping invalid push token:', token?.slice(0, 30));
    return null;
  }

  const message = {
    to: token,
    sound: 'default',
    title,
    body,
    data,
    channelId,
    priority: 'high',
    ttl: 86400, // 24 hours — retry delivery if device is offline
    // Rich notification fields
    ...(subtitle && { subtitle }),       // iOS subtitle line
    ...(badge !== undefined && { badge }),// iOS badge count
    mutableContent: true,                 // Allows iOS notification extensions
    color: '#FF6B6B',                     // Android accent color (matches app theme)
  };

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: buildExpoPushHeaders(),
      body: JSON.stringify(message),
    });
    const result = await response.json();
    if (result.data?.status === 'error') {
      console.error('Expo push error:', result.data.message, '| details:', JSON.stringify(result.data.details));
    } else {
      console.log('✅ Push sent to', token.slice(0, 25) + '...', '| ticket:', result.data?.id);
    }
    return result;
  } catch (err) {
    console.error('Failed to send push notification:', err.message);
    return null;
  }
}

async function sendToUser(userId, { title, body, data = {}, channelId = 'default' }) {
  const user = await User.findById(userId).select('pushToken notificationsEnabled');
  if (!user || !user.notificationsEnabled || !user.pushToken) return;
  return sendExpoPushNotification({ token: user.pushToken, title, body, data, channelId });
}

// ─── Routes ─────────────────────────────────────────────────────────────────

// POST /notifications/register-token
// Save push token for a user
router.post('/register-token', async (req, res) => {
  try {
    const { userId, token, platform } = req.body;
    if (!userId || !token) return res.status(400).json({ error: 'userId and token required' });

    if (!isValidPushToken(token)) {
      console.warn('⚠️  Rejected invalid push token from user', userId, ':', token?.slice(0, 40));
      return res.status(400).json({ error: 'Invalid push token format' });
    }

    await User.findByIdAndUpdate(userId, {
      pushToken: token,
      pushPlatform: platform || null,
    });

    console.log(`✅ Push token registered for user ${userId} | platform=${platform} | token=${token.slice(0, 30)}...`);
    res.json({ success: true });
  } catch (err) {
    console.error('POST /notifications/register-token', err);
    res.status(500).json({ error: 'Failed to save token' });
  }
});

// GET /notifications/preferences?userId=xxx
router.get('/preferences', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const user = await User.findById(userId).select('notificationsEnabled');
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ enabled: user.notificationsEnabled });
  } catch (err) {
    console.error('GET /notifications/preferences', err);
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

// POST /notifications/preferences
// Toggle notifications on/off for a user
router.post('/preferences', async (req, res) => {
  try {
    const { userId, enabled } = req.body;
    if (!userId || enabled === undefined) return res.status(400).json({ error: 'userId and enabled required' });

    await User.findByIdAndUpdate(userId, { notificationsEnabled: !!enabled });
    res.json({ success: true, enabled: !!enabled });
  } catch (err) {
    console.error('POST /notifications/preferences', err);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// POST /notifications/send
// Send a notification to a specific user (internal/admin use)
router.post('/send', async (req, res) => {
  try {
    const { userId, title, body, data, channelId } = req.body;
    if (!userId || !title || !body) return res.status(400).json({ error: 'userId, title, body required' });

    await sendToUser(userId, { title, body, data, channelId });
    res.json({ success: true });
  } catch (err) {
    console.error('POST /notifications/send', err);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// POST /notifications/broadcast
// Send to all users with notifications enabled
router.post('/broadcast', async (req, res) => {
  try {
    const { title, body, data, channelId } = req.body;
    if (!title || !body) return res.status(400).json({ error: 'title and body required' });

    const users = await User.find({
      notificationsEnabled: true,
      pushToken: { $exists: true, $ne: null },
    }).select('pushToken');

    const sends = users.map((u) =>
      sendExpoPushNotification({ token: u.pushToken, title, body, data, channelId })
    );
    await Promise.allSettled(sends);

    res.json({ success: true, sent: users.length });
  } catch (err) {
    console.error('POST /notifications/broadcast', err);
    res.status(500).json({ error: 'Failed to broadcast notification' });
  }
});

// ─── Retention Notifications ─────────────────────────────────────────────────

const RETENTION_MESSAGES = [
  {
    days: 2,
    title: 'Your Style Misses You 👗',
    subtitle: 'Fashion Fit',
    body: 'Your AI stylist curated new looks while you were away — come see what\'s trending for you.',
  },
  {
    days: 5,
    title: 'Fresh Outfit Ideas Await ✨',
    subtitle: 'Style Refresh',
    body: 'It\'s been a few days! Your wardrobe has new mix-and-match possibilities ready to explore.',
  },
  {
    days: 10,
    title: 'Let\'s Get You Styled 🛍️',
    subtitle: 'Welcome Back',
    body: 'Your personal AI stylist has been working on seasonal looks just for you. Tap to discover them.',
  },
];

async function runRetentionJob() {
  const now = new Date();
  for (const { days, title, subtitle, body } of RETENTION_MESSAGES) {
    const cutoff = new Date(now - days * 24 * 60 * 60 * 1000);
    const upperCutoff = new Date(cutoff - 24 * 60 * 60 * 1000);
    const users = await User.find({
      notificationsEnabled: true,
      pushToken: { $exists: true, $ne: null },
      lastActive: { $lte: cutoff, $gte: upperCutoff },
    }).select('pushToken');
    if (users.length === 0) continue;
    await Promise.allSettled(
      users.map((u) =>
        sendExpoPushNotification({ token: u.pushToken, title, subtitle, body, channelId: 'reminders', badge: 1 })
      )
    );
    console.log(`Retention: sent ${users.length} push(es) for ${days}-day inactive users`);
  }
}

// POST /notifications/retention/run — manual admin trigger
router.post('/retention/run', async (req, res) => {
  try {
    await runRetentionJob();
    res.json({ success: true });
  } catch (err) {
    console.error('Retention job error:', err);
    res.status(500).json({ error: 'Retention job failed' });
  }
});

// GET /notifications/debug/:userId — check push readiness for a user (admin/dev)
router.get('/debug/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select(
      'pushToken pushPlatform notificationsEnabled lastActive'
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    const tokenValid = isValidPushToken(user.pushToken);
    const hasAccessToken = !!process.env.EXPO_ACCESS_TOKEN;

    res.json({
      pushToken: user.pushToken ? user.pushToken.slice(0, 30) + '...' : null,
      pushPlatform: user.pushPlatform,
      notificationsEnabled: user.notificationsEnabled,
      lastActive: user.lastActive,
      tokenValid,
      expoAccessTokenConfigured: hasAccessToken,
      issues: [
        !user.pushToken && 'No push token stored — device has not registered',
        user.pushToken && !tokenValid && 'Push token format is invalid',
        !user.notificationsEnabled && 'Notifications are disabled by user',
        !hasAccessToken && 'EXPO_ACCESS_TOKEN env var not set — required for standalone APK builds',
      ].filter(Boolean),
    });
  } catch (err) {
    console.error('GET /notifications/debug', err);
    res.status(500).json({ error: 'Debug check failed' });
  }
});

// POST /notifications/test-push/:userId — send a test push to verify delivery
router.post('/test-push/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('pushToken notificationsEnabled');
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.pushToken) return res.status(400).json({ error: 'No push token stored for this user' });

    const result = await sendExpoPushNotification({
      token: user.pushToken,
      title: 'Fashion Fit 🔔',
      subtitle: 'Test Notification',
      body: 'Looking good! Push notifications are working perfectly.',
      data: { test: true },
      channelId: 'default',
      badge: 1,
    });

    res.json({ success: true, expoResult: result });
  } catch (err) {
    console.error('POST /notifications/test-push', err);
    res.status(500).json({ error: 'Test push failed' });
  }
});

// Export helper so other routes can send notifications
module.exports = router;
module.exports.sendToUser = sendToUser;
module.exports.sendExpoPushNotification = sendExpoPushNotification;
module.exports.runRetentionJob = runRetentionJob;
module.exports.buildExpoPushHeaders = buildExpoPushHeaders;
