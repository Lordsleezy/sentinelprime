const { sendEmail } = require("./utils/email");
const { json, method, parseBody } = require("./utils/http");
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

exports.handler = async (event) => {
  if (!method(event, ["POST"])) return json(405, { error: "Method not allowed" });
  const { email } = parseBody(event);
  if (!email) return json(400, { error: "Email required" });
  await sendEmail({ to: "customerservice@sentinelprime.org", subject: "Sentinel Drive waitlist signup", html: `<p>${escapeHtml(email)} joined the Sentinel Drive waitlist.</p>` });
  return json(200, { ok: true });
};
