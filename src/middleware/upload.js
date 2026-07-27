import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { AppError } from '../shared/errors/AppError.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// backend/uploads — outside src/, alongside the project's other top-level dirs (logs/, etc).
export const UPLOAD_ROOT = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_ROOT)) fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_ROOT),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new AppError('Only image uploads are allowed', 400));
  }
  cb(null, true);
};

// Reusable anywhere a single image needs uploading — payment proof, KYC documents, etc.
export const uploadImage = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});
