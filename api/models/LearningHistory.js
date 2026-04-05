const mongoose = require('mongoose');

/**
 * Learning History - Tracks every interaction for continuous learning
 */
const LearningHistorySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    interactionType: {
      type: String,
      enum: ['view', 'swipe_left', 'swipe_right', 'save', 'reject', 'rate', 'regenerate', 'refine', 'saved', 'rejected', 'rated'],
      required: true,
    },
    recommendationId: { type: String },
    itemIds: [{ type: String }],
    occasion: { type: String },
    timeOfDay: { type: String },
    weather: { type: String },
    rating: { type: Number, min: 1, max: 5 },
    confidence: { type: Number }, // AI confidence score
    sessionId: { type: String }, // Track user sessions
    timestamp: { type: Date, default: Date.now, index: true },
    metadata: {
      colors: [{ type: String }],
      styles: [{ type: String }],
      categories: [{ type: String }],
      patterns: [{ type: String }],
    },
  },
  {
    timestamps: true,
  },
);

// Index for fast queries
LearningHistorySchema.index({ userId: 1, timestamp: -1 });
LearningHistorySchema.index({ userId: 1, interactionType: 1 });

module.exports = mongoose.model('LearningHistory', LearningHistorySchema);

