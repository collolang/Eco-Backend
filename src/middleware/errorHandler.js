// src/middleware/errorHandler.js
export const errorHandler = (err, req, res, next) => {
  console.error('Unhandled error:', err.message || err);

  if (err.code === 'P2002') {
    return res.status(409).json({ success: false, message: 'A record with this value already exists', field: err.meta?.target });
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
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found` });
};
