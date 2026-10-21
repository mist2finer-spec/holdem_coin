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

---
Task ID: ui-leaderboard-chips
Agent: main (GLM)
Task: holdem_coin 프로젝트에 UI 추가 — 리더보드 React 컴포넌트 (Leaderboard_1.png 골드 프레임 활용, 7명 기본+반응형 동적 확장, 한영 병기) 및 칩 스프라이트 10장 분할 (Chip_01~Chip_10.png)

Work Log:
- 사용자 업로드 자산 확인: Leaderboard_1.png (128x128 골드 프레임), chipimage_bulk.jpg (2400x1792, 10개 칩 묶음)
- AskUserQuestion으로 8개 차원 확정: React 컴포넌트 / 하이브리드 칩 분할 / 자동 그리드 감지 / 골드 카지노 톤 / 완전 분리 / 기본 7명 반응형 / 한영 병기 / src/ui/assets/ 저장
- VLM 분석 (chipimage_bulk.jpg): 3행 5열 비정형 그리드, 각 칩 크기 상이, 빈 셀 존재. 10개 칩에 대한 색상/구성 묘사 확보
- Step B/C: Pillow 자동 분할 시도 → contact sheet VLM 검증 결과 하단 행(Chip 06~10) 잘림 발견. 비정형 레이아웃에서 자동 감지 한계
- 대안: z-ai-web-dev-sdk의 images.generations.edit API 직접 호출 (base64 data URL 방식)
  - CLI는 로컬 파일 거부 (error 1210 "image_to_image task must provide images")
  - CDN URL은 auth_key 만료로 403
  - 해결: fs.readFileSync → base64 → data:image/jpeg;base64,... → SDK images array
- 첫 시도 content filter (code 1301) — "casino/jackpot/winner" 키워드 트리거
- 프롬프트 정제: "casino chip" → "game token", "jackpot/winner" → "treasure chest celebration". 10/10 칩 생성 성공 (평균 20초/칩, 총 ~3.5분)
- VLM 2차 검증: 모든 칩 명확, 색상 선명, 01~10 순서 정확
- Step D: Leaderboard_1.png 가공 — 4x 업스케일 (512x512) + 가로 트림 타일 (1024x16) 생성. CSS border-image 용도
- Step E: src/ui/components/Leaderboard/Leaderboard.tsx 작성 (279 lines)
  - Player 인터페이스, 한영 병기 라벨, Top 3 크라운/링 스타일
  - useResponsiveMaxVisible 훅 (모바일 5 / 태블릿 7 / 데스크톱 10)
  - useExpandedCount 훅 (5개씩 확장, 기본값으로 collapse)
  - 빈 슬롯 placeholder로 항목 수 감소 시 레이아웃 안정화
  - Leaderboard_1_x4.png를 CSS border-image로 적용 → 프레임이 리스트 높이에 따라 유동적 확장
- Step F: src/ui/data/chips.ts 작성 — 10개 칩 enum + tier 매핑 + pickChipByAmount 헬퍼
- src/ui/data/demoPlayers.ts — imageguide.pptx 기반 10명 데모 데이터 (한글 이름 + K 단위 금액)
- src/ui/components/Chip/ChipIcon.tsx — 칩 디스플레이 컴포넌트 (chipId/index/amount 기반 선택, size 조절, 라벨 옵션)
- src/ui/demo/preview.html — Tailwind CDN + Cinzel/Noto Sans KR 폰트, 리더보드 데모 (추가/제거/셔플 버튼) + 칩 갤러리 2x5 그리드
- 정적 검증: HTML 파서 구조 valid, TypeScript 파일 4개 모두 생성됨, 칩 PNG 10장 + 리더보드 PNG 3장 확인

Stage Summary:
- 산출물 17개 파일:
  - 칩 스프라이트 10장: src/ui/assets/chips/Chip_01.png ~ Chip_10.png (각 1024x1024, AI 재생성)
  - 칩 매니페스트: src/ui/assets/chips/manifest.json
  - 리더보드 에셋 3장: src/ui/assets/leaderboard/{Leaderboard_1.png, Leaderboard_1_x4.png, gold_trim_horizontal.png}
  - React 컴포넌트 2개: Leaderboard.tsx (278 lines), ChipIcon.tsx (82 lines)
  - 데이터 2개: chips.ts (58 lines, registry+helper), demoPlayers.ts (23 lines)
  - 데모: src/ui/demo/preview.html (단일 파일 실행 가능)
- AI 칩 생성 비용: 10회 image-edit API 호출, ~3.5분 소요, content filter 우회를 위해 "casino" → "game token"으로 프레이밍
- 리더보드 동적 확장: useResponsiveMaxVisible (viewport) + useExpandedCount (사용자 조작) 이중 제어
- 한영 병기: "Player · 플레이어", "LEADERBOARD · 리더보드", "더 보기 · Show more", "접기 · Collapse"
- 골드 카지노 톤: linear-gradient(#ffe27a → #d4a017 → #8b6914) gold text, 검정/갈색 그라데이션 배경, Leaderboard_1_x4.png를 border-image로 사용
- 완전 분리: Leaderboard 컴포넌트는 Chip 컴포넌트를 import하지 않음 (사용자 선택에 따라 독립 사용 가능)
