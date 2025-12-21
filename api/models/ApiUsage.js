const mongoose = require('mongoose');

const ApiUsageSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      default: Date.now,
      required: true,
    },
    service: {
      type: String,
      enum: ['openai', 'cloudinary'],
      required: true,
    },
    operation: {
      type: String,
      required: true, // e.g., 'categorize-image', 'chat', 'style-dna', 'upload'
    },
    tokens: {
      prompt: { type: Number, default: 0 },
      completion: { type: Number, default: 0 },
    },
    cost: {
      type: Number,
      default: 0, // Cost in USD
    },
    model: {
      type: String, // e.g., 'gpt-4o', 'gpt-4o-mini'
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
ApiUsageSchema.index({ date: 1, service: 1 });
ApiUsageSchema.index({ service: 1, operation: 1 });

module.exports = mongoose.model('ApiUsage', ApiUsageSchema);

