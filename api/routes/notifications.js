const express = require('express');
const router = express.Router();
const User = require('../models/User');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function sendExpoPushNotification({ token, title, body, data = {}, channelId = 'default' }) {
  if (!token || !token.startsWith('ExponentPushToken')) return;

  const message = {
    to: token,
    sound: 'default',
    title,
    body,
    data,
    channelId,
    priority: 'high',
  };

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
    const result = await response.json();
    if (result.data?.status === 'error') {
      console.error('Expo push error:', result.data.message);
    }
    return result;
  } catch (err) {
    console.error('Failed to send push notification:', err);
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

    await User.findByIdAndUpdate(userId, {
      pushToken: token,
      pushPlatform: platform || null,
    });

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

// Export helper so other routes can send notifications
module.exports = router;
module.exports.sendToUser = sendToUser;
module.exports.sendExpoPushNotification = sendExpoPushNotification;
