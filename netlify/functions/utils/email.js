const { Resend } = require("resend");

function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

const PRODUCT_LABELS = {
  linux: "Sentinel Linux",
  guardian: "Sentinel Guardian",
  projects: "Sentinel Prospects",
  care: "SentinelCare"
};

function activationEmail(code, plan, expiresAt, product = "care") {
  const planLabel = { monthly: "Monthly Plan", annual: "Annual Plan", lifetime: "Lifetime License", gift: "Gift License", admin: "Admin License" }[plan] || plan;
  const productLabel = PRODUCT_LABELS[product] || product;
  const expiry = expiresAt ? `<p>Your access is active until <strong>${new Date(expiresAt).toLocaleDateString()}</strong>.</p>` : "<p>This license does not expire.</p>";
  const downloadHint = product === "care"
    ? "<p>Visit sentinelprime.org/care to activate your subscription.</p>"
    : product === "projects"
      ? "<p>Visit prospects.sentinelprime.org to launch Sentinel Prospects.</p>"
      : "<p>Visit sentinelprime.org/products and enter this code when prompted.</p>";
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

async function sendActivationEmail({ to, code, plan, expiresAt, product = "care", resent = false }) {
  const productLabel = PRODUCT_LABELS[product] || "Sentinel Prime";
  return sendEmail({
    to,
    subject: `Your ${productLabel} Activation Code${resent ? " (Resent)" : ""}`,
    html: activationEmail(code, plan, expiresAt, product)
  });
}

function productActivationEmail(code, productName, productSlug) {
  return `<div style="background:#000005;color:#fff;font-family:system-ui,-apple-system,sans-serif;padding:40px;max-width:640px;margin:auto;border-radius:8px">
    <h1 style="color:#00d4ff;margin:0 0 8px">Sentinel Prime</h1>
    <h2 style="color:#fff;margin:0 0 24px;font-weight:500">Your ${productName} Activation Code</h2>
    <p style="color:#9aa3ad;line-height:1.6">Thank you for purchasing ${productName}. Use the activation code below to unlock your software:</p>
    <div style="border:2px solid #00d4ff;padding:24px;text-align:center;margin:24px 0;border-radius:8px;background:rgba(0,212,255,0.05)">
      <strong style="font-size:28px;letter-spacing:4px;color:#00d4ff;font-family:monospace">${code}</strong>
    </div>
    <p style="color:#9aa3ad;line-height:1.6"><strong>How to activate:</strong></p>
    <ol style="color:#9aa3ad;line-height:1.6;margin:16px 0;padding-left:24px">
      <li>Install ${productName} on your device</li>
      <li>Launch the application</li>
      <li>Enter your email and the activation code above when prompted</li>
    </ol>
    <p style="color:#9aa3ad;line-height:1.6">Keep this code safe — you'll need it if you reinstall the software.</p>
    <hr style="border-color:#333;margin:32px 0">
    <p style="color:#666;font-size:13px;margin:0">
      Need help? Contact us at <a href="mailto:customerservice@sentinelprime.org" style="color:#00d4ff;text-decoration:none">customerservice@sentinelprime.org</a>
    </p>
  </div>`;
}

async function sendProductActivationEmail({ to, code, product, productName }) {
  const productNames = {
    guardian: "Sentinel Guardian",
    linux: "Sentinel Linux",
    projects: "Sentinel Prospects",
    care: "SentinelCare"
  };
  const name = productName || productNames[product] || product;

  return sendEmail({
    to,
    from: process.env.RESEND_FROM || "Sentinel Prime <customerservice@sentinelprime.org>",
    subject: `Your ${name} Activation Code`,
    html: productActivationEmail(code, name, product)
  });
}

module.exports = { activationEmail, emailConfigured, sendActivationEmail, sendProductActivationEmail, sendEmail };

