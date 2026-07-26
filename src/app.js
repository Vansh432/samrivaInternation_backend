import express from 'express';
import cors from 'cors';

import authRoutes from './modules/auth/auth.route.js';
import userRoutes from './modules/users/users.route.js';
import adminRoutes from './modules/admin/admin.route.js';
import plansRoutes from './modules/plans/plans.route.js';
import settingsRoutes from './modules/settings/settings.route.js';
import investmentsRoutes from './modules/investments/investments.route.js';
import { requestLogger } from './middleware/requestLogger.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(requestLogger);
app.get('/',(req,res)=>{
    return res.status(200).json({status:true,message:"Server is running"})
})
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/investments', investmentsRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
