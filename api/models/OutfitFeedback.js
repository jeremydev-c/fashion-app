const mongoose = require('mongoose');

const OutfitFeedbackSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    outfitId: { type: String, required: true }, // Unique ID for this outfit suggestion
    itemIds: [{ type: String }], // Array of ClothingItem _ids in this outfit
    occasion: { type: String },
    timeOfDay: { type: String },
    action: {
      type: String,
      enum: ['saved', 'rejected', 'rated'],
      required: true,
    },
    rating: { type: Number, min: 1, max: 5 },
  },
  {
    timestamps: true,
  },
);

OutfitFeedbackSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('OutfitFeedback', OutfitFeedbackSchema);


