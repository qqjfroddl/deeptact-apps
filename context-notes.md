# 편집 모드 context notes

## 결정 사항
- **저장 방식**: 브라우저 localStorage + JSON 내보내기 (옵션 A).
  - 백엔드(KV/Supabase)나 GitHub API 직접 쓰기는 인프라 추가 부담이 있어 보류.
  - 핀 토글이 이미 같은 패턴(localStorage 오버라이드)을 쓰고 있어 일관성 ↑.
- **잠금**: 없음. URL 파라미터·비밀번호 등 인증 없이 진입.
  - 데이터가 브라우저에 있어 다른 방문자 환경에 영향 없음.

## 데이터 모델 (localStorage)
키 이름은 충돌 방지를 위해 prefix 통일.

- `deeptact-apps-pins` — (기존) `{ [repo]: boolean }` 핀 오버라이드. 그대로 유지.
- `deeptact-apps-edits` — (신규) `{ [repo]: Partial<App> }` 기존 앱 필드 오버라이드.
- `deeptact-apps-custom` — (신규) `App[]` 사용자가 새로 추가한 앱. baseline 과 동일한 스키마.
- `deeptact-apps-categories` — (신규) `string[]` 사용자가 추가한 카테고리.
- `deeptact-apps-deleted` — (신규) `string[]` 사용자가 삭제 표시한 baseline repo 목록.

## 머지 규칙
1. baseline apps (getStaticProps 에서 enrich 된 것) 에서 deletedRepos 에 있는 것 제외
2. 각 baseline 항목에 edits[repo] 를 spread 머지 (사용자 값이 baseline 보다 우선)
3. customApps 를 뒤에 append
4. 카테고리 목록: baseline 카테고리 ∪ customCategories ∪ 모든 앱에서 실제 사용중인 카테고리

## 식별자 (repo)
- baseline 앱은 GitHub repo 이름이 unique key.
- custom 앱은 repo 가 비어있을 수 있어 → `__custom__-{nanoid}` 같은 고유 id 부여.
- AppCard 의 onTogglePin / 편집 동작은 모두 이 id 로 라우팅.

## 핀 토글 vs 편집의 분리
- 핀 토글은 기존대로 별도 키(`deeptact-apps-pins`) 유지.
  - **Why**: 작동하는 코드를 건드리지 않는다 (Surgical Changes 원칙).
- 편집 모드의 `pinned` 변경은 `deeptact-apps-edits[repo].pinned` 에 쓴다.
  - 머지 우선순위: edits.pinned (있으면) > pins[repo] (있으면) > baseline.pinned.
  - 두 시스템이 한 화면에 공존해도 충돌하지 않음.

## UI 결정
- 편집 모드 토글: 헤더의 ThemeToggle 옆에 연필 아이콘 버튼.
- 편집 모드 ON 시:
  - 헤더 아래에 보조 툴바: [+ 새 앱] [카테고리 관리] [JSON 내보내기] [모든 편집 초기화]
  - 각 카드에 편집 / 삭제 아이콘 버튼 추가
  - 카드에 "수정됨" 또는 "신규" 배지 (시각적 피드백)
- 삭제는 즉시 적용하되 confirm() 사용. baseline 앱은 deletedRepos 에 추가, custom 앱은 customApps 에서 제거.

## 카테고리 삭제 안전장치
- 삭제하려는 카테고리를 사용중인 앱이 있으면 confirm 으로 경고.
- 강행 시 해당 앱들의 category 를 빈 문자열 또는 첫 번째 남은 카테고리로 이동.
- 결정: confirm 후 빈 문자열로 변경. AppCard 는 빈 값이면 "기타" 로 표시.

## JSON 내보내기 형식
- 머지된 최종 배열을 baseline apps.json 과 동일한 스키마로 직렬화.
- enrich 으로 채워진 `owner`, `repoUrl`, `updated_at` 등 GitHub API 파생 필드는 제외.
- 필드 순서: repo, code, name, category, status, pinned, url, description (현 apps.json 과 동일).
- 다운로드 파일명: `apps.json` (사용자가 그대로 git 에 덮어쓸 수 있게).
