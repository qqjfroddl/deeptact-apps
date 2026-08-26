import { dbFetch, sendError } from "../../../lib/morningSenderDb";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const rows = await dbFetch("morning_jobs?select=*&order=created_at.desc&limit=20", { method: "GET" });
      return res.status(200).json({ ok: true, jobs: rows || [] });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const contentType = String(body.content_type || "").trim();
      const message = String(body.message || "").trim();
      if (!contentType || !message) return res.status(400).json({ ok: false, error: "content_type and message are required" });

      const groups = Array.isArray(body.kakao_groups)
        ? body.kakao_groups.map(Number).filter((n) => n >= 1 && n <= 8)
        : [];

      const payload = {
        content_type: contentType,
        subject: String(body.subject || "").trim() || contentType,
        message,
        send_kakao: body.send_kakao !== false,
        send_email: body.send_email !== false,
        kakao_groups: groups,
        status: "pending",
        created_by: "web",
        total_kakao: Number(body.total_kakao || 0),
        total_email: Number(body.total_email || 0),
        success_kakao: 0,
        failed_kakao: 0,
        success_email: 0,
        failed_email: 0,
      };
      const rows = await dbFetch("morning_jobs", { method: "POST", body: JSON.stringify(payload) });
      return res.status(201).json({ ok: true, job: rows?.[0] || null });
    }

    res.setHeader("Allow", "GET,POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (error) {
    return sendError(res, error);
  }
}
