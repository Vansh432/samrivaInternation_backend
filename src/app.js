import express from 'express';
import cors from 'cors';

import authRoutes from './modules/auth/auth.route.js';
import userRoutes from './modules/users/users.route.js';
import adminRoutes from './modules/admin/admin.route.js';
import plansRoutes from './modules/plans/plans.route.js';
import settingsRoutes from './modules/settings/settings.route.js';
import investmentsRoutes from './modules/investments/investments.route.js';
import uploadsRoutes from './modules/uploads/uploads.route.js';
import teamRoutes from './modules/team/team.route.js';
import { requestLogger } from './middleware/requestLogger.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { UPLOAD_ROOT } from './middleware/upload.js';

const app = express();

// Behind Render's proxy, req.protocol would otherwise report 'http' even over HTTPS —
// this keeps uploaded-file URLs (built from req.protocol) correct in production.
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());
app.use(requestLogger);
app.use('/uploads', express.static(UPLOAD_ROOT));
app.get('/',(req,res)=>{
    return res.status(200).json({status:true,message:"Server is running"})
})
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/investments', investmentsRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/team', teamRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
