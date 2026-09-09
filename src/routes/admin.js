import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { listUsers, suspendUser, reactivateUser, deleteUser } from '../controllers/adminController.js';

const router = express.Router();

router.use(authenticate, requireAdmin);
router.get('/users', listUsers);
router.patch('/users/:id/suspend', suspendUser);
router.patch('/users/:id/reactivate', reactivateUser);
router.delete('/users/:id', deleteUser);

export default router;
