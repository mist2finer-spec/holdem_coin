---
Task ID: ui-pipeline-setup
Agent: main (GLM)
Task: holdem_coin 프로젝트에 서버/게임 로직 컨텍스트를 배제하고 UI/UX 수정에만 특화된 토큰 절약형 UI 전담 파이프라인 세팅 (3단계: 컨텍스트 격리 / 무토큰 검증 / 워커+npm 단축키)

Work Log:
- 워크스페이스 `/home/z/my-project/`에 실제 holdem_coin 소스가 없음을 확인 → 설정 파일/스크립트만 생성하고 사용자가 복사해서 사용하도록 결정
- Step 1: `.aider.ui.conf.yml` 생성 (UI-only 모델 설정, auto-commits=false, map-tokens=1024, .aiderignore.ui 파일로 하드 바운더리 강제)
- Step 1: `.aiderignore.ui` 생성 (gitignore 문법으로 src/server, src/lib/poker-* / game / db / auth / socket / wallet / solana / contract / scripts / tests / prisma / drizzle / .env* 모두 hard ignore)
- Step 1: `CONVENTIONS_UI.md` 작성 — UI 작업 범위/원칙/커밋 규칙/실행 예시
- Step 2: `scripts/validate_ui.mjs` (ESM) 작성 — 1) npm run build:ui || npm run build 빌드 검증, 2) CSS/Tailwind 검사 (지시어/중복 셀렉터/config content scope/orphan @apply). 실패 시 마지막 15줄만 출력 후 exit(1). 백엔드 시뮬레이션 절대 실행 안 함
- Step 3: `scripts/ai_ui_pipeline.sh` 워커 작성 — main/master 강제 거부 → ui-updates 체크아웃 → aider UI-only 프로파일 호출 → validate_ui → UI 경로만 git add → 커밋 → push to origin/ui-updates. 환경변수 AI_UI_BRANCH / AI_UI_REMOTE / AI_UI_AIDER / AI_UI_NO_PUSH 지원
- Step 3: `package.json`에 `"ai-ui"`, `"validate:ui"`, `"build:ui"` 스크립트 추가 (기존 package.json이 있을 경우 scripts 섹션만 병리하라는 안내 포함)
- `.gitignore`에 UI 파이프라인 산출물 옵션 주석 추가
- 검증: node --check, bash -n, package.json JSON parse, ai-ui 스크립트 resolve 확인, aider 없을 때 graceful fail, validate_ui 실패 시 15줄 출력 동작 확인

Stage Summary:
- 산출물 6개 파일: .aider.ui.conf.yml, .aiderignore.ui, CONVENTIONS_UI.md, scripts/validate_ui.mjs, scripts/ai_ui_pipeline.sh, package.json
- 하드 바운더리 2중 강제: .aiderignore.ui (gitignore 패턴) + scripts/ai_ui_pipeline.sh의 git add 시 UI_PATHS whitelist
- 브랜치 보호: main/master에서 실행 시 자동으로 ui-updates로 전환, push 전 재확인
- 토큰 절약: map-tokens=1024, implicit-auto-context=false, auto-add=false, weak-model=codex
- 검증 무토큰: validate_ui.mjs는 빌드 + CSS/Tailwind 정적 검사만 수행, 백엔드 시뮬 절대 금지
- 사용자 액션 필요: 이 파일들을 실제 holdem_coin 프로젝트 루트로 복사하고 package.json의 build:ui를 실제 빌드 명령(vite build 등)으로 override
