// src/routes/auth.js
import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, refreshToken, logout, getMe } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.post('/register',
  [
    body('firstName').trim().notEmpty().withMessage('First name is required').isLength({ max: 100 }),
    body('lastName').trim().notEmpty().withMessage('Last name is required').isLength({ max: 100 }),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8, max: 128 }).withMessage('Password must be 8–128 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must include uppercase, lowercase, and a number'),
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

router.post('/logout', logout);
router.get('/me', authenticate, getMe);

export default router;
