# Fix /api/auth/forgot-password 500 Error

## Progress
✅ **Detailed logging added** to `authController.js` + `email.js`  
✅ **Files deployed** and ready for testing  

## Remaining Steps
- [ ] **3.** Test locally: `npm start` → POST `/api/auth/forgot-password` → check console logs  
- [ ] **4.** Render Dashboard → Environment → Add:
```
EMAIL_HOST=smtp.gmail.com (or Brevo/SendGrid)
EMAIL_PORT=587
EMAIL_USER=your-verified@gmail.com
EMAIL_PASS=16-char-app-password 
FRONTEND_URL=https://your-frontend-domain.com
```
- [ ] **5.** `git push` → Render deploy → test endpoint → **share new logs**
- [ ] **6.** Fix specific SMTP error from logs  
- [ ] **7.** Verify email delivery → cleanup logs → done

## Commands to run locally:
```bash
npm start
# Test with curl/Postman: POST /api/auth/forgot-password { "email": "test@example.com" }
```

**Next**: Deploy + share Render logs → instant fix! 🚀"

