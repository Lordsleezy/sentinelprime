function json(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body)
  };
}

function method(event, allowed) {
  return allowed.includes(event.httpMethod);
}

function parseBody(event) {
  try {
    return JSON.parse(event.body || "{}");
  } catch {
    return {};
  }
}

function cookie(event, name) {
  const header = event.headers?.cookie || event.headers?.Cookie || "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

module.exports = { json, method, parseBody, cookie };

