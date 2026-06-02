const { json, method } = require("./utils/http");
const { verifyAdminSession } = require("./utils/admin");
const { createServiceClient } = require("./utils/supabase");

exports.handler = async (event) => {
  if (!method(event, ["GET"])) return json(405, { error: "Method not allowed" });
  try {
    if (!(await verifyAdminSession(event))) return json(401, { error: "Unauthorized" });
    const { data: codes } = await createServiceClient().from("activation_codes").select("*").order("created_at", { ascending: false }).limit(100);
    const list = codes || [];
    return json(200, {
      codes: list,
      stats: {
        total: list.length,
        active: list.filter((code) => ["unused", "active"].includes(code.status)).length,
        expired: list.filter((code) => code.status === "expired").length,
        monthly: list.filter((code) => code.type === "monthly").length,
        annual: list.filter((code) => code.type === "annual").length,
        lifetime: list.filter((code) => code.type === "lifetime").length
      }
    });
  } catch {
    return json(503, { error: "Admin database is not configured yet." });
  }
};

