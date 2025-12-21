const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const chatHistorySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  conversationId: {
    type: String,
    required: true,
    index: true,
  },
  title: {
    type: String,
    default: 'New Chat',
  },
  messages: [messageSchema],
  coachName: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
});

// Compound index for efficient queries
chatHistorySchema.index({ userId: 1, conversationId: 1 }, { unique: true });

module.exports = mongoose.model('ChatHistory', chatHistorySchema);
