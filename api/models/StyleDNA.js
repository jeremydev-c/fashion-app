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
        scores: {
          uniqueness: { type: Number },
          consistency: { type: Number },
          trend: { type: Number },
        },
        itemCount: { type: Number },
      },
    ],
    // Color analysis
    colorPreferences: {
      dominantColors: [{ color: String, name: String, percentage: Number, hex: String }],
      colorPalette: [{ type: String }],
      colorDiversity: { type: Number, min: 0, max: 1, default: 0 }, // how varied the palette is
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
    // Wardrobe balance analysis
    wardrobeBalance: {
      totalItems: { type: Number, default: 0 },
      gaps: [{ type: String }],           // categories that are underrepresented
      strengths: [{ type: String }],      // categories that are strong
      versatilityScore: { type: Number, min: 0, max: 1, default: 0 }, // how many occasions covered
      completenessScore: { type: Number, min: 0, max: 1, default: 0 }, // all categories represented
    },
    // Semantic style axes (averaged from clothing item semanticProfile.axes)
    semanticAxes: {
      formality: { type: Number, min: 0, max: 1 },
      structure: { type: Number, min: 0, max: 1 },
      texture: { type: Number, min: 0, max: 1 },
      boldness: { type: Number, min: 0, max: 1 },
      softness: { type: Number, min: 0, max: 1 },
      warmth: { type: Number, min: 0, max: 1 },
      polish: { type: Number, min: 0, max: 1 },
      ruggedness: { type: Number, min: 0, max: 1 },
      minimalism: { type: Number, min: 0, max: 1 },
      versatility: { type: Number, min: 0, max: 1 },
    },
    // Pattern analysis
    patternBreakdown: [
      {
        pattern: { type: String },
        count: { type: Number },
        percentage: { type: Number },
      },
    ],
    // Occasion coverage
    occasionCoverage: [
      {
        occasion: { type: String },
        itemCount: { type: Number },
        percentage: { type: Number },
      },
    ],
    // Wear behavior insights
    wearBehavior: {
      mostWornItems: [{ type: String }],   // item names
      avgWearCount: { type: Number, default: 0 },
      favoritesRatio: { type: Number, min: 0, max: 1, default: 0 }, // % of items marked favorite
      activeItemsRatio: { type: Number, min: 0, max: 1, default: 0 }, // % items worn in last 30 days
      neglectedCount: { type: Number, default: 0 }, // items never worn
    },
    // Feedback-driven insights
    feedbackProfile: {
      totalFeedback: { type: Number, default: 0 },
      avgRating: { type: Number, default: 0 },
      preferredOccasions: [{ type: String }],
      saveRate: { type: Number, min: 0, max: 1, default: 0 },
      rejectRate: { type: Number, min: 0, max: 1, default: 0 },
    },
    // Rich AI-generated identity fields
    styleArchetype: { type: String }, // e.g. "The Polished Minimalist"
    styleMantra: { type: String },    // e.g. "Quiet confidence in every perfectly chosen piece"
    styleInsight: { type: String },   // 2-sentence personalized style narrative
    capsuleEssentials: [{ type: String }], // 3 items to complete the wardrobe
    stylePersonality: { type: String }, // longer personality paragraph from AI
    // Style metrics (now calculated mathematically, not guessed)
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

