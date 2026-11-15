import { config } from '../config/env.js';
import multer from 'multer';

export function errorHandler(err, req, res, next) {
  const reqId = req.id || 'unknown';

  // Multer errors
  if (err instanceof multer.MulterError) {
    let message = 'File upload error';
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = `File too large. Maximum allowed size is ${config.storage.maxUploadMb}MB.`;
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = `Too many files. Maximum allowed is ${config.storage.maxAttachments} files.`;
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = `Unexpected file field "${err.field}".`;
    }
    return res.status(400).json({
      success: false,
      error: {
        code: 'UPLOAD_LIMIT_EXCEEDED',
        message,
        details: err.message,
        requestId: reqId,
      }
    });
  }

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const details = {};
    for (const [key, value] of Object.entries(err.errors)) {
      details[key] = value.message;
    }
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details,
        requestId: reqId,
      }
    });
  }

  // Mongoose Cast Error (Invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_ID',
        message: `Invalid identifier format for ${err.path}`,
        requestId: reqId,
      }
    });
  }

  // Zod Validation Error
  if (err.name === 'ZodError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.errors,
        requestId: reqId,
      }
    });
  }

  // Custom App Error
  const statusCode = err.statusCode || 500;
  const code = err.code || (statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR');
  const message = (statusCode === 500 && config.isProd)
    ? 'An unexpected error occurred. Please contact support.'
    : (err.message || 'Internal server error');

  if (statusCode === 500 && !config.isTest) {
    console.error(`[ERROR] [${reqId}]`, err);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      requestId: reqId,
      ...(config.isProd ? {} : { stack: err.stack }),
    }
  });
}

