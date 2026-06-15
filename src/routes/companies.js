// src/routes/companies.js
import { Router } from 'express';
import { body } from 'express-validator';
import { listCompanies, getCompany, createCompany, updateCompany, deleteCompany } from '../controllers/companyController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(authenticate);

const companyValidation = [
  body('businessName').trim().notEmpty().withMessage('Business name is required').isLength({ max: 200 }),
  body('numberOfEmployees').optional().isInt({ min: 1 }).withMessage('Employees must be a positive integer'),
  body('contactEmail').optional().isEmail().withMessage('Valid contact email required'),
  body('country').optional().isString().isLength({ max: 50 }),
  body('yearEstablished').optional().isString().isLength({ max: 4 }),
];

router.get('/',                     listCompanies);
router.get('/:companyId',           getCompany);
router.post('/',   companyValidation, validate, createCompany);
router.put('/:companyId',  companyValidation, validate, updateCompany);
router.delete('/:companyId',        deleteCompany);

export default router;
