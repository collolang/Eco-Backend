import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();
const hasEmailConfig = Boolean(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.EMAIL_PORT);

let transporter = null;
if (hasEmailConfig) {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // Test transporter on startup (optional)
  transporter.verify((error) => {
    if (error) {
      console.error('Email transporter error:', error);
    } else {
      console.log('Email transporter ready');
    }
  });
} else {
  console.warn('Email config incomplete — emails will be skipped. Set EMAIL_HOST, EMAIL_USER, EMAIL_PASS, EMAIL_PORT.');
}

export const sendResetEmail = async (email, token) => {
  console.log(`[EMAIL] sendResetEmail called for: ${email}`);
  console.log(`[EMAIL] Config check - HOST: ${process.env.EMAIL_HOST || 'MISSING'}, USER: ${process.env.EMAIL_USER ? process.env.EMAIL_USER.slice(0,3)+'...' : 'MISSING'}`);
  console.log(`[EMAIL] FRONTEND_URL: ${process.env.FRONTEND_URL || 'MISSING - using localhost'}`);

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resetUrl = `${frontendUrl}/reset?token=${token}`;
  console.log(`[EMAIL] Generated resetUrl: ${resetUrl}`);

  const mailOptions = {
    from: `"EcoTrack" <${process.env.EMAIL_USER || 'ecotrack549@gmail.com'}>`,
    to: email,
    subject: 'Reset Your EcoTrack Password',
    html: `
      <h2>Password Reset Request</h2>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}" style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
      <br><br>
      <p><small>This link expires in 15 minutes. If you didn't request this, ignore this email.</small></p>
      <hr>
      <p>EcoTrack Team</p>
    `,
  };
  console.log(`[EMAIL] mailOptions prepared - from: ${mailOptions.from}, to: ${mailOptions.to}`);

  if (!transporter) {
    console.warn('[EMAIL] Transporter not configured — skipping sendMail and returning false');
    return false;
  }

  try {
    console.log(`[EMAIL] Sending via transporter...`);
    const info = await transporter.sendMail(mailOptions);
    console.log('[EMAIL] SUCCESS - Reset email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('[EMAIL] FAILURE details:', {
      message: error.message,
      code: error.code,
      responseCode: error.responseCode,
      response: error.response,
      stack: error.stack?.split('\n').slice(0,3).join('\n')
    });
    // Do not throw here — treat failure as non-fatal so forgot-password returns the generic success response.
     return false;
    
  }
};


