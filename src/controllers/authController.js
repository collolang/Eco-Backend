// src/controllers/authController.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';
import { jwtConfig } from '../config/jwt.js';
import { parseSecurityQuestionAnswers } from '../utils/securityQuestions.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const SECURITY_QUESTION_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const SECURITY_QUESTION_RATE_LIMIT_MAX = 5;
const SECURITY_QUESTION_FAILURE_DELAY_MS = 750;
const SECURITY_QUESTION_LOCKOUT_MS = 60 * 1000;
const questionAttemptStore = new Map();

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

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

function getQuestionAttemptState(email) {
  const normalizedEmail = normalizeEmail(email);
  const now = Date.now();
  const existing = questionAttemptStore.get(normalizedEmail);

  if (!existing || now - existing.windowStart > SECURITY_QUESTION_RATE_LIMIT_WINDOW_MS) {
    const nextState = {
      windowStart: now,
      attempts: 0,
      lockUntil: null,
    };
    questionAttemptStore.set(normalizedEmail, nextState);
    return nextState;
  }

  return existing;
}

function applySecurityQuestionRateLimit(email) {
  const state = getQuestionAttemptState(email);
  const now = Date.now();

  if (state.lockUntil && state.lockUntil > now) {
    return {
      allowed: false,
      retryAfterMs: state.lockUntil - now,
    };
  }

  if (state.attempts >= SECURITY_QUESTION_RATE_LIMIT_MAX) {
    state.lockUntil = now + SECURITY_QUESTION_LOCKOUT_MS;
    state.attempts = 0;
    return {
      allowed: false,
      retryAfterMs: SECURITY_QUESTION_LOCKOUT_MS,
    };
  }

  state.attempts += 1;
  return { allowed: true };
}

function resetSecurityQuestionAttempts(email) {
  questionAttemptStore.delete(normalizeEmail(email));
}

async function delaySecurityFailure() {
  await new Promise((resolve) => setTimeout(resolve, SECURITY_QUESTION_FAILURE_DELAY_MS));
}

function logSecurityQuestionFailure(email) {
  console.warn('[SECURITY-QUESTION-RECOVERY] Failed attempt logged:', {
    email: normalizeEmail(email),
    timestamp: new Date().toISOString(),
  });
}

// Register
export const register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    const existing = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizeEmail(email),
        passwordHash,
      },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
    });

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id);
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: getRefreshExpiry(),
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: { user, accessToken, refreshToken },
    });
  } catch (error) {
    next(error);
  }
};

// Login
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
      include: { companies: { where: { isActive: true }, orderBy: { createdAt: 'asc' } } },
    });

    const INVALID = { success: false, message: 'Invalid email or password' };

    if (!user || !user.isActive) return res.status(401).json(INVALID);

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

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id);
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: getRefreshExpiry(),
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      },
    });

    const { passwordHash, failedLoginCount, lockedUntil, ...safeUser } = user;
    res.json({
      success: true,
      message: 'Login successful',
      data: { user: safeUser, accessToken, refreshToken, companies: user.companies },
    });
  } catch (error) {
    next(error);
  }
};

// Refresh token
export const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) return res.status(401).json({ success: false, message: 'Refresh token required' });

    let decoded;
    try {
      decoded = jwt.verify(token, jwtConfig.refreshSecret);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    const stored = await prisma.refreshToken.findUnique({ where: { token } });
    if (!stored || stored.expiresAt < new Date()) {
      return res.status(401).json({ success: false, message: 'Refresh token expired or revoked' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, isActive: true },
    });
    if (!user?.isActive) return res.status(401).json({ success: false, message: 'User not found' });

    await prisma.refreshToken.delete({ where: { token } });
    const newAccess = generateAccessToken(user.id, user.role);
    const newRefresh = generateRefreshToken(user.id);
    await prisma.refreshToken.create({
      data: {
        token: newRefresh,
        userId: user.id,
        expiresAt: getRefreshExpiry(),
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      },
    });

    res.json({ success: true, data: { accessToken: newAccess, refreshToken: newRefresh } });
  } catch (error) {
    next(error);
  }
};

// Logout
export const logout = async (_req, res, next) => {
  try {
    const { refreshToken: token } = _req.body;
    if (token) await prisma.refreshToken.deleteMany({ where: { token } });
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

export const forgotPasswordQuestions = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const rateLimitResult = applySecurityQuestionRateLimit(email);

    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        success: false,
        message: `Too many recovery attempts. Please try again in ${Math.ceil(rateLimitResult.retryAfterMs / 1000)} seconds.`,
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { securityQuestions: { orderBy: { createdAt: 'asc' } } },
    });

    if (!user || !user.hasSecurityQuestions || user.securityQuestions.length !== 3) {
      return res.status(200).json({
        success: true,
        message: 'If an account exists and has security questions set up, you can continue with recovery.',
      });
    }

    const questionList = user.securityQuestions.map((item) => item.question);
    return res.json({
      success: true,
      data: { questions: questionList },
    });
  } catch (error) {
    console.error('Forgot password questions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to process your recovery request right now.',
    });
  }
};

export const resetPasswordQuestions = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const rateLimitResult = applySecurityQuestionRateLimit(email);

    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        success: false,
        message: `Too many recovery attempts. Please try again in ${Math.ceil(rateLimitResult.retryAfterMs / 1000)} seconds.`,
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { securityQuestions: { orderBy: { createdAt: 'asc' } } },
    });

    if (!user || !user.hasSecurityQuestions || user.securityQuestions.length !== 3) {
      logSecurityQuestionFailure(email);
      await delaySecurityFailure();
      return res.status(200).json({
        success: false,
        message: 'One or more answers are incorrect.',
      });
    }

    const submittedAnswers = Array.isArray(req.body.answers) ? req.body.answers : [];
    if (submittedAnswers.length !== 3) {
      logSecurityQuestionFailure(email);
      await delaySecurityFailure();
      return res.status(200).json({
        success: false,
        message: 'One or more answers are incorrect.',
      });
    }

    const parsedAnswers = parseSecurityQuestionAnswers(submittedAnswers);
    const storedQuestions = new Map(user.securityQuestions.map((entry) => [entry.question, entry.answer]));

    if (
      parsedAnswers.some(({ question, answer }) => !question || !answer) ||
      new Set(parsedAnswers.map(({ question }) => question)).size !== 3
    ) {
      logSecurityQuestionFailure(email);
      await delaySecurityFailure();
      return res.status(200).json({
        success: false,
        message: 'One or more answers are incorrect.',
      });
    }

    const correctMatches = await Promise.all(
      parsedAnswers.map(async ({ question, answer }) => {
        const targetHash = storedQuestions.get(question);
        if (!targetHash) return false;
        return bcrypt.compare(answer, targetHash);
      })
    );

    const allAnswersCorrect = correctMatches.every(Boolean) && parsedAnswers.length === 3;

    if (!allAnswersCorrect) {
      logSecurityQuestionFailure(email);
      await delaySecurityFailure();
      return res.status(200).json({
        success: false,
        message: 'One or more answers are incorrect.',
      });
    }

    const passwordHash = await bcrypt.hash(req.body.newPassword, 12);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });

      await tx.refreshToken.deleteMany({ where: { userId: user.id } });
    });

    resetSecurityQuestionAttempts(email);
    return res.json({
      success: true,
      message: 'Password reset successful. Please log in with your new password.',
    });
  } catch (error) {
    console.error('Reset password with questions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to reset the password right now.',
    });
  }
};

// Get me
export const getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        createdAt: true,
        hasSecurityQuestions: true,
        companies: { where: { isActive: true }, orderBy: { createdAt: 'asc' } },
      },
    });
    res.json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};
