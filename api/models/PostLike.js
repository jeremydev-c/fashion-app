const mongoose = require('mongoose');

const PostLikeSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Unique compound index prevents double-likes at the DB level
PostLikeSchema.index({ postId: 1, userId: 1 }, { unique: true });
// Allows efficient "did this user like this post?" lookups
PostLikeSchema.index({ userId: 1, postId: 1 });

module.exports = mongoose.model('PostLike', PostLikeSchema);
