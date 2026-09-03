import { Router } from 'express';
import { body } from 'express-validator';
import { setupSecurityQuestions } from '../controllers/accountController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { SECURITY_QUESTION_CHOICES } from '../utils/securityQuestions.js';

const router = Router();
router.use(authenticate);

router.post('/security-questions',
  [
    body('questions').isArray({ min: 3, max: 3 }).withMessage('Exactly 3 security questions are required'),
    body('questions.*.question').custom((value) => {
      if (!SECURITY_QUESTION_CHOICES.includes(value)) {
        throw new Error('Invalid security question selected');
      }
      return true;
    }),
    body('questions.*.answer').trim().notEmpty().withMessage('Each answer is required').isLength({ min: 1, max: 200 }),
  ],
  validate,
  setupSecurityQuestions
);

export default router;
