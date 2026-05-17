// 앱 1개를 표시하는 카드 — 핀 토글 버튼 + 링크/QR/GitHub 액션
import { useState, useEffect } from "react";

const STATUS_LABEL = {
  live: "라이브",
  wip: "작업중",
  archived: "보관",
};

export default function AppCard({ app, onTogglePin, isEditing, isEdited, isCustom, onEdit, onDelete }) {
  const [copied, setCopied] = useState(false);
  const [qrSrc, setQrSrc] = useState("");
  const [showQr, setShowQr] = useState(false);

  const openUrl = app.url || app.homepage || "";
  const repoUrl = app.repoUrl || (app.repo ? `https://github.com/${app.owner || ""}/${app.repo}` : "");
  const updated = app.updated_at
    ? new Date(app.updated_at).toLocaleDateString("ko-KR")
    : "";

  function copy() {
    if (!openUrl) return;
    navigator.clipboard.writeText(openUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  useEffect(() => {
    if (!showQr || !openUrl) return;
    (async () => {
      try {
        const QR = (await import("qrcode")).default;
        const dataUrl = await QR.toDataURL(openUrl, {
          width: 240,
          margin: 1,
          color: { dark: "#1F2933", light: "#ffffff" },
        });
        setQrSrc(dataUrl);
      } catch (e) {
        // QR 생성 실패는 조용히 무시
      }
    })();
  }, [showQr, openUrl]);

  return (
    <article className="app-card">
      <header className="card-head">
        <div className="card-head-left">
          <span className="code-badge">{app.code || "—"}</span>
          <span className="card-category">{app.category || "기타"}</span>
        </div>
        <div className="card-head-right">
          {isEditing && isCustom && (
            <span className="edit-badge edit-badge-new">신규</span>
          )}
          {isEditing && isEdited && !isCustom && (
            <span className="edit-badge edit-badge-edited">수정됨</span>
          )}
          <span className={`status-chip status-${app.status || "wip"}`}>
            {STATUS_LABEL[app.status] || "작업중"}
          </span>
          {onTogglePin && app.repo && !isEditing && (
            <button
              type="button"
              className={`pin-btn ${app.pinned ? "active" : ""}`}
              onClick={() => onTogglePin(app.repo)}
              title={app.pinned ? "핀 해제" : "핀 고정"}
              aria-label={app.pinned ? "핀 해제" : "핀 고정"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={app.pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 17v5" />
                <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
              </svg>
            </button>
          )}
        </div>
      </header>

      <h3 className="card-title">{app.name || app.repo}</h3>
      <p className="card-meta">
        {app.version ? `${app.version} · ` : ""}
        {updated || ""}
      </p>

      {app.description && <p className="card-desc">{app.description}</p>}

      {openUrl && (
        <div className="url-box" title={openUrl}>
          {openUrl}
        </div>
      )}

      <div className="card-actions">
        {isEditing ? (
          <>
            <button
              type="button"
              className="btn-primary"
              onClick={() => onEdit && onEdit(app)}
            >
              편집
            </button>
            <button
              type="button"
              className="icon-btn icon-btn-danger"
              onClick={() => onDelete && onDelete(app)}
              title="삭제"
              aria-label="삭제"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          </>
        ) : (
        <a
          className={`btn-primary ${!openUrl ? "disabled" : ""}`}
          href={openUrl || undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!openUrl}
          onClick={(e) => { if (!openUrl) e.preventDefault(); }}
        >
          앱 열기
        </a>
        )}
        {!isEditing && (
        <button
          type="button"
          className="icon-btn"
          onClick={copy}
          disabled={!openUrl}
          title="링크 복사"
          aria-label="링크 복사"
        >
          {copied ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
          )}
        </button>
        )}
        {!isEditing && (
        <button
          type="button"
          className="icon-btn"
          onClick={() => setShowQr((v) => !v)}
          disabled={!openUrl}
          title="QR 코드"
          aria-label="QR 코드"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <path d="M14 14h3v3h-3zM20 14h1M14 20h1M20 17v4" />
          </svg>
        </button>
        )}
        {!isEditing && repoUrl && (
          <a
            className="icon-btn"
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="GitHub"
            aria-label="GitHub 저장소 열기"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55v-1.94c-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.27-1.68-1.27-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.76 2.68 1.25 3.34.95.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18.92-.26 1.9-.39 2.88-.39s1.96.13 2.88.39c2.19-1.49 3.15-1.18 3.15-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.4-5.26 5.68.41.36.77 1.06.77 2.15v3.18c0 .31.21.66.79.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
            </svg>
          </a>
        )}
      </div>

      {showQr && qrSrc && (
        <div className="qr-popover" role="dialog" aria-label="QR 코드">
          <img src={qrSrc} alt={`${app.name} QR 코드`} />
          <button type="button" className="qr-close" onClick={() => setShowQr(false)} aria-label="닫기">
            ✕
          </button>
        </div>
      )}
    </article>
  );
}
