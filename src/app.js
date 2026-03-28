// src/app.js
import express      from 'express';
import cors         from 'cors';
import helmet       from 'helmet';
import morgan       from 'morgan';
import rateLimit    from 'express-rate-limit';
import 'dotenv/config';

import authRoutes      from './routes/auth.js';
import companyRoutes   from './routes/companies.js';
import emissionRoutes  from './routes/emissions.js';
import reportRoutes    from './routes/reports.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", 'data:'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

//  CORS 
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials:    true,
  methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge:         86400,
}));

// Trust proxy (needed for correct IP behind Supabase / Railway) 
app.set('trust proxy', 1);

//  Rate limiting 
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_MAX)        || 200,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many requests — please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many login attempts — please try again later.' },
  skipSuccessfulRequests: true,
});

app.use('/api/', globalLimiter);
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);

//  Body parsing 
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Logging 
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

//  Health check 
app.get('/health', (_req, res) => res.json({
  success:     true,
  message:     'EcoTrack API is running',
  timestamp:   new Date().toISOString(),
  environment: process.env.NODE_ENV || 'development',
  version:     '2.0.0',
}));

// API Routes 
// Auth
app.use('/api/auth', authRoutes);

// Companies (CRUD)
app.use('/api/companies', companyRoutes);

// Emissions — nested under company: /api/companies/:companyId/emissions/...
app.use('/api/companies/:companyId/emissions', emissionRoutes);

// Reports — nested under company: /api/companies/:companyId/reports/...
app.use('/api/companies/:companyId/reports', reportRoutes);

//  404 & Error handlers 
app.use(notFound);
app.use(errorHandler);

export default app;
