// 카테고리 목록을 추가·이름변경·삭제하는 모달
import { useEffect, useMemo, useState } from "react";

export default function CategoryManager({
  open,
  categories, // 현재 표시되고 있는 모든 카테고리 (custom + 사용중)
  appsByCategory, // { [category]: count }
  onClose,
  onAdd, // (name) => void
  onRename, // (oldName, newName) => void
  onDelete, // (name, replaceWith) => void
}) {
  const [newCat, setNewCat] = useState("");
  const [renamingMap, setRenamingMap] = useState({}); // { [original]: editingValue }

  useEffect(() => {
    if (!open) return;
    setNewCat("");
    setRenamingMap({});
  }, [open]);

  const sorted = useMemo(
    () => [...categories].sort((a, b) => a.localeCompare(b, "ko")),
    [categories]
  );

  if (!open) return null;

  function handleAdd(e) {
    e.preventDefault();
    const v = newCat.trim();
    if (!v) return;
    if (categories.includes(v)) {
      alert("이미 존재하는 카테고리입니다.");
      return;
    }
    onAdd(v);
    setNewCat("");
  }

  function startRename(name) {
    setRenamingMap((m) => ({ ...m, [name]: name }));
  }

  function commitRename(original) {
    const next = (renamingMap[original] || "").trim();
    if (!next || next === original) {
      setRenamingMap((m) => {
        const { [original]: _, ...rest } = m;
        return rest;
      });
      return;
    }
    if (categories.includes(next)) {
      alert("이미 존재하는 카테고리입니다.");
      return;
    }
    onRename(original, next);
    setRenamingMap((m) => {
      const { [original]: _, ...rest } = m;
      return rest;
    });
  }

  function handleDelete(name) {
    const count = appsByCategory[name] || 0;
    const msg =
      count > 0
        ? `'${name}' 카테고리를 사용 중인 앱이 ${count}개 있습니다.\n삭제하면 해당 앱의 카테고리는 비워집니다. 계속할까요?`
        : `'${name}' 카테고리를 삭제할까요?`;
    if (!confirm(msg)) return;
    onDelete(name, "");
  }

  return (
    <div className="cat-backdrop" onClick={onClose}>
      <div className="cat-modal" onClick={(e) => e.stopPropagation()}>
        <header className="cat-head">
          <h3>카테고리 관리</h3>
          <button type="button" className="cat-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>

        <form className="cat-add" onSubmit={handleAdd}>
          <input
            type="text"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            placeholder="새 카테고리 이름"
          />
          <button type="submit" className="cat-btn cat-btn-primary">추가</button>
        </form>

        <ul className="cat-list">
          {sorted.length === 0 && (
            <li className="cat-empty">아직 카테고리가 없습니다.</li>
          )}
          {sorted.map((name) => {
            const editing = name in renamingMap;
            const count = appsByCategory[name] || 0;
            return (
              <li key={name} className="cat-item">
                {editing ? (
                  <input
                    type="text"
                    className="cat-rename-input"
                    value={renamingMap[name]}
                    onChange={(e) =>
                      setRenamingMap((m) => ({ ...m, [name]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitRename(name);
                      } else if (e.key === "Escape") {
                        setRenamingMap((m) => {
                          const { [name]: _, ...rest } = m;
                          return rest;
                        });
                      }
                    }}
                    autoFocus
                  />
                ) : (
                  <>
                    <span className="cat-name">{name}</span>
                    <span className="cat-count">{count}개</span>
                  </>
                )}
                <div className="cat-actions">
                  {editing ? (
                    <button
                      type="button"
                      className="cat-btn cat-btn-primary"
                      onClick={() => commitRename(name)}
                    >
                      저장
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="cat-btn"
                      onClick={() => startRename(name)}
                    >
                      이름변경
                    </button>
                  )}
                  <button
                    type="button"
                    className="cat-btn cat-btn-danger"
                    onClick={() => handleDelete(name)}
                  >
                    삭제
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <footer className="cat-footer">
          <button type="button" className="cat-btn" onClick={onClose}>닫기</button>
        </footer>
      </div>

      <style jsx>{`
        .cat-backdrop {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.45);
          display: flex; align-items: center; justify-content: center;
          z-index: 50; padding: 20px;
        }
        .cat-modal {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          width: 100%; max-width: 480px;
          max-height: 90vh; overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .cat-head {
          display: flex; justify-content: space-between; align-items: center;
          padding: 20px 24px; border-bottom: 1px solid var(--border);
        }
        .cat-head h3 { font-size: 18px; font-weight: 800; color: var(--text); margin: 0; }
        .cat-close {
          background: transparent; border: none; color: var(--muted);
          font-size: 20px; cursor: pointer; padding: 4px 8px; border-radius: 6px;
        }
        .cat-close:hover { background: var(--chip-bg); color: var(--text); }
        .cat-add {
          display: flex; gap: 8px;
          padding: 16px 24px; border-bottom: 1px solid var(--border);
        }
        .cat-add input {
          flex: 1;
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface-2);
          color: var(--text);
          font-family: inherit;
          font-size: 14px;
          outline: none;
        }
        .cat-add input:focus { border-color: var(--accent); }
        .cat-list { list-style: none; padding: 0; margin: 0; }
        .cat-empty {
          padding: 24px; text-align: center; color: var(--muted); font-size: 13px;
        }
        .cat-item {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 24px;
          border-bottom: 1px solid var(--border);
        }
        .cat-item:last-child { border-bottom: none; }
        .cat-name { flex: 1; font-weight: 600; color: var(--text); font-size: 14px; }
        .cat-count { font-size: 12px; color: var(--muted); }
        .cat-rename-input {
          flex: 1;
          padding: 6px 10px;
          border: 1px solid var(--accent);
          border-radius: 6px;
          background: var(--surface-2);
          color: var(--text);
          font-family: inherit;
          font-size: 14px;
          outline: none;
        }
        .cat-actions { display: flex; gap: 6px; }
        .cat-btn {
          padding: 6px 12px;
          border-radius: 6px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text);
          font-family: inherit;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .cat-btn:hover { background: var(--chip-bg); }
        .cat-btn-primary { background: var(--accent); border-color: var(--accent); color: white; }
        .cat-btn-primary:hover { filter: brightness(1.1); background: var(--accent); }
        .cat-btn-danger { color: #c0392b; }
        .cat-btn-danger:hover { background: rgba(192,57,43,0.08); }
        .cat-footer {
          display: flex; justify-content: flex-end;
          padding: 16px 24px; border-top: 1px solid var(--border);
        }
      `}</style>
    </div>
  );
}
