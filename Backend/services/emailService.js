const { createTransporter, getSmtpConfig } = require('../utils/emailConfig');

const escapeHtml = (value = '') =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const layout = (title, body) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
    <h2 style="color: #333;">${title}</h2>
    ${body}
    <p>Best regards,<br>Enova Robotics HR</p>
  </div>`;

const button = (url, label) => `
  <div style="text-align: center; margin: 30px 0;">
    <a href="${url}" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; font-size: 16px; border-radius: 4px;">${label}</a>
  </div>`;

class EmailService {
  constructor() {
    this.transporter = null;
  }

  getTransporter() {
    if (!this.transporter) {
      this.transporter = createTransporter();
    }
    return this.transporter;
  }

  async send({ to, subject, html }) {
    if (!to) throw new Error('No recipient address');
    const transporter = this.getTransporter();
    return transporter.sendMail({ from: getSmtpConfig().user, to, subject, html });
  }

  // Welcome email with a link to set the initial password (no password in the email).
  async sendAccountSetupEmail({ email, firstName, loginEmail, setupUrl }) {
    return this.send({
      to: email,
      subject: 'Welcome to the Enova Robotics HRMS',
      html: layout(`Welcome, ${escapeHtml(firstName)}!`, `
        <p>An HRMS account has been created for you. Your login email is <strong>${escapeHtml(loginEmail)}</strong>.</p>
        <p>Click the button below to choose your password. This link expires in 24 hours.</p>
        ${button(setupUrl, 'Set my password')}
        <p>If the link has expired, use "Forgot password" on the login page.</p>`),
    });
  }

  // Tells the user which credentials changed, never the new values of secrets.
  async sendCredentialUpdateNotification({ email, firstName, newLoginEmail, passwordChanged }) {
    const changes = [];
    if (newLoginEmail) changes.push(`<p><strong>New login email:</strong> ${escapeHtml(newLoginEmail)}</p>`);
    if (passwordChanged) changes.push('<p><strong>Password:</strong> your password was changed by an administrator.</p>');
    if (changes.length === 0) return null;

    return this.send({
      to: email,
      subject: 'HRMS - Your account credentials were updated',
      html: layout('Credential Update Notification', `
        <p>Hello ${escapeHtml(firstName)},</p>
        <p>Your HRMS account credentials have been updated:</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">${changes.join('')}</div>
        <p>If you did not expect this change, contact HR immediately at hr@enovarobotics.eu.</p>`),
    });
  }

  async sendPasswordResetEmail({ email, firstName, resetUrl }) {
    return this.send({
      to: email,
      subject: 'Password Reset Request',
      html: layout(`Hello ${escapeHtml(firstName)},`, `
        <p>We received a request to reset your password. Click the button below to choose a new one:</p>
        ${button(resetUrl, 'Reset Password')}
        <p>This link expires in 10 minutes and can be used once. If you didn't request this, you can ignore this email.</p>`),
    });
  }

  async sendPasswordResetConfirmation({ email, firstName }) {
    return this.send({
      to: email,
      subject: 'Password Reset Successful',
      html: layout(`Hello ${escapeHtml(firstName)},`, `
        <p>Your password has been successfully changed.</p>
        <p>If you did not perform this action, contact HR immediately at hr@enovarobotics.eu.</p>`),
    });
  }
}

module.exports = new EmailService();
