const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

class VisitorFaceService {
    constructor() {
        this.uploadsDir = path.join(__dirname, '..', 'uploads', 'visitor_faces');
        this.ensureUploadsDirectory();
    }

    async ensureUploadsDirectory() {
        try {
            await fs.access(this.uploadsDir);
        } catch (error) {
            if (error.code === 'ENOENT') {
                await fs.mkdir(this.uploadsDir, { recursive: true });
                console.log('Created visitor faces upload directory:', this.uploadsDir);
            }
        }
    }

    /**
     * Validate face image data
     * @param {string} faceImageData - Base64 encoded image data
     * @returns {Object} Validation result
     */
    validateFaceImage(faceImageData) {
        try {
            if (!faceImageData || typeof faceImageData !== 'string') {
                return {
                    valid: false,
                    error: 'Face image data is required and must be a string'
                };
            }

            // Check if it's a valid base64 image
            const base64Regex = /^data:image\/(jpeg|jpg|png|gif);base64,/;
            if (!base64Regex.test(faceImageData)) {
                return {
                    valid: false,
                    error: 'Invalid image format. Only JPEG, JPG, PNG, and GIF are supported'
                };
            }

            // Extract the base64 content
            const base64Content = faceImageData.split(',')[1];
            if (!base64Content) {
                return {
                    valid: false,
                    error: 'Invalid base64 image data'
                };
            }

            // Check file size (approximate, base64 is ~33% larger than original)
            const sizeInBytes = (base64Content.length * 3) / 4;
            const maxSizeInMB = 5;
            if (sizeInBytes > maxSizeInMB * 1024 * 1024) {
                return {
                    valid: false,
                    error: `Image size exceeds ${maxSizeInMB}MB limit`
                };
            }

            return { valid: true };
        } catch (error) {
            return {
                valid: false,
                error: 'Error validating face image: ' + error.message
            };
        }
    }

    /**
     * Save face image to disk
     * @param {string} faceImageData - Base64 encoded image data
     * @param {string} visitorId - Visitor UUID
     * @returns {Promise<string>} File path of saved image
     */
    async saveFaceImage(faceImageData, visitorId) {
        try {
            // Validate the image first
            const validation = this.validateFaceImage(faceImageData);
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            // Extract image format and base64 content
            const matches = faceImageData.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
                throw new Error('Invalid image data format');
            }

            const imageFormat = matches[1];
            const base64Content = matches[2];
            
            // Generate unique filename
            const timestamp = Date.now();
            const randomSuffix = crypto.randomBytes(4).toString('hex');
            const filename = `visitor-${visitorId}-${timestamp}-${randomSuffix}.${imageFormat}`;
            const filePath = path.join(this.uploadsDir, filename);

            // Convert base64 to buffer and save
            const imageBuffer = Buffer.from(base64Content, 'base64');
            await fs.writeFile(filePath, imageBuffer);

            // Return relative path for database storage
            return `uploads/visitor_faces/${filename}`;
        } catch (error) {
            console.error('Error saving face image:', error);
            throw new Error('Failed to save face image: ' + error.message);
        }
    }

    /**
     * Delete face image from disk
     * @param {string} imagePath - Path to the image file
     * @returns {Promise<boolean>} Success status
     */
    async deleteFaceImage(imagePath) {
        try {
            if (!imagePath) return true;

            // Construct full path
            let fullPath;
            if (path.isAbsolute(imagePath)) {
                fullPath = imagePath;
            } else {
                fullPath = path.join(__dirname, '..', imagePath);
            }

            // Check if file exists and delete
            try {
                await fs.access(fullPath);
                await fs.unlink(fullPath);
                console.log('Deleted face image:', fullPath);
                return true;
            } catch (error) {
                if (error.code === 'ENOENT') {
                    console.log('Face image file not found, already deleted:', fullPath);
                    return true;
                }
                throw error;
            }
        } catch (error) {
            console.error('Error deleting face image:', error);
            return false;
        }
    }

    /**
     * Convert base64 image to buffer for processing
     * @param {string} base64Image - Base64 encoded image
     * @returns {Buffer} Image buffer
     */
    base64ToBuffer(base64Image) {
        const base64Data = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
        return Buffer.from(base64Data, 'base64');
    }

    /**
     * Generate face descriptor from base64 image using face-api.js
     * Note: This is a placeholder for client-side processing
     * The actual face descriptor generation happens on the frontend
     * @param {string} base64Image - Base64 encoded image
     * @returns {Promise<Object>} Processing result
     */
    async generateFaceDescriptor(base64Image) {
        try {
            console.log('Processing face image for descriptor generation...');
            
            // Validate the image
            const validation = this.validateFaceImage(base64Image);
            if (!validation.valid) {
                return {
                    success: false,
                    error: validation.error
                };
            }

            // In the visitor kiosk system, face descriptors are generated
            // on the frontend using face-api.js for better performance
            // and to avoid server-side image processing overhead
            
            return {
                success: true,
                message: 'Image processed successfully. Face descriptor will be generated on frontend.',
                requiresFrontendProcessing: true
            };
            
        } catch (error) {
            console.error('Error processing face image:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Compare two face descriptors using euclidean distance
     * This mirrors the face-api.js comparison logic
     * @param {Array|Float32Array} descriptor1 - First face descriptor
     * @param {Array|Float32Array} descriptor2 - Second face descriptor
     * @param {number} threshold - Distance threshold (default: 0.6)
     * @returns {Object} Comparison result
     */
    compareFaceDescriptors(descriptor1, descriptor2, threshold = 0.6) {
        try {
            if (!descriptor1 || !descriptor2) {
                return {
                    match: false,
                    similarity: 0,
                    distance: 999,
                    error: 'Invalid face descriptors'
                };
            }

            // Convert to arrays if they're Float32Arrays
            const desc1 = Array.isArray(descriptor1) ? descriptor1 : Array.from(descriptor1);
            const desc2 = Array.isArray(descriptor2) ? descriptor2 : Array.from(descriptor2);

            if (desc1.length !== desc2.length) {
                return {
                    match: false,
                    similarity: 0,
                    distance: 999,
                    error: 'Descriptor length mismatch'
                };
            }

            // Calculate euclidean distance (same as face-api.js)
            let sum = 0;
            for (let i = 0; i < desc1.length; i++) {
                const diff = desc1[i] - desc2[i];
                sum += diff * diff;
            }
            const distance = Math.sqrt(sum);
            
            // Convert distance to similarity percentage
            const similarity = Math.max(0, (1 - distance) * 100);
            const match = distance < threshold;

            return {
                match,
                similarity,
                distance,
                threshold,
                confidence: match ? similarity : 0
            };
            
        } catch (error) {
            console.error('Error comparing face descriptors:', error);
            return {
                match: false,
                similarity: 0,
                distance: 999,
                error: error.message
            };
        }
    }

    /**
     * Clean up expired visitor face images
     * @param {number} daysOld - Delete images older than this many days (default: 30)
     * @returns {Promise<number>} Number of files deleted
     */
    async cleanupExpiredImages(daysOld = 30) {
        try {
            const files = await fs.readdir(this.uploadsDir);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);
            
            let deletedCount = 0;

            for (const file of files) {
                const filePath = path.join(this.uploadsDir, file);
                const stats = await fs.stat(filePath);
                
                if (stats.mtime < cutoffDate) {
                    await fs.unlink(filePath);
                    deletedCount++;
                    console.log('Cleaned up expired visitor image:', file);
                }
            }

            return deletedCount;
        } catch (error) {
            console.error('Error cleaning up expired images:', error);
            return 0;
        }
    }

    /**
     * Get image file info
     * @param {string} imagePath - Path to the image
     * @returns {Promise<Object>} Image file information
     */
    async getImageInfo(imagePath) {
        try {
            let fullPath;
            if (path.isAbsolute(imagePath)) {
                fullPath = imagePath;
            } else {
                fullPath = path.join(__dirname, '..', imagePath);
            }

            const stats = await fs.stat(fullPath);
            return {
                exists: true,
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime,
                path: imagePath
            };
        } catch (error) {
            return {
                exists: false,
                error: error.message,
                path: imagePath
            };
        }
    }
}

module.exports = VisitorFaceService;
