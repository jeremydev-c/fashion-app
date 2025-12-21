const express = require('express');
const multer = require('multer');
const { uploadImage } = require('../utils/cloudinary');

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

/**
 * POST /upload/image
 * Upload image to Cloudinary with optimization
 */
router.post('/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const { removeBackground, enhance, folder } = req.body || {};

    const result = await uploadImage(req.file.buffer, folder || 'wardrobe', {
      removeBackground: removeBackground === 'true',
      enhance: enhance === 'true',
    });

    res.json({
      success: true,
      image: result,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message || 'Image upload failed' });
  }
});

/**
 * POST /upload/image-base64
 * Upload base64 image to Cloudinary
 */
router.post('/image-base64', async (req, res) => {
  try {
    const { imageBase64, removeBackground, enhance, folder } = req.body || {};

    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 is required' });
    }

    const result = await uploadImage(imageBase64, folder || 'wardrobe', {
      removeBackground: removeBackground === 'true',
      enhance: enhance === 'true',
    });

    res.json({
      success: true,
      image: result,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message || 'Image upload failed' });
  }
});

module.exports = router;

