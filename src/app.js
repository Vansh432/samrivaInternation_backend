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
import bonusesRoutes from './modules/bonuses/bonuses.route.js';
import walletRoutes from './modules/wallets/wallets.route.js';
import ranksRoutes from './modules/ranks/ranks.route.js';
import overridesRoutes from './modules/overrides/overrides.route.js';
import cronRoutes from './modules/cron/cron.route.js';
import { requestLogger } from './middleware/requestLogger.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { UPLOAD_ROOT } from './middleware/upload.js';
// TESTING MODE ONLY — see middleware/testingAutoProcess.js and config/env.js#testingMode.
// Remove this import + the two testingAutoProcess(...) middlewares below to fully revert.
import { testingAutoProcess } from './middleware/testingAutoProcess.js';
import { processInvestmentReturns } from './scheduler/investmentReturns.cron.js';
import { processRankRecalculation } from './scheduler/rankRecalculation.cron.js';
import { processRankBenefits } from './scheduler/rankBenefits.cron.js';
import { processFastStartSettlement } from './scheduler/fastStartSettlement.cron.js';
import { processOverrideSettlement } from './scheduler/overrideSettlement.cron.js';
import { processCommissionSettlement } from './scheduler/commissionSettlement.cron.js';

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
app.use('/api/investments', testingAutoProcess([processInvestmentReturns]), investmentsRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/bonuses', testingAutoProcess([processFastStartSettlement]), bonusesRoutes);
app.use('/api/wallet', testingAutoProcess([processCommissionSettlement]), walletRoutes);
app.use('/api/ranks', testingAutoProcess([processRankRecalculation, processRankBenefits]), ranksRoutes);
app.use('/api/overrides', testingAutoProcess([processOverrideSettlement]), overridesRoutes);
app.use('/api/cron', cronRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
