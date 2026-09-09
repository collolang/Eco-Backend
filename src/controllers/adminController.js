import prisma from '../config/database.js';

function normalizeSearch(value) {
  return String(value ?? '').trim().toLowerCase();
}

function parsePage(value, fallback = 1) {
  const page = Number.parseInt(value ?? fallback, 10);
  return Number.isFinite(page) && page > 0 ? page : fallback;
}

function parseLimit(value, fallback = 20) {
  const limit = Number.parseInt(value ?? fallback, 10);
  return Number.isFinite(limit) && limit > 0 ? limit : fallback;
}

export const listUsers = async (req, res, next) => {
  try {
    const page = parsePage(req.query.page, 1);
    const limit = parseLimit(req.query.limit, 20);
    const offset = (page - 1) * limit;
    const search = normalizeSearch(req.query.search);
    const role = req.query.role;

    const where = {
      ...(search ? {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { companies: { some: { businessName: { contains: search, mode: 'insensitive' } } } },
        ],
      } : {}),
      ...(role ? { role: role.toUpperCase() } : {}),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          isEmailVerified: true,
          companies: { select: { businessName: true }, where: { isActive: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        users: users.map((user) => ({
          id: user.id,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
          isEmailVerified: user.isEmailVerified,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const suspendUser = async (req, res, next) => {
  try {
    const targetId = req.params.id;

    if (targetId === req.user.id) {
      return res.status(400).json({ success: false, message: 'Admin cannot suspend their own account.' });
    }

    const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, isActive: true, email: true } });
    if (!target) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: targetId },
        data: { isActive: false },
      });

      await tx.refreshToken.deleteMany({ where: { userId: targetId } });
    });

    console.log(`[ADMIN_AUDIT] ${new Date().toISOString()} ${req.user.email} suspended ${target.email}`);

    res.json({
      success: true,
      message: 'User suspended successfully.',
      data: { id: targetId, isActive: false },
    });
  } catch (error) {
    next(error);
  }
};

export const reactivateUser = async (req, res, next) => {
  try {
    const targetId = req.params.id;
    const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, email: true } });
    if (!target) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    await prisma.user.update({
      where: { id: targetId },
      data: { isActive: true },
    });

    console.log(`[ADMIN_AUDIT] ${new Date().toISOString()} ${req.user.email} reactivated ${target.email}`);

    res.json({
      success: true,
      message: 'User reactivated successfully.',
      data: { id: targetId, isActive: true },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const targetId = req.params.id;

    if (targetId === req.user.id) {
      return res.status(400).json({ success: false, message: 'Admin cannot delete their own account.' });
    }

    const target = await prisma.user.findUnique({
      where: { id: targetId },
      include: {
        companies: { select: { id: true } },
        emissionEntries: { select: { id: true } },
        refreshTokens: { select: { id: true } },
      },
    });

    if (!target) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const companyCount = target.companies.length;
    const emissionCount = target.emissionEntries.length;
    const refreshTokenCount = target.refreshTokens.length;

    await prisma.$transaction(async (tx) => {
      await tx.refreshToken.deleteMany({ where: { userId: targetId } });
      await tx.user.delete({ where: { id: targetId } });
    });

    console.log(`[ADMIN_AUDIT] ${new Date().toISOString()} ${req.user.email} deleted ${target.email}`);

    res.json({
      success: true,
      message: 'User deleted successfully.',
      data: {
        deletedUserId: targetId,
        companyCount,
        emissionEntryCount: emissionCount,
        refreshTokenCount,
      },
    });
  } catch (error) {
    next(error);
  }
};
