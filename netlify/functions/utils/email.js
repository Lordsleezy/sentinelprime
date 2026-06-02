const { Resend } = require("resend");

function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

function activationEmail(code, plan, expiresAt) {
  const planLabel = { monthly: "Monthly Plan", annual: "Annual Plan", lifetime: "Lifetime License", gift: "Gift License", admin: "Admin License" }[plan] || plan;
  const expiry = expiresAt ? `<p>Your access is active until <strong>${new Date(expiresAt).toLocaleDateString()}</strong>.</p>` : "<p>This license does not expire.</p>";
  return `<div style="background:#000005;color:#fff;font-family:monospace;padding:40px;max-width:640px;margin:auto"><h1 style="color:#00d4ff">SENTINEL AI</h1><h2>Your Activation Code</h2><p>Thank you for choosing Sentinel AI ${planLabel}.</p><div style="border:1px solid #00d4ff;padding:24px;text-align:center;margin:24px 0"><strong style="font-size:26px;letter-spacing:3px;color:#00d4ff">${code}</strong></div>${expiry}<p>Download Sentinel AI at sentinelprime.org/download and enter this code when prompted.</p><p style="color:#9aa3ad">Need help? customerservice@sentinelprime.org</p></div>`;
}

async function sendEmail({ to, subject, html }) {
  if (!emailConfigured() || !to) return { skipped: true };
  const resend = new Resend(process.env.RESEND_API_KEY);
  return resend.emails.send({
    from: process.env.RESEND_FROM || "Sentinel Prime <noreply@sentinelprime.org>",
    to,
    subject,
    html
  });
}

async function sendActivationEmail({ to, code, plan, expiresAt, resent = false }) {
  return sendEmail({
    to,
    subject: `Your Sentinel AI Activation Code${resent ? " (Resent)" : ""}`,
    html: activationEmail(code, plan, expiresAt)
  });
}

module.exports = { activationEmail, emailConfigured, sendActivationEmail, sendEmail };

