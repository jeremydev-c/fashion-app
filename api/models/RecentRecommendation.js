const mongoose = require('mongoose');

/**
 * RecentRecommendation — tracks what outfits were recommended per user
 * so the engine avoids repeating the same looks across days.
 * Entries auto-expire after 7 days via TTL index.
 */
const RecentRecommendationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    itemSignature: { type: String, required: true }, // sorted item IDs joined by '|'
    directionKey: { type: String },                   // outfit direction key
    occasion: { type: String },
    topItemId: { type: String },
    bottomItemId: { type: String },
    dressItemId: { type: String },
    itemIds: [{ type: String }],
    servedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

// Auto-delete after 7 days so the collection stays lean
RecentRecommendationSchema.index({ servedAt: 1 }, { expireAfterSeconds: 7 * 24 * 3600 });
// Fast lookup by user
RecentRecommendationSchema.index({ userId: 1, servedAt: -1 });

module.exports = mongoose.model('RecentRecommendation', RecentRecommendationSchema);
