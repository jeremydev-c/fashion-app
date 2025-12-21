const mongoose = require('mongoose');

const UserPreferencesSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    preferredColors: [{ type: String }],
    preferredStyles: [{ type: String }],
    avoidedColors: [{ type: String }],
    avoidedCombinations: [{ type: String }], // e.g., "red+blue", "formal+casual"
    preferredOccasions: [{ type: String }],
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


