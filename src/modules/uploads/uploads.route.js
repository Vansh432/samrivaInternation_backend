import { Router } from 'express';
import { uploadFile } from './uploads.controller.js';
import { uploadImage } from '../../middleware/upload.js';
import { protect } from '../../middleware/auth.js';

const router = Router();

router.use(protect);
router.post('/', uploadImage.single('file'), uploadFile);

export default router;
