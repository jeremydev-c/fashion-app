const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');

// Load .env FIRST before importing routes
dotenv.config();

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
app.use(cors());

// Stripe webhook needs raw body - must be before JSON parser
app.use('/payments/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '50mb' })); // Increased limit for base64 images
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('Mongo error', err));

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
console.log('✅ Recommendations route registered at /recommendations');

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
  console.log('Available routes:');
  console.log('  - GET /health');
  console.log('  - GET /recommendations/test (test endpoint)');
  console.log('  - GET /recommendations?userId=...');
});