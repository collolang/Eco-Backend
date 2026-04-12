// src/server.js
import 'dotenv/config';
import net from 'net';
import app from './app.js';
import prisma from './config/database.js';

const DEFAULT_PORT = parseInt(process.env.PORT) || 3000;
const MAX_PORT_RETRIES = parseInt(process.env.PORT_RETRY_MAX) || 10;

let serverInstance = null;

function isPortFree(port) {
  return new Promise((resolve, reject) => {
    const tester = net.createServer()
      .once('error', (err) => {
        if (err && err.code === 'EADDRINUSE') resolve(false);
        else reject(err);
      })
      .once('listening', () => {
        tester.close(() => resolve(true));
      })
      .listen(port);
  });
}

async function startServer() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected (Supabase PostgreSQL)');

    let port = DEFAULT_PORT;
    let started = false;

    for (let attempt = 0; attempt <= MAX_PORT_RETRIES; attempt++) {
      const free = await isPortFree(port);
      if (!free) {
        console.warn(`Port ${port} in use — trying ${port + 1}`);
        port += 1;
        continue;
      }

      serverInstance = app.listen(port, () => {
        started = true;
        console.log('');
        console.log('🌿 ─────────────────────────────────────────');
        console.log('   EcoTrack Backend API  v2.0.0');
        console.log(`   🚀  http://localhost:${port}`);
        console.log(`   ❤️   http://localhost:${port}/health`);
        console.log(`   🔧  ${process.env.NODE_ENV || 'development'}`);
        console.log('🌿 ─────────────────────────────────────────');
        console.log('');
        console.log('   Auth');
        console.log('   POST   /api/auth/register');
        console.log('   POST   /api/auth/login');
        console.log('   POST   /api/auth/refresh');
        console.log('   POST   /api/auth/logout');
        console.log('   GET    /api/auth/me');
        console.log('');
        console.log('   Companies  (one user → many companies)');
        console.log('   GET    /api/companies');
        console.log('   POST   /api/companies');
        console.log('   GET    /api/companies/:id');
        console.log('   PUT    /api/companies/:id');
        console.log('   DELETE /api/companies/:id');
        console.log('');
        console.log('   Emissions  (scoped to a company)');
        console.log('   GET    /api/companies/:id/emissions');
        console.log('   POST   /api/companies/:id/emissions');
        console.log('   GET    /api/companies/:id/emissions/monthly');
        console.log('   GET    /api/companies/:id/emissions/breakdown');
        console.log('   GET    /api/companies/:id/emissions/total');
        console.log('   GET    /api/companies/:id/emissions/yearly');
        console.log('   PUT    /api/companies/:id/emissions/:eid');
        console.log('   DELETE /api/companies/:id/emissions/:eid');
        console.log('');
        console.log('   Reports  (scoped to a company)');
        console.log('   GET    /api/companies/:id/reports?month=March&year=2026');
        console.log('   GET    /api/companies/:id/reports/history');
        console.log('');
      });

      serverInstance.on('error', (err) => {
        console.error('Server error event:', err);
      });

      // Wait a tick to ensure server started successfully
      await new Promise((res) => setTimeout(res, 100));
      if (started) return;
    }

    throw new Error(`Unable to bind to a free port after ${MAX_PORT_RETRIES} retries`);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

//  Graceful shutdown
async function shutdown(signal) {
  console.log(`\n🛑 ${signal} received — shutting down gracefully…`);
  try {
    if (serverInstance) {
      await new Promise((resolve) => serverInstance.close(resolve));
    }
  } catch (e) {
    console.warn('Error closing server:', e);
  }
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

startServer();
