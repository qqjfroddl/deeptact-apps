// 딥택트러닝 앱 라이브러리 메인 — 헤더 + 통계 + 검색·필터 + 카드 그리드 (+ 편집 모드)
import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import fs from "fs";
import path from "path";

import AppCard from "../components/AppCard";
import ThemeToggle from "../components/ThemeToggle";
import EditDialog from "../components/EditDialog";
import CategoryManager from "../components/CategoryManager";
import {
  loadEditState,
  saveEdits,
  saveCustom,
  saveCategories,
  saveDeleted,
  savePins,
  clearAllEdits,
  newCustomId,
  mergeApps,
  mergeCategories,
  isCustomApp,
  isEditedApp,
  normalizeAppInput,
  exportAsJson,
  downloadText,
} from "../lib/edits";

// --- getStaticProps: apps.json 로드 + GitHub API 자동 enrich (옵션) ---
export async function getStaticProps() {
  const file = path.join(process.cwd(), "lib", "apps.json");
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));

  const owner = process.env.GITHUB_OWNER;
  const token = process.env.GITHUB_TOKEN;

  async function enrich(app) {
    if (!owner || !app.repo) {
      return { ...app, owner: owner || null, repoUrl: null };
    }
    const repoUrl = `https://github.com/${owner}/${app.repo}`;
    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${app.repo}`, {
        headers: token
          ? { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" }
          : { Accept: "application/vnd.github+json" },
      });
      if (!res.ok) return { ...app, owner, repoUrl };
      const data = await res.json();
      return {
        ...app,
        owner,
        repoUrl,
        description: app.description || data.description || "",
        url: app.url || data.homepage || "",
        updated_at: data.pushed_at || data.updated_at || null,
      };
    } catch {
      return { ...app, owner, repoUrl };
    }
  }

  const apps = await Promise.all(raw.map(enrich));

  return {
    props: { apps },
    revalidate: 3600, // 1시간마다 재생성
  };
}

export default function Home({ apps: baselineApps }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("전체");
  const [editMode, setEditMode] = useState(false);
  const [editState, setEditState] = useState({
    edits: {}, custom: [], categories: [], deleted: [], pins: {},
  });
  const [dialog, setDialog] = useState({ open: false, mode: "edit", app: null });
  const [catManagerOpen, setCatManagerOpen] = useState(false);

  useEffect(() => {
    setEditState(loadEditState());
  }, []);

  // 모든 머지된 앱 (baseline ⊕ overrides ⊕ deleted ⊕ custom)
  const apps = useMemo(
    () => mergeApps(baselineApps, editState),
    [baselineApps, editState]
  );

  function togglePin(repo) {
    setEditState((prev) => {
      const app = apps.find((a) => a.repo === repo);
      const currentlyPinned =
        prev.edits[repo]?.pinned != null
          ? prev.edits[repo].pinned
          : repo in prev.pins
          ? prev.pins[repo]
          : !!app?.pinned;
      const nextPins = { ...prev.pins, [repo]: !currentlyPinned };
      savePins(nextPins);
      // edits.pinned 가 있으면 pins 가 가려지므로 함께 제거
      let nextEdits = prev.edits;
      if (prev.edits[repo]?.pinned != null) {
        const { pinned: _, ...rest } = prev.edits[repo];
        nextEdits = { ...prev.edits, [repo]: rest };
        if (Object.keys(rest).length === 0) {
          const { [repo]: __, ...editsClean } = nextEdits;
          nextEdits = editsClean;
        }
        saveEdits(nextEdits);
      }
      return { ...prev, pins: nextPins, edits: nextEdits };
    });
  }

  function openEditFor(app) {
    setDialog({ open: true, mode: "edit", app });
  }
  function openCreate() {
    setDialog({ open: true, mode: "create", app: null });
  }
  function closeDialog() {
    setDialog({ open: false, mode: "edit", app: null });
  }

  function saveDialog(values) {
    const cleaned = normalizeAppInput(values);
    if (dialog.mode === "create") {
      const newApp = {
        repo: newCustomId(),
        ...cleaned,
        status: cleaned.status || "live",
        pinned: !!cleaned.pinned,
      };
      const nextCustom = [...editState.custom, newApp];
      saveCustom(nextCustom);
      // 새 카테고리가 있으면 customCategories 에도 자동 등록
      let nextCategories = editState.categories;
      if (cleaned.category && !mergeCategories(apps, editState.categories).includes(cleaned.category)) {
        nextCategories = Array.from(new Set([...editState.categories, cleaned.category]));
        saveCategories(nextCategories);
      }
      setEditState((prev) => ({ ...prev, custom: nextCustom, categories: nextCategories }));
    } else {
      const target = dialog.app;
      if (!target) return closeDialog();
      const repo = target.repo;
      // baseline 앱은 edits 에, custom 앱은 custom 배열에 직접 반영
      if (isCustomApp(target)) {
        const nextCustom = editState.custom.map((a) =>
          a.repo === repo ? { ...a, ...cleaned } : a
        );
        saveCustom(nextCustom);
        let nextCategories = editState.categories;
        if (cleaned.category && !mergeCategories(apps, editState.categories).includes(cleaned.category)) {
          nextCategories = Array.from(new Set([...editState.categories, cleaned.category]));
          saveCategories(nextCategories);
        }
        setEditState((prev) => ({ ...prev, custom: nextCustom, categories: nextCategories }));
      } else {
        // pinned 는 pins 시스템과 일치하도록 별도로 처리
        const { pinned, ...restClean } = cleaned;
        const nextEdits = { ...editState.edits, [repo]: { ...(editState.edits[repo] || {}), ...restClean } };
        // 빈 객체면 제거 (수정됨 배지 정확성)
        if (Object.keys(nextEdits[repo]).length === 0) delete nextEdits[repo];
        saveEdits(nextEdits);

        let nextPins = editState.pins;
        if (typeof pinned === "boolean") {
          nextPins = { ...editState.pins, [repo]: pinned };
          savePins(nextPins);
        }

        let nextCategories = editState.categories;
        if (cleaned.category && !mergeCategories(apps, editState.categories).includes(cleaned.category)) {
          nextCategories = Array.from(new Set([...editState.categories, cleaned.category]));
          saveCategories(nextCategories);
        }
        setEditState((prev) => ({ ...prev, edits: nextEdits, pins: nextPins, categories: nextCategories }));
      }
    }
    closeDialog();
  }

  function deleteApp(app) {
    if (!confirm(`'${app.name || app.repo}' 앱을 삭제할까요?`)) return;
    setEditState((prev) => {
      if (isCustomApp(app)) {
        const nextCustom = prev.custom.filter((a) => a.repo !== app.repo);
        saveCustom(nextCustom);
        return { ...prev, custom: nextCustom };
      }
      const nextDeleted = Array.from(new Set([...prev.deleted, app.repo]));
      saveDeleted(nextDeleted);
      return { ...prev, deleted: nextDeleted };
    });
  }

  function addCategory(name) {
    if (!name) return;
    setEditState((prev) => {
      const next = Array.from(new Set([...prev.categories, name]));
      saveCategories(next);
      return { ...prev, categories: next };
    });
  }

  function renameCategory(oldName, newName) {
    setEditState((prev) => {
      const nextCategories = prev.categories.map((c) => (c === oldName ? newName : c));
      saveCategories(nextCategories);
      // baseline 앱: edits 에 category 오버라이드
      const nextEdits = { ...prev.edits };
      baselineApps.forEach((a) => {
        const effective = nextEdits[a.repo]?.category ?? a.category;
        if (effective === oldName) {
          nextEdits[a.repo] = { ...(nextEdits[a.repo] || {}), category: newName };
        }
      });
      saveEdits(nextEdits);
      // custom 앱: 직접 수정
      const nextCustom = prev.custom.map((a) =>
        a.category === oldName ? { ...a, category: newName } : a
      );
      saveCustom(nextCustom);
      return { ...prev, categories: nextCategories, edits: nextEdits, custom: nextCustom };
    });
  }

  function deleteCategory(name, replaceWith = "") {
    setEditState((prev) => {
      const nextCategories = prev.categories.filter((c) => c !== name);
      saveCategories(nextCategories);
      const nextEdits = { ...prev.edits };
      baselineApps.forEach((a) => {
        const effective = nextEdits[a.repo]?.category ?? a.category;
        if (effective === name) {
          nextEdits[a.repo] = { ...(nextEdits[a.repo] || {}), category: replaceWith };
        }
      });
      saveEdits(nextEdits);
      const nextCustom = prev.custom.map((a) =>
        a.category === name ? { ...a, category: replaceWith } : a
      );
      saveCustom(nextCustom);
      // 현재 필터가 삭제된 카테고리라면 전체로 리셋
      if (filter === name) setFilter("전체");
      return { ...prev, categories: nextCategories, edits: nextEdits, custom: nextCustom };
    });
  }

  function handleExport() {
    const json = exportAsJson(apps);
    downloadText("apps.json", json);
  }

  function handleResetAll() {
    if (!confirm("모든 편집 내용을 삭제하고 apps.json 원본 상태로 되돌릴까요?\n(핀 설정은 유지됩니다)")) return;
    clearAllEdits();
    setEditState((prev) => ({ ...prev, edits: {}, custom: [], categories: [], deleted: [] }));
  }

  const allCategories = useMemo(
    () => mergeCategories(apps, editState.categories),
    [apps, editState.categories]
  );

  // 카테고리 칩 목록 — "전체" + 사용중인 카테고리
  const categories = useMemo(() => ["전체", ...allCategories], [allCategories]);

  const stats = useMemo(() => {
    const total = apps.length;
    const live = apps.filter((a) => a.status === "live").length;
    const wip = apps.filter((a) => a.status === "wip").length;
    return { total, live, wip };
  }, [apps]);

  const appsByCategory = useMemo(() => {
    const counts = {};
    apps.forEach((a) => {
      if (!a.category) return;
      counts[a.category] = (counts[a.category] || 0) + 1;
    });
    return counts;
  }, [apps]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return apps
      .filter((a) => {
        if (filter !== "전체" && a.category !== filter) return false;
        if (!q) return true;
        const hay = `${a.name || ""} ${a.code || ""} ${a.description || ""} ${a.repo || ""}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        if (!!b.pinned - !!a.pinned !== 0) return !!b.pinned - !!a.pinned;
        const ad = a.updated_at ? Date.parse(a.updated_at) : 0;
        const bd = b.updated_at ? Date.parse(b.updated_at) : 0;
        return bd - ad;
      });
  }, [apps, query, filter]);

  const hasAnyEdits =
    Object.keys(editState.edits).length > 0 ||
    editState.custom.length > 0 ||
    editState.deleted.length > 0 ||
    editState.categories.length > 0;

  return (
    <>
      <Head>
        <title>딥택트러닝 앱 라이브러리</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://deeptactlearning-fonts.netlify.app/fonts.css" rel="stylesheet" />
        <link
          rel="icon"
          href={`data:image/svg+xml,${encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="%233C6E71"/><text x="16" y="22" text-anchor="middle" font-family="sans-serif" font-size="16" font-weight="900" fill="white">DL</text></svg>`
          )}`}
        />
      </Head>

      <main className="page">
        <header className="page-header">
          <div className="header-text">
            <div className="header-eyebrow">DEEPTACT LEARNING · APPS</div>
            <h1 className="header-title">딥택트러닝 앱 라이브러리</h1>
            <p className="header-sub">강의 현장에서 쓰는 도구 모음 · 박재현</p>
          </div>
          <div className="header-side">
            <div className="stat-block">
              <div className="stat-num">{stats.total}</div>
              <div className="stat-label">TOTAL</div>
            </div>
            <div className="stat-block">
              <div className="stat-num">{stats.live}</div>
              <div className="stat-label">LIVE</div>
            </div>
            <div className="stat-block">
              <div className="stat-num">{stats.wip}</div>
              <div className="stat-label">WIP</div>
            </div>
            <button
              type="button"
              className={`edit-mode-toggle ${editMode ? "active" : ""}`}
              onClick={() => setEditMode((v) => !v)}
              title={editMode ? "편집 모드 종료" : "편집 모드"}
              aria-label="편집 모드"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <ThemeToggle />
          </div>
        </header>

        {editMode && (
          <div className="edit-toolbar">
            <button type="button" className="toolbar-btn toolbar-btn-primary" onClick={openCreate}>
              + 새 앱
            </button>
            <button type="button" className="toolbar-btn" onClick={() => setCatManagerOpen(true)}>
              카테고리 관리
            </button>
            <button
              type="button"
              className="toolbar-btn"
              onClick={handleExport}
              disabled={!hasAnyEdits}
              title={hasAnyEdits ? "현재 상태를 apps.json 형식으로 다운로드" : "내보낼 변경사항이 없습니다"}
            >
              JSON 내보내기
            </button>
            <button
              type="button"
              className="toolbar-btn toolbar-btn-ghost"
              onClick={handleResetAll}
              disabled={!hasAnyEdits}
            >
              모든 편집 초기화
            </button>
            <span className="toolbar-hint">
              편집 내용은 이 브라우저에만 저장됩니다. git 에 반영하려면 'JSON 내보내기' 후 apps.json 을 커밋하세요.
            </span>
          </div>
        )}

        <div className="divider" />

        <div className="controls">
          <div className="search-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="앱 이름, 코드, 설명으로 검색..."
              aria-label="검색"
            />
          </div>
          <div className="filter-chips">
            {categories.map((c) => (
              <button
                key={c}
                className={`chip ${filter === c ? "active" : ""}`}
                onClick={() => setFilter(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {filtered.length > 0 ? (
          <div className="grid">
            {filtered.map((a) => (
              <AppCard
                key={a.repo || a.name}
                app={a}
                onTogglePin={togglePin}
                isEditing={editMode}
                isEdited={isEditedApp(a, editState.edits)}
                isCustom={isCustomApp(a)}
                onEdit={openEditFor}
                onDelete={deleteApp}
              />
            ))}
          </div>
        ) : (
          <div className="empty">조건에 맞는 앱이 없습니다</div>
        )}

        <EditDialog
          open={dialog.open}
          mode={dialog.mode}
          initialApp={dialog.app}
          categories={allCategories}
          onClose={closeDialog}
          onSubmit={saveDialog}
        />
        <CategoryManager
          open={catManagerOpen}
          categories={allCategories}
          appsByCategory={appsByCategory}
          onClose={() => setCatManagerOpen(false)}
          onAdd={addCategory}
          onRename={renameCategory}
          onDelete={deleteCategory}
        />

        <footer className="page-footer">
          <span>© 딥택트러닝 · 박재현</span>
          <span className="footer-sep">·</span>
          <a href="mailto:matt@deeptactlearning.com">matt@deeptactlearning.com</a>
        </footer>
      </main>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0;
          word-break: keep-all; overflow-wrap: break-word; line-break: strict; }

        :root, [data-theme="light"] {
          --bg: #F5F4F1;
          --surface: #ffffff;
          --surface-2: #FAFAF8;
          --border: rgba(0,0,0,0.08);
          --border-strong: rgba(0,0,0,0.14);
          --accent: #3C6E71;
          --accent-light: #2A6F73;
          --accent2: #284B63;
          --text: #1F2933;
          --text-dim: #3F4A5A;
          --muted: #6B7480;
          --card-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03);
          --chip-bg: rgba(0,0,0,0.04);
          --url-bg: #F5F4F1;
          --status-live-bg: #E6F0EE;
          --status-live-fg: #2A6F73;
          --status-wip-bg: #FBF1DC;
          --status-wip-fg: #8B6E1B;
        }
        [data-theme="dark"] {
          --bg: #080d12;
          --surface: #0e1419;
          --surface-2: #131a21;
          --border: rgba(255,255,255,0.07);
          --border-strong: rgba(255,255,255,0.14);
          --accent: #3C6E71;
          --accent-light: #5fb3b7;
          --accent2: #284B63;
          --text: #e8eaf0;
          --text-dim: #c0c4d0;
          --muted: #7a8494;
          --card-shadow: 0 1px 3px rgba(0,0,0,0.3);
          --chip-bg: rgba(255,255,255,0.05);
          --url-bg: rgba(255,255,255,0.04);
          --status-live-bg: rgba(60,110,113,0.2);
          --status-live-fg: #5fb3b7;
          --status-wip-bg: rgba(195,150,40,0.18);
          --status-wip-fg: #d6b25e;
        }

        html, body {
          background: var(--bg);
          color: var(--text);
          font-family: 'Paperlogy', 'Noto Sans KR', sans-serif;
          min-height: 100dvh;
          letter-spacing: -0.01em;
        }
        a { color: inherit; text-decoration: none; }

        .page {
          max-width: 1280px;
          margin: 0 auto;
          padding: 40px 32px 60px;
        }
        @media (max-width: 720px) {
          .page { padding: 28px 18px 60px; }
        }

        /* Header */
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 24px;
          flex-wrap: wrap;
        }
        .header-eyebrow {
          font-family: 'Plus Jakarta Sans', 'Paperlogy', sans-serif;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.18em;
          color: var(--muted);
          margin-bottom: 12px;
        }
        .header-title {
          font-size: clamp(28px, 4vw, 40px);
          font-weight: 900;
          color: var(--text);
          line-height: 1.15;
          margin-bottom: 8px;
        }
        .header-sub {
          font-size: 14px;
          color: var(--muted);
        }
        .header-side {
          display: flex;
          align-items: center;
          gap: 28px;
        }
        .stat-block {
          text-align: center;
        }
        .stat-num {
          font-size: clamp(28px, 4vw, 36px);
          font-weight: 900;
          color: var(--text);
          line-height: 1;
        }
        .stat-label {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.15em;
          color: var(--muted);
          margin-top: 4px;
        }

        .divider {
          height: 1px;
          background: var(--border);
          margin: 32px 0 24px;
        }

        /* Controls */
        .controls {
          display: flex;
          gap: 16px;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 28px;
        }
        .search-box {
          flex: 1 1 320px;
          min-width: 240px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 18px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 999px;
          color: var(--muted);
          box-shadow: var(--card-shadow);
        }
        .search-box input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: var(--text);
          font-family: inherit;
          font-size: 14px;
        }
        .search-box input::placeholder { color: var(--muted); }

        .filter-chips {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .chip {
          padding: 8px 16px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text-dim);
          font-family: inherit;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
        }
        .chip:hover { color: var(--text); }
        .chip.active {
          background: var(--accent);
          border-color: var(--accent);
          color: white;
        }

        /* Grid */
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 20px;
        }
        @media (max-width: 720px) {
          .grid { grid-template-columns: 1fr; }
        }

        /* App card */
        .app-card {
          position: relative;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 22px;
          box-shadow: var(--card-shadow);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .card-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .card-head-left { display: flex; align-items: center; gap: 10px; }
        .card-head-right { display: flex; align-items: center; gap: 8px; }
        .pin-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border: none;
          background: transparent;
          color: var(--muted);
          cursor: pointer;
          border-radius: 8px;
          transition: color 0.15s, background 0.15s;
        }
        .pin-btn:hover { color: var(--accent); background: var(--chip-bg); }
        .pin-btn.active { color: var(--accent); }
        .code-badge {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.05em;
          padding: 4px 8px;
          background: var(--chip-bg);
          color: var(--text-dim);
          border-radius: 6px;
        }
        .card-category {
          font-size: 12px;
          font-weight: 600;
          color: var(--muted);
        }
        .status-chip {
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 999px;
        }
        .status-live {
          background: var(--status-live-bg);
          color: var(--status-live-fg);
        }
        .status-wip {
          background: var(--status-wip-bg);
          color: var(--status-wip-fg);
        }
        .status-archived {
          background: var(--chip-bg);
          color: var(--muted);
        }

        .card-title {
          font-size: 20px;
          font-weight: 800;
          color: var(--text);
          line-height: 1.3;
          margin-top: 4px;
        }
        .card-meta {
          font-size: 12px;
          color: var(--muted);
        }
        .card-desc {
          font-size: 13px;
          color: var(--text-dim);
          line-height: 1.6;
        }
        .url-box {
          padding: 10px 14px;
          background: var(--url-bg);
          border: 1px solid var(--border);
          border-radius: 8px;
          font-family: 'SF Mono', Menlo, Monaco, monospace;
          font-size: 11px;
          color: var(--muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .card-actions {
          display: flex;
          gap: 8px;
          margin-top: auto;
          padding-top: 8px;
        }
        .btn-primary {
          flex: 1;
          padding: 12px 16px;
          background: var(--accent);
          color: white;
          font-family: inherit;
          font-size: 14px;
          font-weight: 700;
          text-align: center;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          transition: filter 0.15s, transform 0.1s;
        }
        .btn-primary:hover { filter: brightness(1.1); }
        .btn-primary:active { transform: scale(0.98); }
        .btn-primary.disabled,
        .btn-primary[aria-disabled="true"] {
          background: var(--chip-bg);
          color: var(--muted);
          cursor: not-allowed;
          pointer-events: none;
        }
        .icon-btn {
          width: 42px;
          height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text-dim);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .icon-btn:hover:not(:disabled) {
          color: var(--accent);
          border-color: var(--accent);
        }
        .icon-btn:disabled { opacity: 0.35; cursor: not-allowed; }

        /* QR popover */
        .qr-popover {
          position: absolute;
          inset: 0;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .qr-popover img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
        }
        .qr-close {
          position: absolute;
          top: 10px;
          right: 12px;
          background: transparent;
          border: none;
          color: var(--muted);
          font-size: 18px;
          cursor: pointer;
        }

        /* Empty / footer */
        .empty {
          text-align: center;
          padding: 80px 0;
          color: var(--muted);
          font-size: 14px;
        }
        .page-footer {
          margin-top: 60px;
          text-align: center;
          font-size: 12px;
          color: var(--muted);
        }
        .footer-sep { margin: 0 8px; }

        /* Theme toggle */
        .theme-toggle {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text-dim);
          cursor: pointer;
          transition: all 0.15s;
        }
        .theme-toggle:hover {
          color: var(--accent);
          border-color: var(--accent);
        }
        .theme-toggle .theme-dot {
          position: absolute;
          top: 6px;
          right: 6px;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent);
          opacity: 0.7;
        }

        input { font-size: 16px; }

        /* Edit mode */
        .edit-mode-toggle {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text-dim);
          cursor: pointer;
          transition: all 0.15s;
        }
        .edit-mode-toggle:hover {
          color: var(--accent);
          border-color: var(--accent);
        }
        .edit-mode-toggle.active {
          background: var(--accent);
          border-color: var(--accent);
          color: white;
        }
        .edit-toolbar {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
          padding: 14px 16px;
          margin-top: 20px;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 12px;
        }
        .toolbar-btn {
          padding: 8px 14px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text);
          font-family: inherit;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
        }
        .toolbar-btn:hover:not(:disabled) { background: var(--chip-bg); }
        .toolbar-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .toolbar-btn-primary {
          background: var(--accent); border-color: var(--accent); color: white;
        }
        .toolbar-btn-primary:hover:not(:disabled) { filter: brightness(1.1); background: var(--accent); }
        .toolbar-btn-ghost { color: var(--muted); }
        .toolbar-hint {
          flex: 1 1 auto;
          font-size: 12px;
          color: var(--muted);
          padding-left: 4px;
          min-width: 200px;
        }
        .edit-badge {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.05em;
          padding: 3px 8px;
          border-radius: 999px;
        }
        .edit-badge-new {
          background: rgba(60,110,113,0.18);
          color: var(--accent);
        }
        .edit-badge-edited {
          background: rgba(195,150,40,0.18);
          color: #b58a1a;
        }
        [data-theme="dark"] .edit-badge-edited { color: #d6b25e; }
        .icon-btn-danger:hover:not(:disabled) {
          color: #c0392b;
          border-color: #c0392b;
        }
      `}</style>
    </>
  );
}
