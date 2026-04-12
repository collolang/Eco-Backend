// src/middleware/errorHandler.js

// Helper to set CORS headers explicitly (reflect incoming origin when allowed)
const setCorsHeaders = (req, res) => {
  const allowed = [process.env.FRONTEND_URL, 'https://eco-frontend-eight.vercel.app', 'http://localhost:3000', 'http://127.0.0.1:3000'].filter(Boolean);
  const incoming = req.headers.origin;
  const origin = incoming && allowed.includes(incoming) ? incoming : (process.env.FRONTEND_URL || 'https://eco-frontend-eight.vercel.app');
  res.set({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  });
};

export const errorHandler = (err, req, res, next) => {
  console.error('❌ Unhandled error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  setCorsHeaders(req, res);

  if (err.code === 'P2002') {
    return res.status(409).json({ 
      success: false, 
      message: 'A record with this value already exists', 
      field: err.meta?.target 
    });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ success: false, message: 'Record not found' });
  }
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export const notFound = (req, res) => {
  setCorsHeaders(req, res);
  res.status(404).json({ 
    success: false, 
    message: `Route ${req.method} ${req.originalUrl} not found` 
  });
};
