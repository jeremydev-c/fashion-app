const mongoose = require('mongoose');

const FollowSchema = new mongoose.Schema(
  {
    followerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    followingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Unique compound index prevents duplicate follows
FollowSchema.index({ followerId: 1, followingId: 1 }, { unique: true });
// Efficient "get all followers of user X" query
FollowSchema.index({ followingId: 1 });
// Efficient "get everyone user X follows" query
FollowSchema.index({ followerId: 1 });

module.exports = mongoose.model('Follow', FollowSchema);
