const account = require("../../lib/account_store");
const analytics = require("../../lib/analytics_store");
const { json, method } = require("./utils/http");
const { verifyAdminSession } = require("./utils/admin");

exports.handler = async (event) => {
  if (!method(event, ["GET"])) return json(405, { error: "Method not allowed" });
  try {
    if (!(await verifyAdminSession(event))) return json(401, { error: "Unauthorized" });
    await account.init();
    await analytics.init();
    const stats = await analytics.getAdminAnalytics();
    return json(200, stats);
  } catch (error) {
    return json(503, { error: error.message || "Analytics service is not configured yet." });
  }
};
