// src/server.js
import 'dotenv/config';
import app    from './app.js';
import prisma from './config/database.js';

const PORT = parseInt(process.env.PORT) || 3000;

async function startServer() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected (Supabase PostgreSQL)');

    app.listen(PORT, () => {
      console.log('');
      console.log('🌿 ─────────────────────────────────────────');
      console.log('   EcoTrack Backend API  v2.0.0');
      console.log(`   🚀  http://localhost:${PORT}`);
      console.log(`   ❤️   http://localhost:${PORT}/health`);
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
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

//  Graceful shutdown 
async function shutdown(signal) {
  console.log(`\n🛑 ${signal} received — shutting down gracefully…`);
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

startServer();
