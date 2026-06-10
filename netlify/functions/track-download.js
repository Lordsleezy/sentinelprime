const { json, method, parseBody } = require("./utils/http");
const { createServiceClient } = require("./utils/supabase");
const crypto = require("crypto");

function hashIp(ip) {
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
}

async function geolocateIp(ip) {
  if (!ip || ip === "unknown" || ip.startsWith("127.") || ip.startsWith("::1")) {
    return { city: null, country: null };
  }
  try {
    const cleanIp = ip.split(",")[0].trim();
    const res = await fetch(`http://ip-api.com/json/${cleanIp}?fields=status,country,city`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { city: null, country: null };
    const data = await res.json();
    if (data.status === "success") {
      return { city: data.city || null, country: data.country || null };
    }
    return { city: null, country: null };
  } catch {
    return { city: null, country: null };
  }
}

exports.handler = async (event) => {
  if (!method(event, ["POST"])) {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const { product, page, user_agent, referrer } = parseBody(event);

    if (!product) {
      return json(400, { error: "Product is required" });
    }

    const supabase = createServiceClient();

    // Get client IP from headers
    const clientIp = event.headers["x-forwarded-for"] ||
                     event.headers["x-nf-client-connection-ip"] ||
                     event.headers["client-ip"] ||
                     "unknown";

    // Geolocate asynchronously — won't block the response
    geolocateIp(clientIp).then(({ city, country }) => {
      return supabase.from("download_clicks").insert({
        product,
        page: page || event.headers.referer || null,
        user_agent: user_agent || event.headers["user-agent"] || null,
        referrer: referrer || event.headers.referer || null,
        ip_hash: hashIp(clientIp),
        ip_address: clientIp !== "unknown" ? clientIp.split(",")[0].trim() : null,
        city,
        country,
      });
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
