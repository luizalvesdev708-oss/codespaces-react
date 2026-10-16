import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { corsOrigins, env } from './config/env.js';
import { prisma } from './config/db.js';
import { authRouter, apiRouter } from './routes.js';
import { errorHandler } from './middleware/errors.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-site' },
}));
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '1mb', strict: true }));
app.use((request, response, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const origin = request.get('origin');
    if (!origin || !corsOrigins.includes(origin)) {
      response.status(403).json({ error: 'A permitted browser origin is required for this request' });
      return;
    }
  }
  next();
});

app.get('/api/health', (_request, response) => response.json({ status: 'ok' }));
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' },
}));
app.use('/api/auth', authRouter);
app.use('/api', apiRouter);
app.use((_request, response) => response.status(404).json({ error: 'Route not found' }));
app.use(errorHandler);

const server = app.listen(env.PORT, () => {
  console.info(`RPPS API listening on port ${env.PORT}`);
});

async function shutdown(signal: string) {
  console.info(`Received ${signal}; closing API`);
  server.close(async (error) => {
    if (error) {
      console.error('Failed to close HTTP server cleanly', error);
      process.exitCode = 1;
    }
    await prisma.$disconnect();
    process.exit();
  });
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
