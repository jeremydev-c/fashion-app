const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    caption: {
      type: String,
      trim: true,
      maxlength: 300,
      default: '',
    },
    outfitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Outfit',
      default: null,
    },
    tags: [{ type: String, trim: true, lowercase: true, maxlength: 30 }],
    likesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Compound index: user's posts newest-first (profile page)
PostSchema.index({ userId: 1, createdAt: -1 });
// Feed sort (cursor-based on _id = implicit time order)
PostSchema.index({ createdAt: -1 });
// Explore: public posts newest-first
PostSchema.index({ isPublic: 1, createdAt: -1 });

module.exports = mongoose.model('Post', PostSchema);
