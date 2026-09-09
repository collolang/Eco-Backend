import bcrypt from 'bcryptjs';
import prisma from '../config/database.js';
import {
  SECURITY_QUESTION_CHOICES,
  normalizeSecurityAnswer,
  isValidSecurityQuestion,
} from '../utils/securityQuestions.js';

export async function verifyCurrentPassword(userId, currentPassword) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  return !!user && bcrypt.compare(currentPassword, user.passwordHash);
}

export const setupSecurityQuestions = async (req, res, next) => {
  try {
    const { currentPassword } = req.body;
    const passwordMatches = await verifyCurrentPassword(req.user.id, currentPassword);

    if (!passwordMatches) {
      return res.status(401).json({ success: false, message: 'Incorrect password. Re-enter your account password to continue.' });
    }

    const rows = Array.isArray(req.body?.questions) ? req.body.questions : [];

    if (rows.length !== 3) {
      return res.status(400).json({ success: false, message: 'Exactly 3 security questions are required.' });
    }

    const seenQuestions = new Set();
    const normalized = [];

    for (const item of rows) {
      const question = typeof item?.question === 'string' ? item.question.trim() : '';
      const answer = typeof item?.answer === 'string' ? item.answer : '';

      if (!question || !answer) {
        return res.status(400).json({ success: false, message: 'Each security question and answer is required.' });
      }

      if (!SECURITY_QUESTION_CHOICES.includes(question) || !isValidSecurityQuestion(question)) {
        return res.status(400).json({ success: false, message: 'One or more security questions are invalid.' });
      }

      if (seenQuestions.has(question)) {
        return res.status(400).json({ success: false, message: 'Each security question must be unique.' });
      }

      seenQuestions.add(question);
      normalized.push({
        question,
        answerHash: await bcrypt.hash(normalizeSecurityAnswer(answer), 12),
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.securityQuestion.deleteMany({ where: { userId: req.user.id } });

      await tx.securityQuestion.createMany({
        data: normalized.map((item) => ({
          userId: req.user.id,
          question: item.question,
          answer: item.answerHash,
        })),
      });

      await tx.user.update({
        where: { id: req.user.id },
        data: { hasSecurityQuestions: true },
      });
    });

    res.status(200).json({
      success: true,
      message: 'Security questions saved successfully.',
    });
  } catch (error) {
    next(error);
  }
};
