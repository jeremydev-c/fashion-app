const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

// Lazy configuration - ensures env vars are loaded
function ensureConfigured() {
  if (!cloudinary.config().api_key) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    
    // Validate configuration
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      throw new Error('Cloudinary credentials missing. Please check your .env file has CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET');
    }
  }
}

/**
 * Upload image to Cloudinary with optimization
 * @param {Buffer|string} imageData - Image buffer or base64 string
 * @param {string} folder - Folder path in Cloudinary
 * @param {Object} options - Additional upload options
 * @returns {Promise<Object>} Upload result with URL and public_id
 */
async function uploadImage(imageData, folder = 'wardrobe', options = {}) {
  ensureConfigured(); // Ensure Cloudinary is configured before use
  try {
    const uploadOptions = {
      folder: `fashion-fit/${folder}`,
      resource_type: 'image',
      // Auto-optimize images
      // Use fetch_format for automatic format negotiation instead of format: 'auto'
      quality: 'auto:good', // Auto quality optimization
      fetch_format: 'auto',
      // Generate responsive images
      transformation: [
        {
          width: 800,
          height: 800,
          crop: 'limit',
          quality: 'auto:good',
        },
      ],
      // Background removal (if needed)
      ...(options.removeBackground && {
        background_removal: 'cloudinary_ai',
      }),
      // Image enhancement
      ...(options.enhance && {
        effect: 'improve',
      }),
      ...options,
    };

    let uploadResult;
    
    if (Buffer.isBuffer(imageData)) {
      // Upload from buffer
      const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
        if (error) throw error;
        uploadResult = result;
      });
      
      const readable = new Readable();
      readable.push(imageData);
      readable.push(null);
      readable.pipe(stream);
      
      // Wait for upload to complete
      await new Promise((resolve, reject) => {
        stream.on('end', resolve);
        stream.on('error', reject);
      });
    } else if (typeof imageData === 'string') {
      // Upload from base64 or URL
      if (imageData.startsWith('data:')) {
        // Base64 data URL
        uploadResult = await cloudinary.uploader.upload(imageData, uploadOptions);
      } else if (imageData.startsWith('http')) {
        // Remote URL
        uploadResult = await cloudinary.uploader.upload(imageData, uploadOptions);
      } else {
        // Assume base64 string
        uploadResult = await cloudinary.uploader.upload(
          `data:image/jpeg;base64,${imageData}`,
          uploadOptions
        );
      }
    } else {
      throw new Error('Invalid image data type');
    }

    return {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      width: uploadResult.width,
      height: uploadResult.height,
      format: uploadResult.format,
      bytes: uploadResult.bytes,
      // Generate thumbnail URL
      thumbnailUrl: cloudinary.url(uploadResult.public_id, {
        width: 300,
        height: 300,
        crop: 'fill',
        quality: 'auto:good',
        fetch_format: 'auto',
      }),
      // Generate medium size URL
      mediumUrl: cloudinary.url(uploadResult.public_id, {
        width: 600,
        height: 600,
        crop: 'limit',
        quality: 'auto:good',
        fetch_format: 'auto',
      }),
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error(`Image upload failed: ${error.message}`);
  }
}

/**
 * Delete image from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<Object>} Deletion result
 */
async function deleteImage(publicId) {
  ensureConfigured(); // Ensure Cloudinary is configured before use
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new Error(`Image deletion failed: ${error.message}`);
  }
}

/**
 * Generate optimized image URL with transformations
 * @param {string} publicId - Cloudinary public ID
 * @param {Object} transformations - Transformation options
 * @returns {string} Optimized image URL
 */
function getOptimizedUrl(publicId, transformations = {}) {
  ensureConfigured(); // Ensure Cloudinary is configured before use
  const defaultTransformations = {
    quality: 'auto:good',
    fetch_format: 'auto',
    ...transformations,
  };
  
  return cloudinary.url(publicId, defaultTransformations);
}

module.exports = {
  uploadImage,
  deleteImage,
  getOptimizedUrl,
  cloudinary,
};

