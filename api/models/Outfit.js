const mongoose = require('mongoose');

const OutfitSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    items: [
      {
        itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClothingItem', required: true },
        category: { type: String, required: true }, // top, bottom, shoes, etc.
      },
    ],
    occasion: { type: String }, // casual, formal, work, party, date, travel, sports
    season: { type: String }, // spring, summer, fall, winter
    weather: { type: String }, // hot, warm, cool, cold, rainy
    rating: { type: Number, min: 0, max: 5, default: 0 },
    wearCount: { type: Number, default: 0 },
    lastWorn: { type: Date },
    favorite: { type: Boolean, default: false },
    imageUrl: { type: String }, // Optional outfit photo
    tags: [{ type: String }],
    // AI analysis
    aiAnalysis: {
      styleScore: { type: Number, min: 0, max: 1 },
      colorHarmony: { type: Number, min: 0, max: 1 },
      compatibilityScore: { type: Number, min: 0, max: 1 },
      suggestions: [{ type: String }],
    },
  },
  {
    timestamps: true,
  },
);

OutfitSchema.index({ userId: 1, favorite: -1, updatedAt: -1 });
OutfitSchema.index({ userId: 1, occasion: 1 });
OutfitSchema.index({ userId: 1, season: 1 });

module.exports = mongoose.model('Outfit', OutfitSchema);

