// src/config/jwt.js
const isDev = process.env.NODE_ENV !== 'production';

function requireSecret(name, fallback) {
  const val = process.env[name];
  if (!val) {
    if (isDev) {
      console.warn(`⚠️  WARNING: ${name} not set. Using insecure fallback for development only.`);
      return fallback;
    }
    throw new Error(`${name} environment variable is required in production`);
  }
  return val;
}

export const jwtConfig = {
  secret:           requireSecret('JWT_SECRET','5c0972344c815d4edc412b91c26a8f357baf033bcc7acc14774ba5ee5464900410dd243b1d88a2e7ed1686fa6cfd83b127edeb3cd9ccdbd947988958ef7a0135'),
  expiresIn:        process.env.JWT_EXPIRES_IN || '15m',
  refreshSecret:    requireSecret('JWT_REFRESH_SECRET','4ed29b331f02af1ae9b2310d307e1ace7d7c1522f535e66ad7e8e1dfb10d7459329fd98195405f76a6f8d15b7a782bda79bb2a5f5d298ee251d9ddbbe097947a'),
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ||'7d',
};
