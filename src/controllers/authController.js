// src/controllers/authController.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../config/database.js';
import { jwtConfig } from '../config/jwt.js';
import { sendResetEmail } from '../utils/email.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS    = 15 * 60 * 1000; // 15 minutes
const RESET_TOKEN_EXPIRY_MINUTES = 15;

// Generate secure 64-char hex token
function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

// SHA256 hash token
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

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

// Forgot Password - Generic response always
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    console.log(`[FORGOT-PASSWORD] Request for email: ${email}`);
    
    // Find user silently (no existence leak)
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });
    console.log(`[FORGOT-PASSWORD] User found: ${!!user}, ID: ${user?.id || 'none'}`);

    if (user) {
      // Generate raw token
      const rawToken = generateResetToken();
      console.log(`[FORGOT-PASSWORD] Generated rawToken (first 10 chars): ${rawToken.slice(0,10)}...`);
      
      const hashedToken = hashToken(rawToken);
      const expiry = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);
      
      // Store hashed token + expiry (one-time use)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          reset_token: hashedToken,
          reset_token_expiry: expiry,
        },
      });
      console.log(`[FORGOT-PASSWORD] Token stored in DB for user ${user.id}`);
      
      // Send email with RAW token
      console.log(`[FORGOT-PASSWORD] Attempting to send email to ${email}`);
      await sendResetEmail(email, rawToken);
      console.log(`[FORGOT-PASSWORD] Email sent successfully to ${email}`);
    } else {
      console.log(`[FORGOT-PASSWORD] No user found for ${email} (normal, generic response)`);
    }
    
    // Generic response - security: never reveal email exists
    res.json({
      success: true,
      message: 'If an account exists for this email, check your inbox for reset instructions (expires in 15 minutes).'
    });
    
  } catch (error) {
    console.error('[FORGOT-PASSWORD] ERROR details:', {
      message: error.message,
      code: error.code,
      stack: error.stack?.split('\n').slice(0,3).join('\n'),
      email: req.body.email,
      timestamp: new Date().toISOString()
    });
    
    // Generic error too - but now logs full details
    res.status(500).json({
      success: false,
      message: 'Request processed. Check your email if applicable.'
    });
  }
};


// Reset Password
export const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Reset token required'
      });
    }
    
    // Hash incoming raw token
    const hashedToken = hashToken(token);
    
    // Find valid reset token
    const user = await prisma.user.findFirst({
      where: {
        reset_token: hashedToken,
        reset_token_expiry: { gt: new Date() }, // not expired
      },
    });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }
    
    // Hash new password (same strength as register/login)
    const newPasswordHash = await bcrypt.hash(password, 12);
    
    // Update password + clear token (one-time use)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        reset_token: null,
        reset_token_expiry: null,
      },
    });
    
    res.json({
      success: true,
      message: 'Password reset successful. Please login with your new password.'
    });
    
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Reset failed. Please request a new reset link.'
    });
  }
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
