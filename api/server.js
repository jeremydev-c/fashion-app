const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');

// Load .env FIRST before importing routes
dotenv.config();

// ── Process-level safety net ──────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception — shutting down gracefully:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
  // Don't exit — log and continue; individual routes have their own try/catch
});

const authRoutes = require('./routes/auth');
const wardrobeRoutes = require('./routes/wardrobe');
const aiRoutes = require('./routes/ai');
const stylistRoutes = require('./routes/stylist');
const plannerRoutes = require('./routes/planner');
const uploadRoutes = require('./routes/upload');
const styleDNARoutes = require('./routes/styleDNA');
const outfitRoutes = require('./routes/outfits');
const weatherRoutes = require('./routes/weather');
const analyticsRoutes = require('./routes/analytics');
const learningRoutes = require('./routes/learning');
const chatRoutes = require('./routes/chat');
const paymentsRoutes = require('./routes/payments');
const adminRoutes = require('./routes/admin');
const notificationsRoutes = require('./routes/notifications');
const socialRoutes = require('./routes/social');
let recommendationsRoutes;
try {
  recommendationsRoutes = require('./routes/recommendations');
  console.log('✅ Recommendations route loaded');
} catch (err) {
  console.error('❌ Failed to load recommendations route:', err);
  process.exit(1);
}

// Verify Cloudinary credentials are loaded (optional, for debugging)
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
  console.log('✅ Cloudinary credentials loaded');
} else {
  console.warn('⚠️  Cloudinary credentials not found in .env file');
}

const app = express();

// ── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : true; // dev fallback: allow all
app.use(cors({ origin: allowedOrigins }));

// ── Simple in-memory rate limiter (no extra package needed) ───────────────────
const rateLimitMap = new Map();
const RATE_WINDOW_MS = 60_000; // 1 minute
const RATE_MAX = 120;          // requests per window per IP

setInterval(() => {
  const cutoff = Date.now() - RATE_WINDOW_MS;
  for (const [ip, entry] of rateLimitMap) {
    if (entry.windowStart < cutoff) rateLimitMap.delete(ip);
  }
}, RATE_WINDOW_MS);

app.use((req, res, next) => {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return next();
  }
  if (entry.count >= RATE_MAX) {
    return res.status(429).json({ error: 'Too many requests — slow down.' });
  }
  entry.count++;
  next();
});

// ── Per-request timeout (30 s) ────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setTimeout(30_000, () => {
    if (!res.headersSent) res.status(503).json({ error: 'Request timed out' });
  });
  next();
});

// Paystack webhooks use standard JSON body

app.use(express.json({ limit: '50mb' })); // Increased limit for base64 images
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

mongoose
  .connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
  })
  .then(() => {
    console.log('✅ Connected to MongoDB');
    startDailyNudge();
  })
  .catch((err) => { console.error('❌ Mongo connection failed:', err); process.exit(1); });

// ── Daily outfit nudge ────────────────────────────────────────────────────────
// Fires at 8 AM East Africa Time (UTC+3 = 05:00 UTC).
// Checks every hour; in-memory flag prevents double-send on the same day.
// Uses Expo batch API (max 100/request) — no extra packages needed.
function startDailyNudge() {
  const NUDGE_HOUR_UTC = 5; // 08:00 EAT
  const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
  let lastSentDate = '';

  const run = async () => {
    const now = new Date();
    const todayUTC = now.toISOString().slice(0, 10);
    if (now.getUTCHours() !== NUDGE_HOUR_UTC || lastSentDate === todayUTC) return;
    lastSentDate = todayUTC;

    try {
      const User = require('./models/User');
      const users = await User.find({
        notificationsEnabled: true,
        pushToken: { $exists: true, $ne: null },
      }).select('pushToken').lean();

      if (!users.length) return;

      // Build messages
      const nudges = [
        { body: "Your AI stylist has a fresh look ready for today ✨" },
        { body: "What's the occasion today? Let's build your outfit 👗" },
        { body: "New day, new look. Open Fashion Fit to get started 🌅" },
        { body: "Your wardrobe is waiting — tap to get today's outfit 👔" },
      ];
      const pick = nudges[now.getUTCDate() % nudges.length];

      const messages = users.map(u => ({
        to: u.pushToken,
        sound: 'default',
        title: "Fashion Fit",
        body: pick.body,
        channelId: 'outfit',
        priority: 'normal', // 'normal' = no wake lock — saves battery, still delivered
      }));

      // Expo allows up to 100 per batch request
      for (let i = 0; i < messages.length; i += 100) {
        await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messages.slice(i, i + 100)),
        }).catch(() => {});
      }
      console.log(`✅ Daily nudge sent to ${users.length} users`);
    } catch (err) {
      console.error('Daily nudge error:', err);
    }
  };

  // Check once immediately (in case server restarted at nudge hour), then every hour
  run();
  setInterval(run, 60 * 60 * 1000);
}

mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected — mongoose will auto-reconnect'));
mongoose.connection.on('error', (err) => console.error('MongoDB error:', err));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/auth', authRoutes);
app.use('/wardrobe', wardrobeRoutes);
app.use('/ai', aiRoutes);
app.use('/stylist', stylistRoutes);
app.use('/planner', plannerRoutes);
app.use('/upload', uploadRoutes);
app.use('/style-dna', styleDNARoutes);
app.use('/outfits', outfitRoutes);
app.use('/recommendations', recommendationsRoutes);
app.use('/weather', weatherRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/learning', learningRoutes);
app.use('/chat', chatRoutes);
app.use('/payments', paymentsRoutes);
app.use('/admin', adminRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/social', socialRoutes);
console.log('✅ Recommendations route registered at /recommendations');
console.log('✅ Social route registered at /social');

// 404 handler for unknown routes
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
  console.log('Available routes:');
  console.log('  - GET /health');
  console.log('  - GET /recommendations/test (test endpoint)');
  console.log('  - GET /recommendations?userId=...');
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown(signal) {
  console.log(`${signal} received — shutting down gracefully`);
  server.close(() => {
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed. Bye.');
      process.exit(0);
    });
  });
  // Force exit if shutdown takes > 10 s
  setTimeout(() => { console.error('Forced exit after timeout'); process.exit(1); }, 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));