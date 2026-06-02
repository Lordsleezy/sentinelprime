const { json, method, parseBody } = require("./utils/http");
const { verifyAdminSession } = require("./utils/admin");
const { createServiceClient } = require("./utils/supabase");

exports.handler = async (event) => {
  if (!method(event, ["POST"])) return json(405, { error: "Method not allowed" });
  try {
    if (!(await verifyAdminSession(event))) return json(401, { error: "Unauthorized" });
    const { id } = parseBody(event);
    if (!id) return json(400, { error: "Code ID required" });
    await createServiceClient().from("activation_codes").update({ status: "revoked" }).eq("id", id);
    return json(200, { ok: true });
  } catch {
    return json(503, { error: "Admin database is not configured yet." });
  }
};

