# 편집 모드 체크리스트

## 목표
사용자가 Claude 없이 대시보드의 앱 정보(제목·URL·카테고리·설명·코드·상태·핀)와
카테고리 목록을 직접 추가·수정·삭제할 수 있게 한다.

## 저장 방식
- baseline: `lib/apps.json` (git 관리, Vercel 빌드 시 사용)
- overlay: localStorage 의 overrides + customApps + customCategories + deletedRepos
- 내보내기: 머지된 결과를 `apps.json` 형식으로 다운로드 → 사용자가 git 커밋

## 작업
- [x] checklist.md, context-notes.md 작성
- [x] `lib/edits.js` — localStorage 헬퍼 + 머지 함수
- [x] `components/EditDialog.js` — 앱 편집/추가 모달
- [x] `components/CategoryManager.js` — 카테고리 관리 모달
- [x] `components/AppCard.js` — 편집 모드 버튼 노출 (편집·삭제 아이콘)
- [x] `pages/index.js` — 편집 모드 상태, 툴바, 내보내기, 머지된 데이터 사용
- [~] `npm run build` — 샌드박스 timeout 으로 완주 못함. 직전 trace 에서 SWC 트랜스폼·웹팩 컴파일 모두 성공. 사용자 로컬에서 `npm run dev` 로 최종 확인 필요.
- [ ] dev 서버 시나리오 검증 — 사용자 로컬에서 확인:
  - [ ] 편집 모드 ON → 카드 편집 → 변경 즉시 반영
  - [ ] 새 앱 추가
  - [ ] 새 카테고리 추가, 카드에 적용
  - [ ] JSON 내보내기 → 파일 다운로드 확인
  - [ ] 새로고침 후에도 상태 유지
  - [ ] "모든 편집 초기화" 동작
- [x] 의미단위 commit
