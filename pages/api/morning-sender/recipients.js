import { dbFetch, sendError } from "../../../lib/morningSenderDb";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const { contentType } = req.query;
      const filter = contentType ? `&content_type=eq.${encodeURIComponent(contentType)}` : "";
      const rows = await dbFetch(`morning_recipients?select=*&active=eq.true${filter}&order=kakao_group.asc,name.asc`, { method: "GET" });
      return res.status(200).json({ ok: true, recipients: rows || [] });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const required = ["name", "content_type"];
      for (const key of required) {
        if (!String(body[key] || "").trim()) return res.status(400).json({ ok: false, error: `${key} is required` });
      }
      const payload = {
        name: String(body.name).trim(),
        kakao_name: String(body.kakao_name || body.name).trim(),
        email: String(body.email || "").trim() || null,
        content_type: String(body.content_type).trim(),
        kakao_group: Number(body.kakao_group || 1),
        kakao_enabled: body.kakao_enabled !== false,
        email_enabled: body.email_enabled !== false,
        active: body.active !== false,
      };
      const rows = await dbFetch("morning_recipients", { method: "POST", body: JSON.stringify(payload) });
      return res.status(201).json({ ok: true, recipient: rows?.[0] || null });
    }

    if (req.method === "PATCH") {
      const { id, ...changes } = req.body || {};
      if (!id) return res.status(400).json({ ok: false, error: "id is required" });
      const allowed = ["name","kakao_name","email","content_type","kakao_group","kakao_enabled","email_enabled","active"];
      const patch = {};
      for (const key of allowed) if (key in changes) patch[key] = changes[key];
      patch.updated_at = new Date().toISOString();
      const rows = await dbFetch(`morning_recipients?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) });
      return res.status(200).json({ ok: true, recipient: rows?.[0] || null });
    }

    res.setHeader("Allow", "GET,POST,PATCH");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (error) {
    return sendError(res, error);
  }
}
