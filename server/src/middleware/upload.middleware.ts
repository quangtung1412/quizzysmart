/**
 * Upload Middleware
 * 
 * Multer configuration for PDF file uploads
 * Max 10 files, 50MB each
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_DIR || './uploads/documents';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp_originalname
    const timestamp = Date.now();
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const filename = `${timestamp}_${sanitizedName}`;
    cb(null, filename);
  },
});

// File filter: only PDFs
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Chỉ cho phép upload file PDF'));
  }
};

// Multer configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 10, // Max 10 files per request
  },
});

// Export middleware
export const uploadDocuments = upload.array('documents', 10);

/**
 * Error handler middleware for multer errors
 */
export const handleUploadError = (error: any, req: Request, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File quá lớn. Kích thước tối đa là 50MB.',
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Quá nhiều file. Tối đa 10 files mỗi lần upload.',
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: 'Tên field không đúng. Sử dụng field "documents".',
      });
    }
  }

  if (error.message === 'Chỉ cho phép upload file PDF') {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }

  // Other errors
  next(error);
};
