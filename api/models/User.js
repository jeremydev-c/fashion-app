const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      unique: true,
      sparse: true, // Allow null values but ensure uniqueness when set
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9_]+$/, 'Username can only contain lowercase letters, numbers, and underscores'],
      minlength: 3,
      maxlength: 30,
    },
    avatar: {
      type: String,
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationCode: {
      type: String,
      default: null,
    },
    verificationCodeExpires: {
      type: Date,
      default: null,
    },
    onboardingCompleted: {
      type: Boolean,
      default: false,
    },
    subscription: {
      planId: {
        type: String,
        default: 'free',
        enum: ['free', 'pro', 'pro-yearly', 'elite'],
      },
      status: {
        type: String,
        default: 'active',
        enum: ['active', 'cancelled', 'expired', 'attention', 'non-renewing'],
      },
      currentPeriodEnd: {
        type: Date,
        default: null,
      },
      paystackCustomerCode: {
        type: String,
        default: null,
      },
      paystackSubscriptionCode: {
        type: String,
        default: null,
      },
      paystackReference: {
        type: String,
        default: null,
      },
    },
    pushToken: {
      type: String,
      default: null,
    },
    pushPlatform: {
      type: String,
      enum: ['ios', 'android', null],
      default: null,
    },
    notificationsEnabled: {
      type: Boolean,
      default: true,
    },
    utcOffset: {
      type: Number,
      default: null,  // hours from UTC (e.g. 3 for EAT, -5 for EST). Null = unknown
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
    // ── Social profile ────────────────────────────────────────────────────────
    bio: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },
    isCreator: {
      type: Boolean,
      default: false,
    },
    followersCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    followingCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
UserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', UserSchema);

