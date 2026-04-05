const mongoose = require('mongoose');

const UserPreferencesSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },

    // Core preferences (from onboarding + learned)
    preferredColors: [{ type: String }],
    preferredStyles: [{ type: String }],
    avoidedColors: [{ type: String }],
    avoidedCombinations: [{ type: String }],
    preferredOccasions: [{ type: String }],

    // Learned from interactions
    preferredCategories: [{ type: String }],
    preferredPatterns: [{ type: String }],
    avoidedStyles: [{ type: String }],

    // Weighted scores learned over time (color -> weight, style -> weight, etc.)
    colorWeights: { type: Map, of: Number, default: {} },
    styleWeights: { type: Map, of: Number, default: {} },
    categoryWeights: { type: Map, of: Number, default: {} },
    patternWeights: { type: Map, of: Number, default: {} },
    occasionWeights: { type: Map, of: Number, default: {} },
    timeWeights: { type: Map, of: Number, default: {} },

    // Per-occasion learned preferences
    occasionPreferences: {
      type: Map,
      of: new mongoose.Schema({
        preferredColors: [String],
        preferredStyles: [String],
        preferredCategories: [String],
        positiveCount: { type: Number, default: 0 },
        negativeCount: { type: Number, default: 0 },
      }, { _id: false }),
      default: {},
    },

    // Profile
    bodyType: { type: String },
    ageRange: { type: String },
    onboardingCompleted: { type: Boolean, default: false },
    feedbackCount: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('UserPreferences', UserPreferencesSchema);


