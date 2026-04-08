const express = require('express');
const mongoose = require('mongoose');
const { authenticate, optionalAuth, JWT_SECRET } = require('../middleware/auth');
const { sendToUser } = require('./notifications');
const Post = require('../models/Post');
const PostLike = require('../models/PostLike');
const Follow = require('../models/Follow');
const User = require('../models/User');
const { uploadImage } = require('../utils/cloudinary');

const router = express.Router();

const FEED_PAGE_SIZE = 10;
const PROFILE_GRID_SIZE = 12; // 3-col grid × 4 rows

// Fields projected for post authors — keeps response payload lean
const AUTHOR_SELECT = 'name username avatar isCreator followersCount';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Attach likedByMe: bool to each post in-place.
 * One DB query for all posts — not N queries.
 */
async function attachLikeStatus(posts, userId) {
  if (!userId || !posts.length) {
    return posts.map(p => ({ ...p, likedByMe: false }));
  }
  const postIds = posts.map(p => p._id);
  const liked = await PostLike.find({ userId, postId: { $in: postIds } })
    .select('postId')
    .lean();
  const likedSet = new Set(liked.map(l => l.postId.toString()));
  return posts.map(p => ({ ...p, likedByMe: likedSet.has(p._id.toString()) }));
}

// ── GET /social/feed ──────────────────────────────────────────────────────────
// Authenticated: posts from followed users + own, cursor-paginated (no AI calls)
router.get('/feed', authenticate, async (req, res) => {
  try {
    const { cursor, limit = FEED_PAGE_SIZE } = req.query;
    const pageSize = Math.min(Number(limit), 20);

    const follows = await Follow.find({ followerId: req.userId })
      .select('followingId')
      .lean();

    const authorIds = follows.map(f => f.followingId);
    authorIds.push(new mongoose.Types.ObjectId(req.userId));

    const query = { userId: { $in: authorIds }, isPublic: true };
    if (cursor) query._id = { $lt: new mongoose.Types.ObjectId(cursor) };

    const posts = await Post.find(query)
      .sort({ _id: -1 })
      .limit(pageSize + 1)
      .populate('userId', AUTHOR_SELECT)
      .lean();

    const hasMore = posts.length > pageSize;
    const results = hasMore ? posts.slice(0, pageSize) : posts;
    const nextCursor = hasMore ? results[results.length - 1]._id : null;

    const withLikes = await attachLikeStatus(results, req.userId);
    res.json({ posts: withLikes, nextCursor, hasMore });
  } catch (err) {
    console.error('GET /social/feed error', err);
    res.status(500).json({ error: 'Failed to load feed' });
  }
});

// ── GET /social/explore ───────────────────────────────────────────────────────
// Public: all public posts newest-first, optional auth for like status
router.get('/explore', optionalAuth, async (req, res) => {
  try {
    const { cursor, limit = FEED_PAGE_SIZE } = req.query;
    const pageSize = Math.min(Number(limit), 20);

    const query = { isPublic: true };
    if (cursor) query._id = { $lt: new mongoose.Types.ObjectId(cursor) };

    const posts = await Post.find(query)
      .sort({ _id: -1 })
      .limit(pageSize + 1)
      .populate('userId', AUTHOR_SELECT)
      .lean();

    const hasMore = posts.length > pageSize;
    const results = hasMore ? posts.slice(0, pageSize) : posts;
    const nextCursor = hasMore ? results[results.length - 1]._id : null;

    const withLikes = await attachLikeStatus(results, req.userId || null);
    res.json({ posts: withLikes, nextCursor, hasMore });
  } catch (err) {
    console.error('GET /social/explore error', err);
    res.status(500).json({ error: 'Failed to load explore' });
  }
});

// ── POST /social/posts ────────────────────────────────────────────────────────
// Create a post — image upload to Cloudinary, no AI
router.post('/posts', authenticate, async (req, res) => {
  try {
    const { imageBase64, caption, outfitId, tags } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Image is required' });
    }

    const result = await uploadImage(imageBase64, 'social_posts', {
      transformation: { width: 1080, height: 1080, crop: 'limit', quality: 'auto', format: 'auto' },
    });

    const post = await Post.create({
      userId: req.userId,
      imageUrl: result.url,
      caption: caption ? String(caption).slice(0, 300) : '',
      outfitId: outfitId || null,
      tags: Array.isArray(tags) ? tags.slice(0, 10) : [],
    });

    const populated = await Post.findById(post._id)
      .populate('userId', AUTHOR_SELECT)
      .lean();

    res.status(201).json({ post: { ...populated, likedByMe: false } });
  } catch (err) {
    console.error('POST /social/posts error', err);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// ── DELETE /social/posts/:id ──────────────────────────────────────────────────
router.delete('/posts/:id', authenticate, async (req, res) => {
  try {
    const post = await Post.findOne({ _id: req.params.id, userId: req.userId });
    if (!post) return res.status(404).json({ error: 'Post not found' });

    await Post.deleteOne({ _id: post._id });
    // Clean up likes non-blocking
    PostLike.deleteMany({ postId: post._id }).catch(() => {});

    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /social/posts/:id error', err);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// ── POST /social/posts/:id/like ───────────────────────────────────────────────
// Toggle like — atomic $inc, no recounting
router.post('/posts/:id/like', authenticate, async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.userId;

    const existing = await PostLike.findOne({ postId, userId });

    if (existing) {
      await PostLike.deleteOne({ _id: existing._id });
      const updated = await Post.findByIdAndUpdate(
        postId,
        { $inc: { likesCount: -1 } },
        { new: true, select: 'likesCount' }
      ).lean();
      return res.json({ liked: false, likesCount: Math.max(0, updated?.likesCount ?? 0) });
    }

    await PostLike.create({ postId, userId });
    const updated = await Post.findByIdAndUpdate(
      postId,
      { $inc: { likesCount: 1 } },
      { new: true, select: 'likesCount userId' }
    ).lean();
    // Non-blocking — notify post owner, skip if liking own post
    if (updated?.userId && updated.userId.toString() !== userId) {
      sendToUser(updated.userId, {
        title: '❤️ New like',
        body: 'Someone liked your outfit post',
        data: { screen: 'Social' },
        channelId: 'default',
      }).catch(() => {});
    }
    return res.json({ liked: true, likesCount: updated?.likesCount ?? 1 });
  } catch (err) {
    // Race condition on unique index: already liked — return current state
    if (err.code === 11000) {
      const post = await Post.findById(req.params.id).select('likesCount').lean();
      return res.json({ liked: true, likesCount: post?.likesCount ?? 0 });
    }
    console.error('POST /social/posts/:id/like error', err);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// ── GET /social/users/:userId ─────────────────────────────────────────────────
// Public profile — optional auth for isFollowing status
router.get('/users/:userId', optionalAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('name username avatar bio isCreator followersCount followingCount createdAt')
      .lean();

    if (!user) return res.status(404).json({ error: 'User not found' });

    let isFollowing = false;
    if (req.userId && req.userId !== req.params.userId) {
      const f = await Follow.findOne({
        followerId: req.userId,
        followingId: req.params.userId,
      }).lean();
      isFollowing = !!f;
    }

    const postsCount = await Post.countDocuments({ userId: req.params.userId, isPublic: true });

    res.json({ user: { ...user, postsCount, isFollowing } });
  } catch (err) {
    console.error('GET /social/users/:userId error', err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// ── GET /social/users/:userId/posts ──────────────────────────────────────────
// Profile post grid — cursor-paginated, image + likes only (lean payload)
router.get('/users/:userId/posts', async (req, res) => {
  try {
    const { cursor, limit = PROFILE_GRID_SIZE } = req.query;
    const pageSize = Math.min(Number(limit), 30);

    const query = { userId: req.params.userId, isPublic: true };
    if (cursor) query._id = { $lt: new mongoose.Types.ObjectId(cursor) };

    const posts = await Post.find(query)
      .sort({ _id: -1 })
      .limit(pageSize + 1)
      .select('imageUrl likesCount caption createdAt')
      .lean();

    const hasMore = posts.length > pageSize;
    const results = hasMore ? posts.slice(0, pageSize) : posts;
    const nextCursor = hasMore ? results[results.length - 1]._id : null;

    res.json({ posts: results, nextCursor, hasMore });
  } catch (err) {
    console.error('GET /social/users/:userId/posts error', err);
    res.status(500).json({ error: 'Failed to load posts' });
  }
});

// ── POST /social/follow/:userId ───────────────────────────────────────────────
// Toggle follow/unfollow — atomic $inc on both users
router.post('/follow/:userId', authenticate, async (req, res) => {
  try {
    const followingId = req.params.userId;
    const followerId = req.userId;

    if (followerId === followingId) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    const targetExists = await User.findById(followingId).select('_id').lean();
    if (!targetExists) return res.status(404).json({ error: 'User not found' });

    const existing = await Follow.findOne({ followerId, followingId });

    if (existing) {
      await Follow.deleteOne({ _id: existing._id });
      await User.findByIdAndUpdate(followingId, { $inc: { followersCount: -1 } });
      await User.findByIdAndUpdate(followerId, { $inc: { followingCount: -1 } });
      return res.json({ following: false });
    }

    await Follow.create({ followerId, followingId });
    await Promise.all([
      User.findByIdAndUpdate(followingId, { $inc: { followersCount: 1 } }),
      User.findByIdAndUpdate(followerId, { $inc: { followingCount: 1 } }),
    ]);
    // Non-blocking — fetch follower name then notify the followed user
    User.findById(followerId).select('name').lean()
      .then(f => sendToUser(followingId, {
        title: '👤 New follower',
        body: `${f?.name ?? 'Someone'} started following you`,
        data: { screen: 'PublicProfile', userId: followerId },
        channelId: 'default',
      }))
      .catch(() => {});
    return res.json({ following: true });
  } catch (err) {
    if (err.code === 11000) {
      return res.json({ following: true });
    }
    console.error('POST /social/follow/:userId error', err);
    res.status(500).json({ error: 'Failed to toggle follow' });
  }
});

// ── GET /social/search ────────────────────────────────────────────────────────
// Search users by name or username — no AI, pure DB regex
// Industry practices: min 2 chars enforced server-side, results capped at 20
router.get('/search', optionalAuth, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();

    if (q.length < 2) {
      return res.json({ users: [] }); // reject short queries — saves DB round-trip
    }
    if (q.length > 50) {
      return res.status(400).json({ error: 'Query too long' });
    }

    // Escape special regex chars to prevent ReDoS
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');

    const users = await User.find({
      isVerified: true,
      $or: [{ name: regex }, { username: regex }],
    })
      .select('name username avatar isCreator followersCount')
      .limit(20)
      .lean();

    res.json({ users });
  } catch (err) {
    console.error('GET /social/search error', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ── PUT /social/profile ───────────────────────────────────────────────────────
// Update bio and/or creator status for the authenticated user
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { bio, isCreator } = req.body;
    const update = {};
    if (bio !== undefined) update.bio = String(bio).slice(0, 200);
    if (isCreator !== undefined) update.isCreator = Boolean(isCreator);

    await User.findByIdAndUpdate(req.userId, update);
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /social/profile error', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
