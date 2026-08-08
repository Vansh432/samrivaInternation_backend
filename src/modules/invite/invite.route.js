import { Router } from 'express';
import { inviteLanding } from './invite.controller.js';

const router = Router();

router.get('/', inviteLanding);

export default router;
