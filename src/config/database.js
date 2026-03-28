// src/config/database.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  errorFormat: 'minimal',
});

process.on('beforeExit', async () => { await prisma.$disconnect(); });

export default prisma;
