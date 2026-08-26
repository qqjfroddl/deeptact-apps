import { agentAuthorized, dbFetch, sendError } from "../../../lib/morningSenderDb";

async function loadRecipients(job) {
  const rows = await dbFetch(
    `morning_recipients?select=*&active=eq.true&content_type=eq.${encodeURIComponent(job.content_type)}&order=kakao_group.asc,name.asc`,
    { method: "GET" }
  );
  const groups = new Set((job.kakao_groups || []).map(Number));
  return (rows || []).filter((r) => {
    const kakaoOk = job.send_kakao && r.kakao_enabled && r.kakao_name && (groups.size === 0 || groups.has(Number(r.kakao_group)));
    const emailOk = job.send_email && r.email_enabled && r.email;
    return kakaoOk || emailOk;
  });
}

export default async function handler(req, res) {
  if (!agentAuthorized(req)) return res.status(401).json({ ok: false, error: "Unauthorized agent" });

  try {
    if (req.method === "GET") {
      const jobs = await dbFetch("morning_jobs?select=*&status=eq.pending&order=created_at.asc&limit=1", { method: "GET" });
      const job = jobs?.[0];
      if (!job) return res.status(200).json({ ok: true, job: null });

      const claimed = await dbFetch(`morning_jobs?id=eq.${encodeURIComponent(job.id)}&status=eq.pending`, {
        method: "PATCH",
        body: JSON.stringify({ status: "running", started_at: new Date().toISOString(), agent_heartbeat_at: new Date().toISOString() }),
      });
      const activeJob = claimed?.[0];
      if (!activeJob) return res.status(200).json({ ok: true, job: null });
      const recipients = await loadRecipients(activeJob);
      return res.status(200).json({ ok: true, job: activeJob, recipients });
    }

    if (req.method === "PATCH") {
      const body = req.body || {};
      if (!body.job_id) return res.status(400).json({ ok: false, error: "job_id is required" });
      const patch = { agent_heartbeat_at: new Date().toISOString() };
      const allowed = ["status","success_kakao","failed_kakao","success_email","failed_email","last_error"];
      for (const key of allowed) if (key in body) patch[key] = body[key];
      if (["completed","failed","cancelled"].includes(body.status)) patch.completed_at = new Date().toISOString();
      const rows = await dbFetch(`morning_jobs?id=eq.${encodeURIComponent(body.job_id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      if (body.logs && Array.isArray(body.logs) && body.logs.length) {
        const logs = body.logs.map((l) => ({
          job_id: body.job_id,
          channel: l.channel,
          recipient_name: l.recipient_name || null,
          address: l.address || null,
          kakao_group: l.kakao_group || null,
          status: l.status,
          detail: l.detail || null,
        }));
        await dbFetch("morning_send_logs", { method: "POST", body: JSON.stringify(logs) });
      }
      return res.status(200).json({ ok: true, job: rows?.[0] || null });
    }

    res.setHeader("Allow", "GET,PATCH");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (error) {
    return sendError(res, error);
  }
}
