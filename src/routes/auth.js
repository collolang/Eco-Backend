// src/routes/auth.js
import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, refreshToken, logout, getMe, forgotPassword, resetPassword } from '../controllers/authController.js';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.post('/register',
  [
    body('firstName').trim().notEmpty().withMessage('First name is required').isLength({ max: 100 }),
    body('lastName').trim().notEmpty().withMessage('Last name is required').isLength({ max: 100 }),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8, max: 128 }).withMessage('Password must be 8–128 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)/).withMessage('Password must include uppercase, lowercase, and a number'),
  ],
  validate, register
);

router.post('/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate, login
);

router.post('/refresh',
  [body('refreshToken').notEmpty().withMessage('Refresh token is required')],
  validate, refreshToken
);

// Forgot Password - Rate limited, generic response
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per windowMs per IP
  message: { success: false, message: 'Too many forgot-password requests, try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/forgot-password',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  ],
  validate,
  forgotPasswordLimiter,
  forgotPassword
);

// Reset Password
router.post('/reset-password/:token',
  [
    body('password').isLength({ min: 8, max: 128 }).withMessage('Password must be 8–128 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)/).withMessage('Password must include uppercase, lowercase, and a number'),
  ],
  validate,
  resetPassword
);

router.post('/logout', logout);
router.get('/me', authenticate, getMe);

export default router;
