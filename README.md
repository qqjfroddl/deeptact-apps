# 딥택트러닝 앱 라이브러리

> 딥택트러닝에서 만드는 강의·교육 도구들을 한 페이지에 모아 보여주는 카탈로그
> Next.js + Vercel + GitHub API (선택)

---

## 📐 시스템 개요

- 화이트리스트 방식: `lib/apps.json` 에 등록한 repo만 카드로 노출된다
- 등록한 repo의 한 줄 설명·배포 URL·마지막 업데이트 시각은 **GitHub API로 자동 enrich** 된다
- 카드는 카테고리 칩으로 필터, 이름·설명·코드로 검색 가능
- 라이트/다크 모드 토글 (시스템 자동 + localStorage 저장)

---

## 🚀 첫 배포 가이드

### STEP 1 — GitHub repo 만들기

```bash
cd deeptact-apps
git init
git add .
git commit -m "init: deeptact apps catalog"
git remote add origin https://github.com/[username]/deeptact-apps.git
git push -u origin main
```

### STEP 2 — Vercel 연결

1. [Vercel](https://vercel.com) → **Add New Project** → GitHub repo 연결
2. Framework은 자동으로 **Next.js** 잡힘
3. (선택) Environment Variables 입력하면 GitHub 자동 enrich 활성화

| Name | Value | 필수 |
|------|-------|------|
| `GITHUB_OWNER` | GitHub 사용자명 또는 조직명 | 선택 |
| `GITHUB_TOKEN` | Personal Access Token (`public_repo` 권한) | 선택 |

> 둘 다 비워두면 `apps.json` 의 정적 데이터만 표시된다. 즉 `url`·`description` 을 직접 채워야 카드가 의미를 갖는다.
> `GITHUB_OWNER` 만 있으면 비인증 API 호출 (시간당 60회 제한). 토큰까지 있으면 시간당 5000회.

4. **Deploy** 클릭

---

## 📁 새 앱 추가하기

`lib/apps.json` 에 새 항목 추가하고 push 만 하면 끝. 1시간 ISR 캐시로 재생성된다.

```json
{
  "repo": "my-new-app",
  "code": "MNA",
  "name": "내 새 앱",
  "category": "강의 도구",
  "status": "live",
  "pinned": false
}
```

### 필드 설명

| 필드 | 필수 | 설명 |
|------|------|------|
| `repo` | 추천 | GitHub repo 이름. GitHub API enrich의 키 |
| `code` | 추천 | 카드 좌상단 작은 배지 (3–5글자). 예: AILS, MNA |
| `name` | 필수 | 카드에 크게 표시되는 이름 |
| `category` | 필수 | 필터 칩에 쓰임. 자유 텍스트 (예: 강의 도구, 진단, 워크숍) |
| `status` | 필수 | `live` 또는 `wip` 또는 `archived` |
| `pinned` | 선택 | `true` 면 항상 상단 |
| `url` | 선택 | 배포 URL. 비워두면 GitHub `homepage` 필드 자동 사용 |
| `description` | 선택 | 한 줄 설명. 비워두면 GitHub repo description 자동 사용 |
| `version` | 선택 | 카드 메타에 "v1 · 날짜" 형태로 표시 |

### GitHub API 가 자동으로 채워주는 것

- `description` (repo description)
- `url` (repo homepage 필드)
- `updated_at` (마지막 push 시각)
- `repoUrl` (GitHub repo 링크)

---

## ✏️ HTML 편집기 V2

- 운영 주소: `https://deeptact-apps.vercel.app/html-editor`
- 정본: `public/html-editor/index.html`
- 구조: 별도 서버·DB 없이 브라우저에서만 동작하는 단일 HTML
- 권장 환경: 최신 Chrome 또는 Edge 데스크톱

### 주요 기능

- HTML 파일 열기·끌어놓기
- 텍스트 직접 편집, 10~96px 크기 조절
- 글꼴 5종: 원본·Paperlogy·고딕·명조·코드
- 요소 이동·복제·삭제·삽입
- 로컬 이미지 삽입·크기·가운데 정렬
- 슬라이드 감지·이동·재정렬·삭제
- 실행취소·다시실행 최대 60단계
- 새 파일 다운로드와 지원 브라우저의 원본 덮어쓰기
- 앱 안 1분 빠른 시작과 상세 사용방법

### 기술 결정

- **독립 V2**: 출처 불명·라이선스 불명의 기존 코드를 재사용하지 않고 새로 구현했다.
- **단일 HTML 유지**: 고객사 보안 환경과 오프라인 강의에서도 파일 하나로 쓸 수 있게 한다.
- **원본과 같은 실행 미리보기**: Tailwind CDN·Chart.js처럼 JavaScript가 화면을 만드는 문서도 원본과 같게 보이도록 미리보기에서 스크립트를 실행한다. 따라서 본인이 만들었거나 신뢰하는 HTML만 연다.
- **실행 화면과 저장 원본 분리**: 스크립트가 실행되며 생성한 스타일·차트 DOM은 미리보기에만 둔다. 텍스트·글꼴·크기 등 사용자가 바꾼 내용만 별도 원본 문서에 동기화해 저장하므로 실행 흔적이 결과 파일에 섞이지 않는다.
- **맥락형 도구**: 텍스트를 선택했을 때만 글자 도구, 이미지를 선택했을 때만 이미지 도구를 표시해 초보자 화면을 단순하게 유지한다.
- **Paperlogy 온라인 로드**: 앱 UI와 편집 대상의 Paperlogy 선택은 정본 폰트 CSS를 사용한다. 인터넷이 없으면 편집 대상은 시스템 대체 글꼴로 표시될 수 있다.

### 검증

```bash
npm run verify:html-editor
npm run build
```

배포 전에는 연습용 문서를 열어 텍스트 크기·글꼴·실행취소·슬라이드 순서·새 파일 저장을 실제 브라우저에서 확인한다.

---

## 🎨 디자인 메모

- 색상: 라이트 베이스 `#F5F4F1`, 카드 흰색, accent `#3C6E71` (딥택트러닝 틸)
- 폰트: Paperlogy (본문), Plus Jakarta Sans (영문 라벨)
- 카드 그리드: 데스크탑 3열, 태블릿 2열, 모바일 1열

---

## 📝 라이선스 / 만든 사람

딥택트러닝 (Deeptact Learning) · 박재현 소장
matt@deeptactlearning.com
