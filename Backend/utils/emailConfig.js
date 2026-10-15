const nodemailer = require('nodemailer');

// SMTP settings come from the environment. SMTP_PASS should be an app password,
// never a personal account password. ADMIN_EMAIL_PASSWORD is accepted for
// backward compatibility with older .env files.
const getSmtpConfig = () => ({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 465),
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS || process.env.ADMIN_EMAIL_PASSWORD,
});

const createTransporter = () => {
  const { host, port, user, pass } = getSmtpConfig();
  if (!user || !pass) {
    throw new Error('Email is not configured: set SMTP_USER and SMTP_PASS in Backend/.env');
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
};

module.exports = { createTransporter, getSmtpConfig };
