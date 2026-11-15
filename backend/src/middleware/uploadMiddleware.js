import multer from 'multer';
import path from 'path';
import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  verifyFileSignature,
  sanitizeFilename,
} from '../services/storageService.js';
import { config } from '../config/env.js';

// Use memory storage so we can verify signatures before saving
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    const err = new Error(`File extension ${ext} is not allowed. Supported: .jpg, .jpeg, .png, .webp, .pdf`);
    err.statusCode = 400;
    err.code = 'INVALID_FILE_TYPE';
    return cb(err, false);
  }

  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    const err = new Error(`MIME type ${file.mimetype} is not allowed.`);
    err.statusCode = 400;
    err.code = 'INVALID_FILE_TYPE';
    return cb(err, false);
  }

  cb(null, true);
};

export const upload = multer({
  storage,
  limits: {
    fileSize: config.storage.maxUploadMb * 1024 * 1024,
    files: config.storage.maxAttachments,
  },
  fileFilter,
});

/**
 * Middleware to verify magic bytes of uploaded files.
 */
export function verifyUploadedFiles(req, res, next) {
  if (!req.files && !req.file) {
    return next();
  }

  const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [req.file];

  for (const file of files) {
    if (!verifyFileSignature(file.buffer, file.mimetype)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FILE_SIGNATURE',
          message: `File content for "${file.originalname}" does not match its declared type (${file.mimetype}). Spoofed files are rejected.`,
        }
      });
    }

    // Attach sanitized name
    file.sanitizedName = sanitizeFilename(file.originalname);
  }

  next();
}

