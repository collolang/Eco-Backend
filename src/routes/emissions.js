// src/routes/emissions.js
import { Router } from 'express';
import { body } from 'express-validator';
import {
getAllEntries, getEntryById, createEntry, updateEntry, deleteEntry,
  getMonthlyData, getBreakdownData, getTotalEmissions, getYearlyComparison,
  getEmissionsScore,
  getPrediction,
} from '../controllers/emissionsController.js';

import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true }); // to get :companyId from parent
router.use(authenticate);

const VALID_FUEL_TYPES  = ['PETROL','DIESEL','KEROSENE','LNG','CNG','LPG','WOOD','COAL'];
const VALID_WASTE_TYPES = ['LANDFILL','RECYCLED','COMPOSTED','INCINERATED','HAZARDOUS'];

const entryValidation = [
  body('month').isInt({ min: 1, max: 12 }).withMessage('Month must be 1–12'),
  body('year').isInt({ min: 2000, max: 2100 }).withMessage('Year must be valid'),
  body('electricityKwh').optional().isFloat({ min: 0 }),
  body('fuelQuantity').optional().isFloat({ min: 0 }),
  body('fuelType').optional().isIn(VALID_FUEL_TYPES),
  body('wasteKg').optional().isFloat({ min: 0 }),
  body('wasteType').optional().isIn(VALID_WASTE_TYPES),
  body('flightKm').optional().isFloat({ min: 0 }),
];

// Aggregate endpoints
router.get('/monthly',    getMonthlyData);
router.get('/breakdown',  getBreakdownData);
router.get('/total',      getTotalEmissions);
router.get('/yearly',     getYearlyComparison);
router.get('/score',      getEmissionsScore);
router.get('/prediction', getPrediction);



// CRUD
router.get('/',           getAllEntries);
router.post('/',          entryValidation, validate, createEntry);
router.get('/:id',        getEntryById);
router.put('/:id',        [
  body('electricityKwh').optional().isFloat({ min: 0 }),
  body('fuelQuantity').optional().isFloat({ min: 0 }),
  body('fuelType').optional().isIn(VALID_FUEL_TYPES),
  body('wasteKg').optional().isFloat({ min: 0 }),
  body('wasteType').optional().isIn(VALID_WASTE_TYPES),
  body('flightKm').optional().isFloat({ min: 0 }),
], validate, updateEntry);
router.delete('/:id',     deleteEntry);

export default router;
