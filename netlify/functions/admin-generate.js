const { createCode, expiryFor } = require("./utils/codes");
const { sendActivationEmail, sendProductActivationEmail } = require("./utils/email");
const { json, method, parseBody } = require("./utils/http");
const { verifyAdminSession } = require("./utils/admin");
const { createServiceClient } = require("./utils/supabase");

exports.handler = async (event) => {
  if (!method(event, ["POST"])) return json(405, { error: "Method not allowed" });
  try {
    if (!(await verifyAdminSession(event))) return json(401, { error: "Unauthorized" });
    const { type, email, product, notes } = parseBody(event);

    if (!email) return json(400, { error: "Email is required before generating a code." });
    if (!["monthly", "annual", "lifetime", "gift", "admin"].includes(type)) {
      return json(400, { error: "Invalid type" });
    }

    const productValue = product || "sentinelai";
    if (!["shield", "shift", "earn", "sentinelai", "care"].includes(productValue)) {
      return json(400, { error: "Invalid product" });
    }

    const supabase = createServiceClient();
    const expiresAt = expiryFor(type);
    const code = await createCode(supabase, {
      type,
      product: productValue,
      email,
      expiresAt,
      notes: notes || "Admin generated"
    });

    await supabase.from("code_generation_log").insert({
      code_id: code.id,
      generated_by: "admin",
      product: productValue,
      notes: notes || null
    });

    if (productValue === "sentinelai") {
      await sendActivationEmail({ to: email, code: code.code, plan: type, expiresAt });
    } else {
      await sendProductActivationEmail({ to: email, code: code.code, product: productValue });
    }

    return json(200, {
      code: code.code,
      type,
      product: productValue,
      email,
      expires_at: expiresAt
    });
  } catch (err) {
    console.error("Admin generate error:", err);
    return json(503, { error: "Admin generator is not configured yet." });
  }
};
