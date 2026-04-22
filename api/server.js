const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');

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
const adminRoutes = require('./routes/admin');
const notificationsRoutes = require('./routes/notifications');
const socialRoutes = require('./routes/social');
const DISABLE_PAYMENTS = process.env.DISABLE_PAYMENTS === 'true';
const paymentsRoutes = DISABLE_PAYMENTS ? null : require('./routes/payments');
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

// ── Security Middlewares ──────────────────────────────────────────────────────
app.use(helmet()); // Secures Express apps by setting HTTP response headers
// Prevent NoSQL injection attacks
app.use(mongoSanitize());

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
// Protect against HTTP Parameter Pollution attacks
app.use(hpp());


mongoose
  .connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
  })
  .then(() => {
    console.log('✅ Connected to MongoDB');
    startScheduledNotifications();
  })
  .catch((err) => { console.error('❌ Mongo connection failed:', err); process.exit(1); });

// ── Timezone-aware scheduled notifications ───────────────────────────────────
// Runs every hour. For each user, calculates their local hour from their stored
// utcOffset and sends the appropriate slot (morning 8AM / midday 13PM / evening 18PM).
// Users without a stored offset default to UTC+0.
// Per-user per-slot tracking prevents double-sends.
function startScheduledNotifications() {
  const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
  const { buildExpoPushHeaders } = require('./routes/notifications');

  const SLOTS = [
    {
      id: 'morning', localHour: 8,
      channelId: 'outfit',
      messages: [
        { title: "Good Morning, Stylish ✨", body: "Your AI stylist picked a fresh look for today — tap to see it." },
        { title: "Today's Outfit is Ready 👗", body: "What's the vibe today? Let's put together something amazing." },
        { title: "Rise & Style 🌅", body: "New day, new fit. Your personalized outfit suggestion is waiting." },
        { title: "Your Wardrobe Called 👔", body: "It says you have 3 outfits you haven't tried yet. Let's fix that." },
        { title: "Dress to Impress Today 🔥", body: "Your AI stylist found the perfect combo from your wardrobe." },
        { title: "Style Tip of the Day 💡", body: "Mix something unexpected today — your AI has a bold suggestion ready." },
        { title: "Looking for Outfit Inspo? 🪞", body: "We've matched pieces from your wardrobe you haven't paired before." },
      ],
    },
    {
      id: 'midday', localHour: 13,
      channelId: 'outfit',
      messages: [
        { title: "Midday Style Check 👀", body: "How's today's look holding up? Browse fresh combos for this afternoon." },
        { title: "Outfit Upgrade? 🔄", body: "Heading out later? Your stylist has a quick refresh idea for you." },
        { title: "Lunchtime Inspo 🍽️", body: "Take a break and explore a new outfit pairing from your wardrobe." },
        { title: "Your Afternoon Look 🌤️", body: "Your AI matched something bold for this afternoon — come take a peek." },
        { title: "Style Moment ✨", body: "Quick — your stylist just dropped a new look suggestion. Worth a glance!" },
      ],
    },
    {
      id: 'evening', localHour: 18,
      channelId: 'outfit',
      messages: [
        { title: "Plan Tomorrow's Fit 🌙", body: "Get ahead — pick your outfit for tomorrow before the day ends." },
        { title: "Evening Style Prep 🛏️", body: "Wind down with a quick wardrobe browse. Tomorrow's look is one tap away." },
        { title: "What's Tomorrow's Vibe? 🎯", body: "Casual? Sharp? Let your AI stylist set you up for the morning." },
        { title: "Outfit Sorted? ✅", body: "Save time tomorrow — your AI already has 3 outfit ideas ready for you." },
        { title: "Tomorrow, Styled 💫", body: "Don't sleep on your style — check out what your AI has planned for you." },
      ],
    },
  ];

  // Track sent notifications: { "userId_slotId_date": true }
  const sentTracker = {};

  const run = async () => {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const todayKey = now.toISOString().slice(0, 10);
    const dayOfMonth = now.getUTCDate();

    try {
      const User = require('./models/User');
      const users = await User.find({
        notificationsEnabled: true,
        pushToken: { $exists: true, $ne: null },
      }).select('pushToken utcOffset').lean();

      if (!users.length) return;

      // For each slot, find users whose local hour matches
      for (const slot of SLOTS) {
        // Collect users who should receive this slot right now
        const eligible = [];
        for (const user of users) {
          const offset = typeof user.utcOffset === 'number' ? user.utcOffset : 0;
          const userLocalHour = (utcHour + offset + 24) % 24;

          if (userLocalHour !== slot.localHour) continue;

          // Prevent double-send
          const trackKey = `${user._id}_${slot.id}_${todayKey}`;
          if (sentTracker[trackKey]) continue;
          sentTracker[trackKey] = true;

          eligible.push(user);
        }

        if (!eligible.length) continue;

        const pick = slot.messages[dayOfMonth % slot.messages.length];

        const messages = eligible.map(u => ({
          to: u.pushToken,
          sound: 'default',
          title: pick.title,
          subtitle: 'Fashion Fit',
          body: pick.body,
          channelId: slot.channelId,
          priority: 'high',
          ttl: 86400,
          color: '#FF6B6B',
          badge: 1,
        }));

        const headers = buildExpoPushHeaders();
        for (let i = 0; i < messages.length; i += 100) {
          try {
            const resp = await fetch(EXPO_PUSH_URL, {
              method: 'POST',
              headers,
              body: JSON.stringify(messages.slice(i, i + 100)),
            });
            const result = await resp.json();
            if (Array.isArray(result.data)) {
              const errors = result.data.filter(r => r.status === 'error');
              if (errors.length) console.error(`[${slot.id}] push errors:`, JSON.stringify(errors));
            }
          } catch (batchErr) {
            console.error(`[${slot.id}] batch send failed:`, batchErr.message);
          }
        }
        console.log(`✅ [${slot.id}] nudge sent to ${eligible.length} users (UTC hour ${utcHour})`);
      }

      // Clean up old tracking keys (anything not from today)
      for (const key of Object.keys(sentTracker)) {
        if (!key.endsWith(todayKey)) delete sentTracker[key];
      }
    } catch (err) {
      console.error('Scheduled notification error:', err);
    }
  };

  // Run every hour on the hour
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
if (DISABLE_PAYMENTS) {
  app.use('/payments', (_req, res) => res.status(503).json({ error: 'payments_disabled' }));
  console.warn('⚠️  Payments routes disabled (DISABLE_PAYMENTS=true)');
} else {
  app.use('/payments', paymentsRoutes);
}
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

// ─── Retention scheduler (runs daily) ────────────────────────────────────────
const { runRetentionJob } = require('./routes/notifications');
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
setInterval(() => {
  runRetentionJob().catch((err) => console.error('Retention job error:', err));
}, TWENTY_FOUR_HOURS);

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