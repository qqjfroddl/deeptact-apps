const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function assertServerConfig() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const err = new Error("Morning Sender backend is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    err.statusCode = 503;
    throw err;
  }
}

export async function dbFetch(path, options = {}) {
  assertServerConfig();
  const url = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!res.ok) {
    const err = new Error(data?.message || data?.hint || `Supabase request failed (${res.status})`);
    err.statusCode = res.status;
    err.detail = data;
    throw err;
  }
  return data;
}

export function agentAuthorized(req) {
  const expected = process.env.MORNING_AGENT_KEY;
  if (!expected) return false;
  const supplied = req.headers["x-morning-agent-key"];
  return typeof supplied === "string" && supplied === expected;
}

export function sendError(res, error) {
  console.error(error);
  res.status(error.statusCode || 500).json({
    ok: false,
    error: error.message || "Unknown error",
    detail: process.env.NODE_ENV === "development" ? error.detail || null : undefined,
  });
}
