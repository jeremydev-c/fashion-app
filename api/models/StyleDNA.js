const mongoose = require('mongoose');

const StyleDNASchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    // Style preferences
    primaryStyle: { type: String }, // minimalist, maximalist, casual, formal, etc.
    secondaryStyles: [{ type: String }],
    styleEvolution: [
      {
        date: { type: Date, default: Date.now },
        style: { type: String },
        score: { type: Number },
      },
    ],
    // Color analysis
    colorPreferences: {
      dominantColors: [{ color: String, percentage: Number }],
      colorPalette: [{ type: String }],
      seasonalColors: {
        spring: [{ type: String }],
        summer: [{ type: String }],
        fall: [{ type: String }],
        winter: [{ type: String }],
      },
    },
    // Brand affinity
    brandAffinity: [
      {
        brand: { type: String },
        count: { type: Number, default: 0 },
        score: { type: Number, min: 0, max: 1 },
      },
    ],
    // Category distribution
    categoryDistribution: {
      top: { type: Number, default: 0 },
      bottom: { type: Number, default: 0 },
      dress: { type: Number, default: 0 },
      shoes: { type: Number, default: 0 },
      outerwear: { type: Number, default: 0 },
      accessory: { type: Number, default: 0 },
    },
    // Rich AI-generated identity fields
    styleArchetype: { type: String }, // e.g. "The Polished Minimalist"
    styleMantra: { type: String },    // e.g. "Quiet confidence in every perfectly chosen piece"
    styleInsight: { type: String },   // 2-sentence personalized style narrative
    capsuleEssentials: [{ type: String }], // 3 items to complete the wardrobe
    // Style metrics
    uniquenessScore: { type: Number, min: 0, max: 1, default: 0 },
    trendAlignment: { type: Number, min: 0, max: 1, default: 0 },
    styleConsistency: { type: Number, min: 0, max: 1, default: 0 },
    // Item count at last calculation (for smart cache invalidation)
    itemCountAtCalculation: { type: Number, default: 0 },
    // Calculated at
    lastCalculated: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  },
);


module.exports = mongoose.model('StyleDNA', StyleDNASchema);

