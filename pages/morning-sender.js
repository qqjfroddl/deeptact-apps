import Head from "next/head";
import { useEffect, useMemo, useState } from "react";

const TYPES = ["5분 리프레시", "크리스찬 말씀"];
const DEFAULT_SUBJECTS = { "5분 리프레시": "[5분 리프레시]", "크리스찬 말씀": "[아침 말씀]" };

export default function MorningSender() {
  const [type, setType] = useState(TYPES[0]);
  const [subject, setSubject] = useState(DEFAULT_SUBJECTS[TYPES[0]]);
  const [message, setMessage] = useState("");
  const [recipients, setRecipients] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [groups, setGroups] = useState([1,2,3,4,5,6,7,8]);
  const [sendKakao, setSendKakao] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => { setSubject(DEFAULT_SUBJECTS[type]); loadRecipients(type); }, [type]);
  useEffect(() => { loadJobs(); const id=setInterval(loadJobs,5000); return()=>clearInterval(id); }, []);

  async function api(url, options) {
    const res = await fetch(url, options);
    const data = await res.json();
    if (!res.ok || data.ok === false) throw new Error(data.error || "요청 실패");
    return data;
  }

  async function loadRecipients(contentType=type) {
    try {
      const data = await api(`/api/morning-sender/recipients?contentType=${encodeURIComponent(contentType)}`);
      setRecipients(data.recipients || []);
      setNotice("");
    } catch (e) { setRecipients([]); setNotice(e.message); }
  }

  async function loadJobs() {
    try { const data=await api("/api/morning-sender/jobs"); setJobs(data.jobs || []); } catch {}
  }

  const kakaoCount = useMemo(() => recipients.filter(r => sendKakao && r.kakao_enabled && r.kakao_name && groups.includes(Number(r.kakao_group))).length, [recipients,sendKakao,groups]);
  const emailCount = useMemo(() => recipients.filter(r => sendEmail && r.email_enabled && r.email).length, [recipients,sendEmail]);

  function toggleGroup(g) { setGroups(v => v.includes(g) ? v.filter(x=>x!==g) : [...v,g].sort()); }

  async function createJob() {
    if (!message.trim()) return setNotice("오늘의 글을 입력해 주세요.");
    if (!sendKakao && !sendEmail) return setNotice("발송 채널을 하나 이상 선택해 주세요.");
    if (!confirm(`${type}\n카카오톡 ${kakaoCount}명 / 이메일 ${emailCount}명\n발송 작업을 생성할까요?`)) return;
    setLoading(true); setNotice("");
    try {
      await api("/api/morning-sender/jobs", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ content_type:type, subject, message, send_kakao:sendKakao, send_email:sendEmail, kakao_groups:groups, total_kakao:kakaoCount, total_email:emailCount })
      });
      setNotice("발송 작업을 등록했습니다. Windows Agent가 자동으로 가져갑니다.");
      await loadJobs();
    } catch(e) { setNotice(e.message); } finally { setLoading(false); }
  }

  const latest = jobs[0];
  const statusLabel = {pending:"대기",running:"발송 중",completed:"완료",failed:"실패",cancelled:"취소"};

  return <>
    <Head><title>아침 콘텐츠 통합 발송 | Deeptact Apps</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
    <main className="page">
      <header>
        <a href="/" className="back">← 앱 라이브러리</a>
        <div><span className="eyebrow">MORN · 실무 도구</span><h1>아침 콘텐츠 통합 발송</h1><p>글 한 번 입력하고, 카카오톡 8개 그룹과 네이버 메일을 한 번에 발송합니다.</p></div>
      </header>

      {notice && <div className="notice">{notice}</div>}

      <section className="grid">
        <article className="card composer">
          <h2>오늘의 콘텐츠</h2>
          <div className="seg">{TYPES.map(t=><button key={t} className={type===t?"on":""} onClick={()=>setType(t)}>{t}</button>)}</div>
          <label>메일 제목<input value={subject} onChange={e=>setSubject(e.target.value)} /></label>
          <label>오늘의 글<textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder="오늘 보낼 글을 붙여 넣어 주세요." /></label>
          <div className="channels">
            <label><input type="checkbox" checked={sendKakao} onChange={e=>setSendKakao(e.target.checked)} /> 카카오톡 <strong>{kakaoCount}명</strong></label>
            <label><input type="checkbox" checked={sendEmail} onChange={e=>setSendEmail(e.target.checked)} /> 네이버 메일 <strong>{emailCount}명</strong></label>
          </div>
          <h3>카카오톡 그룹</h3>
          <div className="groups">{[1,2,3,4,5,6,7,8].map(g=><button key={g} className={groups.includes(g)?"active":""} onClick={()=>toggleGroup(g)}>{g}그룹</button>)}</div>
          <button className="send" onClick={createJob} disabled={loading}>{loading?"등록 중...":`발송 작업 만들기 · 총 ${kakaoCount+emailCount}건`}</button>
          <p className="hint">웹에서는 작업만 등록합니다. 실제 카카오톡 조작과 네이버 SMTP 발송은 Windows Agent가 수행합니다.</p>
        </article>

        <aside>
          <article className="card status">
            <div className="titleRow"><h2>현재 발송 상태</h2><button onClick={loadJobs}>새로고침</button></div>
            {!latest ? <p className="muted">아직 발송 기록이 없습니다.</p> : <>
              <div className={`pill ${latest.status}`}>{statusLabel[latest.status] || latest.status}</div>
              <h3>{latest.content_type}</h3>
              <p className="date">{new Date(latest.created_at).toLocaleString("ko-KR")}</p>
              <div className="stats"><div><span>카카오톡</span><b>{latest.success_kakao || 0}/{latest.total_kakao || 0}</b><small>실패 {latest.failed_kakao || 0}</small></div><div><span>이메일</span><b>{latest.success_email || 0}/{latest.total_email || 0}</b><small>실패 {latest.failed_email || 0}</small></div></div>
              {latest.last_error && <div className="error">{latest.last_error}</div>}
            </>}
          </article>

          <article className="card recipients">
            <div className="titleRow"><h2>수신자 현황</h2><button onClick={()=>loadRecipients()}>새로고침</button></div>
            <div className="miniStats"><span>전체 <b>{recipients.length}</b></span><span>카톡 <b>{recipients.filter(r=>r.kakao_enabled&&r.kakao_name).length}</b></span><span>메일 <b>{recipients.filter(r=>r.email_enabled&&r.email).length}</b></span></div>
            <div className="list">{recipients.slice(0,12).map(r=><div key={r.id}><span>{r.name}</span><small>{r.kakao_group ? `${r.kakao_group}그룹` : "-"}</small><em>{r.kakao_enabled?"K":""}{r.email_enabled?" E":""}</em></div>)}</div>
            {recipients.length>12 && <p className="more">외 {recipients.length-12}명</p>}
          </article>
        </aside>
      </section>
    </main>
    <style jsx>{`
      :global(*){box-sizing:border-box} :global(body){margin:0;background:#f5f7fb;color:#152033;font-family:Pretendard,"Noto Sans KR",system-ui,sans-serif}
      .page{max-width:1180px;margin:0 auto;padding:34px 22px 70px} header{display:flex;gap:26px;align-items:flex-start;margin-bottom:26px}.back{color:#5b6473;text-decoration:none;font-size:14px;padding-top:6px;white-space:nowrap}.eyebrow{font-size:12px;font-weight:800;letter-spacing:.12em;color:#6d5dfc}h1{font-size:34px;margin:6px 0 7px}header p{margin:0;color:#687386}.notice{margin:0 0 16px;padding:13px 15px;border-radius:12px;background:#fff7d6;border:1px solid #eadb8e;color:#6d5a00}.grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(300px,.8fr);gap:18px}.card{background:white;border:1px solid #e5e9f2;border-radius:18px;padding:22px;box-shadow:0 8px 28px rgba(20,35,70,.05)}aside{display:grid;gap:18px;align-content:start}h2{font-size:18px;margin:0 0 16px}h3{font-size:14px;margin:18px 0 10px}.seg{display:grid;grid-template-columns:1fr 1fr;background:#f1f3f8;padding:4px;border-radius:12px;margin-bottom:16px}.seg button{border:0;background:transparent;border-radius:9px;padding:11px;font-weight:700;color:#6b7482}.seg button.on{background:white;color:#312e81;box-shadow:0 2px 10px rgba(30,40,80,.08)}label{display:block;font-size:13px;font-weight:700;color:#536071;margin-top:13px}input,textarea{width:100%;margin-top:7px;border:1px solid #dfe4ed;border-radius:11px;padding:12px 13px;font:inherit;color:#182233;background:#fff}textarea{min-height:315px;resize:vertical;line-height:1.65}.channels{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}.channels label{margin:0;border:1px solid #e1e5ee;border-radius:12px;padding:13px;display:flex;align-items:center;gap:8px}.channels input{width:auto;margin:0}.channels strong{margin-left:auto;color:#312e81}.groups{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.groups button{padding:10px;border:1px solid #dde3ec;background:white;border-radius:10px;font-weight:700;color:#697386}.groups button.active{background:#312e81;color:white;border-color:#312e81}.send{width:100%;margin-top:18px;padding:15px;border:0;border-radius:12px;background:#111827;color:white;font-size:16px;font-weight:800;cursor:pointer}.send:disabled{opacity:.5}.hint{font-size:12px;color:#8791a1;line-height:1.5}.titleRow{display:flex;justify-content:space-between;align-items:center}.titleRow h2{margin:0}.titleRow button{border:0;background:#f3f5f8;border-radius:8px;padding:7px 9px;color:#5b6473}.pill{display:inline-block;margin-top:16px;padding:6px 9px;border-radius:999px;font-size:12px;font-weight:800;background:#eef1f5}.pill.running{background:#e8edff;color:#3c48a7}.pill.completed{background:#e5f7ec;color:#17753c}.pill.failed{background:#ffe9e9;color:#a52e2e}.status h3{font-size:18px;margin:12px 0 2px}.date,.muted,.more{color:#8a94a3;font-size:12px}.stats{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}.stats div{padding:14px;background:#f7f8fb;border-radius:12px}.stats span,.stats small{display:block;color:#7b8594;font-size:11px}.stats b{display:block;font-size:23px;margin:5px 0}.error{margin-top:12px;padding:10px;background:#fff0f0;color:#9b2c2c;border-radius:9px;font-size:12px}.miniStats{display:flex;gap:8px;margin:16px 0}.miniStats span{flex:1;background:#f7f8fb;padding:10px;border-radius:10px;font-size:11px;color:#7b8594}.miniStats b{display:block;color:#222b3b;font-size:17px;margin-top:2px}.list>div{display:grid;grid-template-columns:1fr 60px 38px;gap:8px;padding:9px 0;border-bottom:1px solid #eff1f5;font-size:13px}.list small{color:#8791a1}.list em{font-style:normal;color:#5b54c7;font-size:11px;font-weight:800}@media(max-width:850px){.grid{grid-template-columns:1fr}header{display:block}.back{display:inline-block;margin-bottom:15px}.channels{grid-template-columns:1fr}.groups{grid-template-columns:repeat(2,1fr)}h1{font-size:28px}}
    `}</style>
  </>;
}
