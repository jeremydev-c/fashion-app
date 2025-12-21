const express = require('express');
const User = require('../models/User');
const UserPreferences = require('../models/UserPreferences');
const { generateToken, authenticate } = require('../middleware/auth');
const { sendVerificationEmail, generateVerificationCode } = require('../utils/email');

const router = express.Router();

// POST /auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      // If user exists but not verified, resend code
      if (!existingUser.isVerified) {
        const code = generateVerificationCode();
        existingUser.verificationCode = code;
        existingUser.verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
        await existingUser.save();

        await sendVerificationEmail(existingUser.email, code, existingUser.name);

        return res.status(200).json({
          message: 'Verification code resent',
          requiresVerification: true,
          email: existingUser.email,
        });
      }
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Generate verification code
    const verificationCode = generateVerificationCode();

    // Create user (unverified)
    const user = await User.create({
      email: email.toLowerCase(),
      password,
      name,
      isVerified: false,
      verificationCode,
      verificationCodeExpires: new Date(Date.now() + 10 * 60 * 1000), // 10 min
    });

    // Send verification email
    const emailResult = await sendVerificationEmail(user.email, verificationCode, name);

    if (!emailResult.success) {
      console.error('Failed to send verification email:', emailResult.error);
      // Still allow signup, but warn
    }

    res.status(201).json({
      message: 'Account created. Please verify your email.',
      requiresVerification: true,
      email: user.email,
    });
  } catch (err) {
    console.error('POST /auth/signup error', err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// POST /auth/verify
router.post('/verify', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    if (user.verificationCode !== code) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    if (user.verificationCodeExpires < new Date()) {
      return res.status(400).json({ error: 'Verification code expired' });
    }

    // Verify user
    user.isVerified = true;
    user.verificationCode = null;
    user.verificationCodeExpires = null;
    await user.save();

    // Create default preferences for the user
    await UserPreferences.create({
      userId: user._id.toString(),
      preferredColors: [],
      preferredStyles: [],
      avoidedColors: [],
      avoidedCombinations: [],
      preferredOccasions: [],
      feedbackCount: 0,
      onboardingCompleted: false,
    });

    // Generate token
    const token = generateToken(user._id);

    res.json({
      message: 'Email verified successfully',
      user: user.toJSON(),
      token,
    });
  } catch (err) {
    console.error('POST /auth/verify error', err);
    res.status(500).json({ error: 'Failed to verify email' });
  }
});

// POST /auth/resend-code
router.post('/resend-code', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    // Generate new code
    const code = generateVerificationCode();
    user.verificationCode = code;
    user.verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    // Send email
    await sendVerificationEmail(user.email, code, user.name);

    res.json({ message: 'Verification code sent' });
  } catch (err) {
    console.error('POST /auth/resend-code error', err);
    res.status(500).json({ error: 'Failed to resend code' });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if verified
    if (!user.isVerified) {
      // Resend verification code
      const code = generateVerificationCode();
      user.verificationCode = code;
      user.verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();

      await sendVerificationEmail(user.email, code, user.name);

      return res.status(403).json({
        error: 'Please verify your email first',
        requiresVerification: true,
        email: user.email,
      });
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({
      message: 'Login successful',
      user: user.toJSON(),
      token,
    });
  } catch (err) {
    console.error('POST /auth/login error', err);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// GET /auth/me - Get current user
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: user.toJSON() });
  } catch (err) {
    console.error('GET /auth/me error', err);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// PUT /auth/me - Update current user
router.put('/me', authenticate, async (req, res) => {
  try {
    const { name, username, avatar, profilePictureBase64 } = req.body;
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update name
    if (name !== undefined) user.name = name;
    
    // Update username (with validation)
    if (username !== undefined) {
      // Check if username is already taken by another user
      if (username && username !== user.username) {
        const existingUser = await User.findOne({ username: username.toLowerCase() });
        if (existingUser && existingUser._id.toString() !== req.userId) {
          return res.status(400).json({ error: 'Username is already taken' });
        }
        user.username = username.toLowerCase().trim();
      } else if (username === '') {
        user.username = undefined; // Allow clearing username
      }
    }

    // Handle profile picture upload (base64)
    if (profilePictureBase64) {
      try {
        const { uploadImage } = require('../utils/cloudinary');
        const result = await uploadImage(profilePictureBase64, 'profiles', {
          transformation: {
            width: 400,
            height: 400,
            crop: 'fill',
            gravity: 'face',
            quality: 'auto',
            format: 'auto',
          },
        });
        user.avatar = result.url;
      } catch (uploadError) {
        console.error('Profile picture upload error:', uploadError);
        return res.status(500).json({ error: 'Failed to upload profile picture' });
      }
    } else if (avatar !== undefined) {
      // Allow direct URL assignment (for external URLs)
      user.avatar = avatar;
    }

    await user.save();

    res.json({ user: user.toJSON() });
  } catch (err) {
    console.error('PUT /auth/me error', err);
    // Handle duplicate username error
    if (err.code === 11000 && err.keyPattern?.username) {
      return res.status(400).json({ error: 'Username is already taken' });
    }
    res.status(500).json({ error: 'Failed to update user' });
  }
});

module.exports = router;
