import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail(to, token) {
  const verifyLink = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to,
    subject: 'Verify your EcoTrack account',
    text: `Welcome to EcoTrack! Verify your email: ${verifyLink}\n\nThis link expires in 24 hours.`,
    html: `<p>Welcome to EcoTrack!</p><p><a href="${verifyLink}">Click here to verify your email address</a></p><p>This link expires in 24 hours.</p>`,
  });
}
