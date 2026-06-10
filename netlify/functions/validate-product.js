const { json, method, parseBody } = require("./utils/http");
const { createServiceClient } = require("./utils/supabase");

exports.handler = async (event) => {
  if (!method(event, ["POST"])) {
    return json(405, { valid: false, reason: "Method not allowed" });
  }

  const { code, email, product, machine_id } = parseBody(event);

  if (!code || !email || !product) {
    return json(400, { valid: false, reason: "Code, email, and product are required" });
  }

  try {
    const supabase = createServiceClient();
    const normalizedCode = String(code).toUpperCase().trim();
    const normalizedEmail = String(email).toLowerCase().trim();

    // Look up the activation code
    const { data, error } = await supabase
      .from("activation_codes")
      .select("*")
      .eq("code", normalizedCode)
      .eq("email", normalizedEmail)
      .eq("product", product)
      .maybeSingle();

    if (error || !data) {
      return json(200, { valid: false, reason: "Invalid activation code or email" });
    }

    // Check status
    if (["revoked", "cancelled"].includes(data.status)) {
      return json(200, { valid: false, reason: `Code has been ${data.status}` });
    }

    // Check expiration
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      await supabase
        .from("activation_codes")
        .update({ status: "expired" })
        .eq("id", data.id);
      return json(200, { valid: false, reason: "Activation code has expired" });
    }

    // If already active (activated before), it's valid but already used
    if (data.status === "active" && data.activated_at) {
      return json(200, {
        valid: true,
        already_activated: true,
        message: "Code is valid and has been previously activated",
        activated_at: data.activated_at
      });
    }

    // Mark as activated (first time)
    const now = new Date().toISOString();
    const updates = {
      status: "active",
      activated_at: now,
      last_validated_at: now
    };

    if (machine_id) {
      updates.machine_id = machine_id;
    }

    await supabase
      .from("activation_codes")
      .update(updates)
      .eq("id", data.id);

    return json(200, {
      valid: true,
      first_activation: true,
      activated_at: now,
      product: data.product,
      type: data.type
    });

  } catch (error) {
    console.error("Validation error:", error);
    return json(503, { valid: false, reason: "Activation service is not configured" });
  }
};
