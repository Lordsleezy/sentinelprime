const { Resend } = require("resend");

function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

const PRODUCT_LABELS = {
  sentinelai: "SentinelAI",
  shift: "Shift by Sentinel",
  shield: "Sentinel Shield",
  care: "Sentinel Care"
};

function activationEmail(code, plan, expiresAt, product = "sentinelai") {
  const planLabel = { monthly: "Monthly Plan", annual: "Annual Plan", lifetime: "Lifetime License", gift: "Gift License", admin: "Admin License" }[plan] || plan;
  const productLabel = PRODUCT_LABELS[product] || product;
  const expiry = expiresAt ? `<p>Your access is active until <strong>${new Date(expiresAt).toLocaleDateString()}</strong>.</p>` : "<p>This license does not expire.</p>";
  const downloadHint = product === "care"
    ? "<p>Visit sentinelprime.org/care to activate your subscription.</p>"
    : product === "shift"
      ? "<p>Download Shift at sentinelprime.org/products and enter this code when prompted.</p>"
      : product === "shield"
        ? "<p>Download Sentinel Shield at sentinelprime.org/products and enter this code when prompted.</p>"
        : "<p>Download Sentinel AI at sentinelprime.org/download and enter this code when prompted.</p>";
  return `<div style="background:#000005;color:#fff;font-family:monospace;padding:40px;max-width:640px;margin:auto"><h1 style="color:#14b8a6">SENTINEL PRIME</h1><h2>Your ${productLabel} Activation Code</h2><p>Thank you for choosing ${productLabel} — ${planLabel}.</p><div style="border:1px solid #14b8a6;padding:24px;text-align:center;margin:24px 0"><strong style="font-size:26px;letter-spacing:3px;color:#14b8a6">${code}</strong></div>${expiry}${downloadHint}<p style="color:#9aa3ad">Need help? customerservice@sentinelprime.org</p></div>`;
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

async function sendActivationEmail({ to, code, plan, expiresAt, product = "sentinelai", resent = false }) {
  const productLabel = PRODUCT_LABELS[product] || "Sentinel Prime";
  return sendEmail({
    to,
    subject: `Your ${productLabel} Activation Code${resent ? " (Resent)" : ""}`,
    html: activationEmail(code, plan, expiresAt, product)
  });
}

module.exports = { activationEmail, emailConfigured, sendActivationEmail, sendEmail };

