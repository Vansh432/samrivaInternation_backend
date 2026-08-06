import { Router } from 'express';
import * as cronController from './cron.controller.js';
import { verifyCronSecret } from '../../middleware/cronAuth.js';

const router = Router();

router.post('/run', verifyCronSecret, cronController.runAll);

export default router;
