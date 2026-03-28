// src/middleware/auth.js
import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt.js';
import prisma from '../config/database.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access token required' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, jwtConfig.secret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Access token expired', code: 'TOKEN_EXPIRED' });
      }
      return res.status(401).json({ success: false, message: 'Invalid access token' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, isActive: true, lockedUntil: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'User account inactive or not found' });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return res.status(403).json({ success: false, message: 'Account temporarily locked due to too many failed attempts' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ success: false, message: 'Authentication error' });
  }
};

// Verify the requesting user owns a given company
export const requireCompanyOwner = async (req, res, next) => {
  try {
    const companyId = req.params.companyId || req.body.companyId || req.query.companyId;
    if (!companyId) {
      return res.status(400).json({ success: false, message: 'companyId is required' });
    }

    const company = await prisma.company.findFirst({
      where: { id: companyId, userId: req.user.id, isActive: true },
    });

    if (!company) {
      return res.status(403).json({ success: false, message: 'Access denied to this company' });
    }

    req.company = company;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};
