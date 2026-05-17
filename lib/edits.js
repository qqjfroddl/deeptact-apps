// 앱 카탈로그 편집 상태(localStorage) 헬퍼와 baseline 머지 로직
//
// 데이터 모델:
//   deeptact-apps-edits      : { [repo]: Partial<App> }   기존 앱 필드 오버라이드
//   deeptact-apps-custom     : App[]                       새로 추가한 앱
//   deeptact-apps-categories : string[]                    새로 추가한 카테고리
//   deeptact-apps-deleted    : string[]                    삭제 표시한 baseline repo
//   deeptact-apps-pins       : { [repo]: boolean }         (기존) 핀 오버라이드

export const KEYS = {
  edits: "deeptact-apps-edits",
  custom: "deeptact-apps-custom",
  categories: "deeptact-apps-categories",
  deleted: "deeptact-apps-deleted",
  pins: "deeptact-apps-pins",
};

const STATUS_VALUES = ["live", "wip", "archived"];

// 내보내기 시 유지할 필드와 순서 (apps.json 스키마와 동일)
const EXPORT_FIELDS = [
  "repo",
  "code",
  "name",
  "category",
  "status",
  "pinned",
  "url",
  "description",
];

function readJSON(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadEditState() {
  return {
    edits: readJSON(KEYS.edits, {}),
    custom: readJSON(KEYS.custom, []),
    categories: readJSON(KEYS.categories, []),
    deleted: readJSON(KEYS.deleted, []),
    pins: readJSON(KEYS.pins, {}),
  };
}

export function saveEdits(edits) { writeJSON(KEYS.edits, edits); }
export function saveCustom(custom) { writeJSON(KEYS.custom, custom); }
export function saveCategories(cats) { writeJSON(KEYS.categories, cats); }
export function saveDeleted(deleted) { writeJSON(KEYS.deleted, deleted); }
export function savePins(pins) { writeJSON(KEYS.pins, pins); }

export function clearAllEdits() {
  if (typeof window === "undefined") return;
  [KEYS.edits, KEYS.custom, KEYS.categories, KEYS.deleted].forEach((k) =>
    localStorage.removeItem(k)
  );
}

// custom 앱의 고유 id 생성
export function newCustomId() {
  const rand = Math.random().toString(36).slice(2, 8);
  return `__custom__-${Date.now().toString(36)}-${rand}`;
}

// baseline 앱 1개 + edits 오버라이드 + pins 오버라이드를 머지
function applyOverrides(app, edits, pins) {
  const edit = edits[app.repo] || {};
  const merged = { ...app, ...edit };
  // pinned 우선순위: edit.pinned (명시) > pins[repo] > baseline.pinned
  if (edit.pinned == null) {
    if (app.repo in pins) merged.pinned = pins[app.repo];
  }
  return merged;
}

// 최종 앱 목록 (baseline ⊕ overrides ⊕ deleted ⊕ custom)
export function mergeApps(baseline, state) {
  const { edits, custom, deleted, pins } = state;
  const deletedSet = new Set(deleted);
  const overridden = baseline
    .filter((a) => !deletedSet.has(a.repo))
    .map((a) => applyOverrides(a, edits, pins));
  // custom 앱에도 동일한 머지 적용 (사용자가 custom 앱을 다시 편집할 수 있게)
  const customMerged = custom.map((a) => applyOverrides(a, edits, pins));
  return [...overridden, ...customMerged];
}

// 카테고리 목록 = baseline ∪ custom ∪ 모든 앱에서 실제 사용중인 것
export function mergeCategories(apps, customCategories) {
  const set = new Set();
  apps.forEach((a) => a.category && set.add(a.category));
  customCategories.forEach((c) => c && set.add(c));
  return Array.from(set).sort((a, b) => a.localeCompare(b, "ko"));
}

// 앱이 baseline 인지 custom 인지 판별 (custom 은 repo 가 __custom__- prefix)
export function isCustomApp(app) {
  return typeof app?.repo === "string" && app.repo.startsWith("__custom__-");
}

// 앱이 사용자에 의해 수정된 상태인지 (배지 표시용)
export function isEditedApp(app, edits) {
  if (!app?.repo) return false;
  return Boolean(edits[app.repo] && Object.keys(edits[app.repo]).length > 0);
}

// 폼 입력값 정규화 (저장 전 사용)
export function normalizeAppInput(input) {
  const out = {};
  ["repo", "code", "name", "category", "url", "description"].forEach((k) => {
    if (typeof input[k] === "string") out[k] = input[k].trim();
  });
  if (STATUS_VALUES.includes(input.status)) out.status = input.status;
  if (typeof input.pinned === "boolean") out.pinned = input.pinned;
  return out;
}

// 머지된 앱 목록 → apps.json 형식 JSON 문자열로 직렬화
export function exportAsJson(mergedApps) {
  const cleaned = mergedApps.map((a) => {
    const out = {};
    EXPORT_FIELDS.forEach((f) => {
      if (a[f] !== undefined && a[f] !== "") out[f] = a[f];
    });
    // custom 앱의 임시 repo 는 그대로 노출하면 GitHub API enrich 에서 404
    // → repo 가 없으면 키 자체 제거 (baseline 으로 옮길 때 사용자가 수동으로 채움)
    if (isCustomApp(a)) delete out.repo;
    return out;
  });
  return JSON.stringify(cleaned, null, 2) + "\n";
}

// 브라우저에서 텍스트를 파일로 다운로드
export function downloadText(filename, text, mime = "application/json") {
  if (typeof window === "undefined") return;
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
