// src/controllers/authController.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';
import { jwtConfig } from '../config/jwt.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS    = 15 * 60 * 1000; // 15 minutes

function generateAccessToken(userId, role) {
  return jwt.sign({ userId, role }, jwtConfig.secret, { expiresIn: jwtConfig.expiresIn });
}
function generateRefreshToken(userId) {
  return jwt.sign({ userId }, jwtConfig.refreshSecret, { expiresIn: jwtConfig.refreshExpiresIn });
}
function getRefreshExpiry() {
  const days = parseInt(jwtConfig.refreshExpiresIn) || 7;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

//  Register 
export const register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { firstName: firstName.trim(), lastName: lastName.trim(), email: email.toLowerCase(), passwordHash },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
    });

    const accessToken  = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id);
    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt: getRefreshExpiry(),
              userAgent: req.headers['user-agent'], ipAddress: req.ip },
    });

    res.status(201).json({
      success: true, message: 'Account created successfully',
      data: { user, accessToken, refreshToken },
    });
  } catch (error) { next(error); }
};

// Login 
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { companies: { where: { isActive: true }, orderBy: { createdAt: 'asc' } } },
    });

    // Generic error to prevent email enumeration
    const INVALID = { success: false, message: 'Invalid email or password' };

    if (!user || !user.isActive) return res.status(401).json(INVALID);

    // Brute-force protection
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((user.lockedUntil - Date.now()) / 60000);
      return res.status(403).json({ success: false, message: `Account locked. Try again in ${minutes} minute(s).` });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      const newCount = user.failedLoginCount + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: newCount,
          lockedUntil: newCount >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_DURATION_MS) : null,
        },
      });
      return res.status(401).json(INVALID);
    }

    // Reset failed counter on success
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const accessToken  = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id);
    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt: getRefreshExpiry(),
              userAgent: req.headers['user-agent'], ipAddress: req.ip },
    });

    const { passwordHash, failedLoginCount, lockedUntil, ...safeUser } = user;
    res.json({
      success: true, message: 'Login successful',
      data: { user: safeUser, accessToken, refreshToken, companies: user.companies },
    });
  } catch (error) { next(error); }
};

//  Refresh Token 
export const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) return res.status(401).json({ success: false, message: 'Refresh token required' });

    let decoded;
    try { decoded = jwt.verify(token, jwtConfig.refreshSecret); }
    catch { return res.status(401).json({ success: false, message: 'Invalid refresh token' }); }

    const stored = await prisma.refreshToken.findUnique({ where: { token } });
    if (!stored || stored.expiresAt < new Date()) {
      return res.status(401).json({ success: false, message: 'Refresh token expired or revoked' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, isActive: true },
    });
    if (!user?.isActive) return res.status(401).json({ success: false, message: 'User not found' });

    // Rotate tokens
    await prisma.refreshToken.delete({ where: { token } });
    const newAccess  = generateAccessToken(user.id, user.role);
    const newRefresh = generateRefreshToken(user.id);
    await prisma.refreshToken.create({
      data: { token: newRefresh, userId: user.id, expiresAt: getRefreshExpiry(),
              userAgent: req.headers['user-agent'], ipAddress: req.ip },
    });

    res.json({ success: true, data: { accessToken: newAccess, refreshToken: newRefresh } });
  } catch (error) { next(error); }
};

//  Logout 
export const logout = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    if (token) await prisma.refreshToken.deleteMany({ where: { token } });
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) { next(error); }
};

//  Get me
export const getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, firstName: true, lastName: true, email: true, role: true, createdAt: true,
        companies: { where: { isActive: true }, orderBy: { createdAt: 'asc' } },
      },
    });
    res.json({ success: true, data: { user } });
  } catch (error) { next(error); }
};
