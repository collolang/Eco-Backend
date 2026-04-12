# Password Reset Feature - Complete Implementation Guide

## Overview
Secure forgot/reset password implementation with:
- **SHA256 hashed tokens** (never store raw)
- **15-minute expiry**
- **One-time use** (cleared after reset)
- **Rate limiting** (5 attempts/15min per IP)
- **Generic responses** (no email enumeration)
- **Email delivery** via Nodemailer (SMTP/Resend compatible)

## Database Changes
Added to `User` model in `prisma/schema.prisma`:
```prisma
reset_token      String?  // SHA256 hashed token
reset_token_expiry DateTime?  // 15min expiry
```

**Migration**: `npx prisma migrate dev --name add_password_reset`

## Environment Variables (add to .env)
```
# Email (SMTP or Resend)
EMAIL_HOST=smtp.resend.com          # or smtp.gmail.com, etc.
EMAIL_PORT=587                      # 587 or 465
EMAIL_USER=your_api_key_or_email    # Resend API key or SMTP user
EMAIL_PASS=your_app_password        # Resend secret or SMTP pass
FRONTEND_URL=http://localhost:3000  # Your frontend base URL
```

## API Endpoints

### 1. POST /api/auth/forgot-password
**Request**:
```json
{ "email": "user@example.com" }
```
**Response** (always generic):
```json
{ "success": true, "message": "If an account exists for this email, check your inbox for reset instructions." }
```
**Rate Limit**: 5 req/15min per IP

**Security**: Never reveals if email exists.

### 2. POST /api/auth/reset-password/:token
**Request**:
```json
{ 
  "password": "NewP@ssw0rd12"
}
```
**URL**: `/api/auth/reset-password/abc123def456...`

**Response** (success):
```json
{ "success": true, "message": "Password reset successful. Please login." }
```
**Errors**:
```json
{ "success": false, "message": "Invalid or expired reset token" }
```

**Validation**: Password must be 8+ chars, upper/lower/number (existing validator).

## How It Works

### Forgot Password Flow
1. User POSTs email to `/forgot-password`
2. **Rate limited** check
3. Find user by email (silently fail if not exists)
4. Generate **raw 64-char hex token**: `crypto.randomBytes(32).toString('hex')`
5. **Hash** raw token: `crypto.createHash('sha256').update(rawToken).digest('hex')`
6. Store **hashed token** + `expiry = now + 15min`
7. **Email** raw token in link: `${FRONTEND_URL}/reset?token=${rawToken}`
8. Generic success response

### Reset Password Flow
1. Extract `:token` from URL (raw token)
2. **Hash** incoming token: SHA256(rawToken)
3. Query: `user.reset_token === hashedToken && reset_token_expiry > now()`
4. **bcrypt.hash(newPassword, 12)** → update `passwordHash`
5. **Clear**: `reset_token = null, reset_token_expiry = null`
6. Success response

## Email Template
```
Subject: Reset Your EcoTrack Password

Hi,

Click to reset: https://yourapp.com/reset?token=abc123...

This link expires in 15 minutes.

If you didn't request this, ignore this email.

EcoTrack Team
```

## Security Checklist ✓
- [x] **No raw tokens stored** (SHA256 hash only)
- [x] **15min expiry**
- [x] **One-time use** (cleared post-reset)
- [x] **Rate limiting** forgot-password endpoint
- [x] **Generic responses** (forgot-password)
- [x] **Password validation** (existing: 8+ chars, upper/lower/number)
- [x] **HTTPS ready** (helmet middleware exists)

## Testing
1. `npm run dev`
2. POST `/api/auth/forgot-password` → check DB `reset_token`, email
3. POST `/api/auth/reset-password/{token}` → new password works, fields cleared
4. Invalid/expired token → 400 error
5. Rate limit → 429 after 5 attempts

## Production Setup
1. Resend.com API key → EMAIL_USER=re_xxx, EMAIL_HOST=smtp.resend.com
2. Or Gmail App Password (less recommended)
3. `FRONTEND_URL=https://yourdomain.com`
4. Run `prisma migrate deploy`

## Troubleshooting
- **No email**: Check EMAIL_* env vars, nodemailer logs
- **Token invalid**: Check hash (hex 64 chars), expiry
- **Migration fail**: `prisma db push` for dev
- **Rate limit**: Check `express-rate-limit` headers

---
*Implemented by BLACKBOXAI - Secure by design*

