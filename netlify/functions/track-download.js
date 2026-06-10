const { json, method, parseBody } = require("./utils/http");
const { createServiceClient } = require("./utils/supabase");
const crypto = require("crypto");

function hashIp(ip) {
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
}

exports.handler = async (event) => {
  if (!method(event, ["POST"])) {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const { product, page, user_agent, referrer, country } = parseBody(event);

    if (!product) {
      return json(400, { error: "Product is required" });
    }

    const supabase = createServiceClient();

    // Get client IP from headers
    const clientIp = event.headers["x-forwarded-for"] ||
                     event.headers["x-nf-client-connection-ip"] ||
                     event.headers["client-ip"] ||
                     "unknown";

    // Fire and forget - don't block on this
    supabase.from("download_clicks").insert({
      product,
      page: page || event.headers.referer || null,
      user_agent: user_agent || event.headers["user-agent"] || null,
      referrer: referrer || event.headers.referer || null,
      ip_hash: hashIp(clientIp),
      country: country || null
    }).then(() => {
      // Log success silently
    }).catch((err) => {
      console.error("Failed to log download click:", err);
    });

    // Return success immediately (fire and forget)
    return json(200, { tracked: true });
  } catch (error) {
    console.error("Track download error:", error);
    // Still return success to not block the download
    return json(200, { tracked: false, error: error.message });
  }
};
