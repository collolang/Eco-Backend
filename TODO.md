# Forgot/Reset Password Implementation TODO

## Approved Plan Summary
✅ **DB Schema**: Add `reset_token String?`, `reset_token_expiry DateTime?` to User model  
✅ **Controllers**: Add `forgotPassword`, `resetPassword`, email helper  
✅ **Routes**: Add POST `/forgot-password`, POST `/reset-password/:token`  
✅ **Email**: Nodemailer setup (`src/utils/email.js`)  
✅ **Deps**: nodemailer  
✅ **Security**: Rate limit, SHA256 tokens, 15min expiry, one-time use  
✅ **Tests/Deploy**: Migrations, env vars, test endpoints  

## Step-by-Step Progress Tracker

### ✅ Step 1: Install Dependencies
- `npm install nodemailer` ✓

### ✅ README Created: docs/password-reset.md

### ✅ Step 2: Update Prisma Schema & Migrate
- Schema edited, migration created/applied ✓
- `npx prisma generate` ✓

### ✅ Step 3: Create Email Utility
- `src/utils/email.js` created ✓

### ✅ Step 4: Update Auth Controller
- `src/controllers/authController.js` updated ✓

### ✅ Step 5: Update Auth Routes
- `src/routes/auth.js` - added endpoints + rate-limit ✓

### ✅ Step 6: Feature Complete
- All code implemented per plan
- Migration applied, Prisma generated

**Setup for testing:**
1. Add to `.env`:
```
EMAIL_HOST=smtp.resend.com
EMAIL_PORT=587
EMAIL_USER=re_xxxxxxxxxxxxxxxx
EMAIL_PASS=your_resend_secret
FRONTEND_URL=http://localhost:3000
```
2. `npm run dev`
3. Test: POST /api/auth/forgot-password { "email": "test@example.com" }
4. Check email + DB reset_token
5. POST /api/auth/reset-password/{rawtoken} { "password": "NewP@ss123" }

See `docs/password-reset.md` for full docs.

**Feature complete!**

### ⬜ Step 4: Update Auth Controller
- Edit `src/controllers/authController.js`

### ⬜ Step 5: Update Auth Routes
- Edit `src/routes/auth.js`

### ⬜ Step 6: Generate Prisma Client & Test
- `npx prisma generate`
- Add .env vars
- `npm run dev`
- Test POST /api/auth/forgot-password

### ⬜ Step 7: Create README
- Create `docs/password-reset.md` with full explanations

**Next Action**: Starting with Step 1 - installing nodemailer.

