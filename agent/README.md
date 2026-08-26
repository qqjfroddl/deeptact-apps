# Morning Sender V4 Windows Agent

웹 대시보드가 만든 발송 작업을 Windows PC에서 받아 실제 PC 카카오톡과 네이버 SMTP로 처리합니다.

## 1. 설치

```bash
python -m pip install -r requirements.txt
```

## 2. 설정 파일 만들기

`agent_config.example.json`을 복사해서 `agent_config.json`으로 이름을 바꿉니다.

필수 항목:

- `server_url`: 기본 `https://deeptact-apps.vercel.app`
- `agent_key`: Vercel의 `MORNING_AGENT_KEY`와 정확히 동일한 값
- `naver_email`: 발신 네이버 메일 주소
- `naver_app_password`: 네이버 2단계 인증에서 발급한 애플리케이션 비밀번호

> `agent_config.json`은 비밀번호가 들어 있으므로 GitHub에 커밋하지 마세요.

## 3. 실행

```bash
python morning_sender_agent.py
```

Agent가 약 8초 간격으로 웹의 pending 작업을 확인합니다. 작업이 있으면 하나를 claim한 뒤 카카오톡 → 네이버 메일 순으로 처리하고 결과를 다시 웹에 기록합니다.

## 카카오톡 안정성

V4는 다음 순서로 동작합니다.

1. Windows UI Automation (`pywinauto`)으로 카카오톡 창과 검색 입력 컨트롤 탐색
2. UIA가 충분히 노출되지 않는 카카오톡 버전에서는 `fallback_positions` 좌표 방식 사용

카카오톡은 공식 자동화 API를 제공하지 않으므로 UI 변경에 따라 fallback 캘리브레이션이 필요할 수 있습니다. 실제 전체 발송 전 테스트 계정 1명으로 검증하세요.

## 발송 속도 기본값

- 개인 간격: 2.5~5초 랜덤
- 그룹 간 휴식: 30~60초 랜덤
- 카톡 그룹: 1~8

## 네이버 메일

- SMTP: `smtp.naver.com`
- SSL: 465
- 애플리케이션 비밀번호 사용 권장/필수 설정 확인
- 각 수신자에게 개별 메일로 발송하여 다른 수신자의 주소를 노출하지 않음
