import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const file = resolve("public/html-editor/index.html");
const ogImageFile = resolve("public/html-editor/html-editor-og.png");
const html = readFileSync(file, "utf8");

const checks = [];
const check = (name, condition) => checks.push({ name, ok: Boolean(condition) });
const includes = text => html.includes(text);

check("딥택트러닝 제목", includes("강의 HTML 편집기 | 딥택트러닝"));
check("공유 메타 제목·설명", includes('property="og:title"') && includes('property="og:description"'));
check("공유 메타 절대 URL", includes('property="og:image" content="https://deeptact-apps.vercel.app/html-editor/html-editor-og.png?v=20260831"'));
check("카카오·노션 이미지 크기", includes('property="og:image:width" content="1200"') && includes('property="og:image:height" content="630"'));
check("Twitter 대형 카드", includes('name="twitter:card" content="summary_large_image"'));
check("공유 이미지 파일", existsSync(ogImageFile));
if (existsSync(ogImageFile)) {
  const ogImage = readFileSync(ogImageFile);
  const isPng = ogImage.subarray(1, 4).toString("ascii") === "PNG";
  const width = isPng ? ogImage.readUInt32BE(16) : 0;
  const height = isPng ? ogImage.readUInt32BE(20) : 0;
  check("공유 이미지 1200×630 PNG", isPng && width === 1200 && height === 630);
}
check("Paperlogy 정본 CSS", includes("https://deeptactlearning-fonts.netlify.app/fonts.css"));
check("딥택트 색상", includes("--primary: #2E3142") && includes("--accent: #3C6D71") && includes("--surface: #F2F1EF"));
check("한국어 줄바꿈", includes("word-break: keep-all"));
check("모바일 규칙", includes("@media (max-width: 620px)"));
check("파일 열기", includes("showOpenFilePicker") && includes("fileInput"));
check("새 파일 저장", includes("downloadFile") && includes(".edited.html"));
check("원본 저장", includes("createWritable") && includes("overwriteFile"));
check("글자 크기", includes("fontSmallerButton") && includes("fontLargerButton") && includes("setFontSize"));
check("글꼴 5종", ["original", "paperlogy", "sans", "serif", "mono"].every(value => includes(`value="${value}"`)));
check("글꼴 원복", includes("removeProperty(\"font-family\")"));
check("실행취소·다시실행", includes("function undo()") && includes("function redo()") && includes("state.undo"));
check("이미지 편집", includes("insertLocalImage") && includes("setImageWidth") && includes("toggleImageCenter"));
check("슬라이드 편집", includes("detectSlides") && includes("moveSlideTo") && includes("deleteSlide"));
check("앱 안 사용방법", includes("처음 사용하는 분을 위한 안내") && includes("1분 빠른 시작"));
check("연습용 문서", includes("연습용 문서 열기") && includes("loadSample"));
check("추가 메뉴가 도구막대 밖에서도 표시", includes("position: fixed") && includes("function positionMenu") && includes("repositionOpenMenu"));
check("원본 스크립트 실행 미리보기", /<iframe[^>]+sandbox="allow-scripts allow-same-origin"[^>]+credentialless/.test(html));
check("실행 DOM과 저장 원본 분리", includes("state.sourceDoc") && includes("sourceNode") && includes("serializeDocument"));
check("편집 흔적 제거", includes("stripEditorArtifacts") && includes("data-dt-editor-"));
check("구 소유자 문구 없음", !/실꾸답|Silkkudap/i.test(html));
check("구 라이브러리 미사용", !/Sortable(?:JS)?/i.test(html));

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
check("중복 ID 없음", duplicateIds.length === 0);

const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
check("인라인 앱 스크립트 1개", scripts.length === 1);
if (scripts.length === 1) {
  try {
    new Function(scripts[0]);
    check("JavaScript 문법", true);
  } catch (error) {
    check(`JavaScript 문법: ${error.message}`, false);
  }
}

const failed = checks.filter(item => !item.ok);
for (const item of checks) console.log(`${item.ok ? "PASS" : "FAIL"} | ${item.name}`);
if (duplicateIds.length) console.log(`중복 ID: ${duplicateIds.join(", ")}`);

if (failed.length) {
  console.error(`\n${failed.length}개 검사가 실패했습니다.`);
  process.exit(1);
}

console.log(`\nHTML 편집기 정적 검사 ${checks.length}개 통과`);
