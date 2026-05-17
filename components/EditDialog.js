// 앱 1개의 필드(이름·URL·카테고리·코드·상태·핀·설명)를 편집하는 모달 다이얼로그
import { useEffect, useState } from "react";

const STATUS_OPTIONS = [
  { value: "live", label: "라이브" },
  { value: "wip", label: "작업중" },
  { value: "archived", label: "보관" },
];

const NEW_CATEGORY_SENTINEL = "__new__";

const empty = {
  repo: "",
  code: "",
  name: "",
  category: "",
  url: "",
  description: "",
  status: "live",
  pinned: false,
};

export default function EditDialog({
  open,
  mode, // "edit" | "create"
  initialApp, // 편집 시 채워넣을 기존 값
  categories,
  onClose,
  onSubmit, // (values) => void
}) {
  const [values, setValues] = useState(empty);
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [usingNewCategory, setUsingNewCategory] = useState(false);

  useEffect(() => {
    if (!open) return;
    const base = mode === "edit" && initialApp ? { ...empty, ...initialApp } : { ...empty };
    setValues(base);
    setUsingNewCategory(false);
    setNewCategoryInput("");
  }, [open, mode, initialApp]);

  if (!open) return null;

  function set(key, value) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleCategoryChange(value) {
    if (value === NEW_CATEGORY_SENTINEL) {
      setUsingNewCategory(true);
      set("category", "");
    } else {
      setUsingNewCategory(false);
      setNewCategoryInput("");
      set("category", value);
    }
  }

  function submit(e) {
    e.preventDefault();
    const finalCategory = usingNewCategory ? newCategoryInput.trim() : values.category;
    if (mode === "create" && !values.name.trim()) {
      alert("앱 이름을 입력해주세요.");
      return;
    }
    onSubmit({
      ...values,
      category: finalCategory,
    });
  }

  return (
    <div className="edit-backdrop" onClick={onClose}>
      <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
        <header className="edit-modal-head">
          <h3>{mode === "create" ? "새 앱 추가" : "앱 편집"}</h3>
          <button type="button" className="edit-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>

        <form className="edit-form" onSubmit={submit}>
          <label className="edit-field">
            <span className="edit-label">이름 *</span>
            <input
              type="text"
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
              required
              autoFocus
              placeholder="앱 표시 이름"
            />
          </label>

          <label className="edit-field">
            <span className="edit-label">URL</span>
            <input
              type="url"
              value={values.url}
              onChange={(e) => set("url", e.target.value)}
              placeholder="https://..."
            />
          </label>

          <div className="edit-row">
            <label className="edit-field">
              <span className="edit-label">카테고리</span>
              <select
                value={usingNewCategory ? NEW_CATEGORY_SENTINEL : values.category || ""}
                onChange={(e) => handleCategoryChange(e.target.value)}
              >
                <option value="">(없음)</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value={NEW_CATEGORY_SENTINEL}>+ 새 카테고리...</option>
              </select>
              {usingNewCategory && (
                <input
                  type="text"
                  className="edit-new-cat"
                  value={newCategoryInput}
                  onChange={(e) => setNewCategoryInput(e.target.value)}
                  placeholder="새 카테고리 이름"
                />
              )}
            </label>

            <label className="edit-field">
              <span className="edit-label">코드</span>
              <input
                type="text"
                value={values.code}
                onChange={(e) => set("code", e.target.value.toUpperCase())}
                placeholder="예: AILS"
                maxLength={8}
              />
            </label>
          </div>

          <div className="edit-row">
            <label className="edit-field">
              <span className="edit-label">상태</span>
              <select value={values.status} onChange={(e) => set("status", e.target.value)}>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>

            <label className="edit-field edit-checkbox-row">
              <span className="edit-label">핀 고정</span>
              <input
                type="checkbox"
                checked={!!values.pinned}
                onChange={(e) => set("pinned", e.target.checked)}
              />
            </label>
          </div>

          <label className="edit-field">
            <span className="edit-label">설명</span>
            <textarea
              value={values.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
              placeholder="한 줄 요약"
            />
          </label>

          <footer className="edit-actions">
            <button type="button" className="edit-btn" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="edit-btn edit-btn-primary">
              {mode === "create" ? "추가" : "저장"}
            </button>
          </footer>
        </form>
      </div>

      <style jsx>{`
        .edit-backdrop {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.45);
          display: flex; align-items: center; justify-content: center;
          z-index: 50; padding: 20px;
        }
        .edit-modal {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          width: 100%; max-width: 520px;
          max-height: 90vh; overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .edit-modal-head {
          display: flex; justify-content: space-between; align-items: center;
          padding: 20px 24px; border-bottom: 1px solid var(--border);
        }
        .edit-modal-head h3 {
          font-size: 18px; font-weight: 800; color: var(--text); margin: 0;
        }
        .edit-close {
          background: transparent; border: none; color: var(--muted);
          font-size: 20px; cursor: pointer; padding: 4px 8px; border-radius: 6px;
        }
        .edit-close:hover { background: var(--chip-bg); color: var(--text); }
        .edit-form { padding: 20px 24px 24px; display: flex; flex-direction: column; gap: 16px; }
        .edit-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .edit-field { display: flex; flex-direction: column; gap: 6px; }
        .edit-label {
          font-size: 12px; font-weight: 700; color: var(--muted);
          letter-spacing: 0.02em;
        }
        .edit-field input[type="text"],
        .edit-field input[type="url"],
        .edit-field select,
        .edit-field textarea {
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface-2);
          color: var(--text);
          font-family: inherit;
          font-size: 14px;
          outline: none;
        }
        .edit-field input:focus,
        .edit-field select:focus,
        .edit-field textarea:focus {
          border-color: var(--accent);
        }
        .edit-new-cat { margin-top: 6px; }
        .edit-field textarea { resize: vertical; min-height: 60px; }
        .edit-checkbox-row {
          flex-direction: row; align-items: center; justify-content: flex-start; gap: 10px;
          padding-top: 24px;
        }
        .edit-checkbox-row input { width: 18px; height: 18px; }
        .edit-actions {
          display: flex; gap: 8px; justify-content: flex-end;
          padding-top: 8px; border-top: 1px solid var(--border); margin-top: 8px;
          padding-top: 16px;
        }
        .edit-btn {
          padding: 10px 18px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text);
          font-family: inherit;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }
        .edit-btn:hover { background: var(--chip-bg); }
        .edit-btn-primary {
          background: var(--accent);
          border-color: var(--accent);
          color: white;
        }
        .edit-btn-primary:hover { filter: brightness(1.1); background: var(--accent); }
        @media (max-width: 520px) {
          .edit-row { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
