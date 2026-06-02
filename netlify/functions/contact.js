const { sendEmail } = require("./utils/email");
const { json, method, parseBody } = require("./utils/http");
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

exports.handler = async (event) => {
  if (!method(event, ["POST"])) return json(405, { error: "Method not allowed" });
  const { name, email, subject, message } = parseBody(event);
  if (!name || !email || !subject || !message) return json(400, { error: "Missing fields" });
  await sendEmail({ to: "customerservice@sentinelprime.org", subject: `Sentinel Prime Contact: ${String(subject).slice(0, 120)}`, html: `<p><strong>${escapeHtml(name)}</strong> &lt;${escapeHtml(email)}&gt;</p><p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>` });
  return json(200, { ok: true });
};
