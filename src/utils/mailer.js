import Mailgun from 'mailgun.js';
import formData from 'form-data';

const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY,
  url: process.env.MAILGUN_BASE_URL,
});

export async function sendVerificationEmail(to, token) {
  const verifyLink = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

  await mg.messages.create(process.env.MAILGUN_DOMAIN, {
    from: process.env.MAIL_FROM,
    to: [to],
    subject: 'Verify your EcoTrack account',
    text: `Welcome to EcoTrack! Verify your email: ${verifyLink}\n\nThis link expires in 24 hours.`,
    html: `<p>Welcome to EcoTrack!</p><p><a href="${verifyLink}">Click here to verify your email address</a></p><p>This link expires in 24 hours.</p>`,
  });
}
