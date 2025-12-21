const mongoose = require('mongoose');

const PlannedOutfitSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    /** YYYY-MM-DD string so we can easily group by day */
    date: { type: String, required: true, index: true },
    title: { type: String },
    occasion: { type: String },
    timeOfDay: { type: String }, // morning / afternoon / evening / night
    itemIds: [{ type: String, required: true }],
    notes: { type: String },
  },
  {
    timestamps: true,
  },
);

PlannedOutfitSchema.index({ userId: 1, date: 1, createdAt: -1 });

module.exports = mongoose.model('PlannedOutfit', PlannedOutfitSchema);



