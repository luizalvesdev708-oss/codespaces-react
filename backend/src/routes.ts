import { Router } from 'express';
import { login, currentUser, logout } from './controllers/auth.controller.js';
import { calculate, dashboardData, dashboardSummary, decryptedAnalyticsExport, reportCensusRecords } from './controllers/actuarial.controller.js';
import { createCensus, listCensus } from './controllers/census.controller.js';
import { createInsuredRecord, createPersonnel, deletePersonnel, listPersonnel, updatePersonnel } from './controllers/personnel.controller.js';
import { authenticate } from './middleware/auth.js';
import { requireRoles } from './middleware/authorize.js';

export const authRouter = Router();
authRouter.post('/login', login);
authRouter.get('/session', authenticate, currentUser);
authRouter.post('/logout', logout);

export const apiRouter = Router();
apiRouter.use(authenticate);
apiRouter.get('/me', currentUser);
apiRouter.get('/dashboard', requireRoles('ADMIN', 'OPERATOR', 'AUDITOR'), dashboardSummary);
apiRouter.get('/dashboard/data', requireRoles('ADMIN', 'OPERATOR', 'AUDITOR'), dashboardData);
apiRouter.get('/reports/census-records', requireRoles('ADMIN', 'OPERATOR', 'AUDITOR'), reportCensusRecords);
apiRouter.get('/analytics/decrypted-export', requireRoles('ADMIN'), decryptedAnalyticsExport);
apiRouter.get('/census', requireRoles('ADMIN', 'OPERATOR', 'AUDITOR'), listCensus);
apiRouter.post('/census', requireRoles('ADMIN', 'OPERATOR'), createCensus);
apiRouter.get('/personnel/:type', requireRoles('ADMIN', 'OPERATOR', 'AUDITOR'), listPersonnel);
apiRouter.post('/personnel/insured-import', requireRoles('ADMIN', 'OPERATOR'), createInsuredRecord);
apiRouter.post('/personnel/:type', requireRoles('ADMIN', 'OPERATOR'), createPersonnel);
apiRouter.patch('/personnel/:type/:id', requireRoles('ADMIN', 'OPERATOR'), updatePersonnel);
apiRouter.delete('/personnel/:type/:id', requireRoles('ADMIN'), deletePersonnel);
apiRouter.post('/actuarial/calculate', requireRoles('ADMIN', 'OPERATOR'), calculate);
