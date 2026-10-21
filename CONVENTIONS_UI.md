# holdem_coin — UI Conventions

> 이 파일은 `npm run ai-ui` 실행 시 항상 자동으로 컨텍스트에 로드됩니다.
> UI 작업에만 적용되는 규칙을 간결하게 유지합니다.

## 1. 작업 범위 (HARD BOUNDARY)

**수정 허용** (`.aider.ui.conf.yml` whitelist):
- `src/ui/**` — 모든 UI 컴포넌트/페이지/훅
- `public/**` — 정적 에셋
- `styles/**` — 글로벌 CSS / SCSS
- `index.html` — 진입점 HTML
- `tailwind.config.{js,ts,cjs,mjs}` — Tailwind 설정
- `postcss.config.{js,ts,cjs,mjs}` — PostCSS 설정
- `vite.config.{js,ts}` — 빌드 설정 (UI 관련 항목만)
- `components.json` — shadcn/ui 설정
- `CONVENTIONS_UI.md` — 이 파일

**수정 금지** (`.aiderignore.ui`에 의해 hard-block 됨):
- `src/server/**`, `src/api/**`, `src/services/**`
- `src/lib/poker-live.ts`, `src/lib/poker-*.ts`
- `src/lib/game/**`, `src/lib/db/**`, `src/lib/auth/**`
- `src/lib/socket/**`, `src/lib/wallet/**`, `src/lib/solana/**`
- `src/lib/contract/**`, `src/lib/blockchain/**`, `src/lib/redis/**`
- `scripts/**`, `tests/**`, `prisma/**`, `drizzle/**`, `.env*`

> 백엔드/게임 코어 로직 변경이 필요해 보이면 **멈추고 사용자에게 확인**하세요.
> 이 파이프라인은 절대로 백엔드 시뮬레이션(20-hand 봇 검증 등)을 실행하지 않습니다.

## 2. UI 작업 원칙

1. **컴포넌트 우선**: 페이지 전체를 다시 그리지 말고, 최소 단위 컴포넌트로 패치.
2. **Tailwind 유틸리티 우선**: 인라인 `style={}` 대신 Tailwind 클래스 사용.
3. **타입 안전성**: `any` 금지. 모든 prop은 명시적 인터페이스로 정의.
4. **접근성**: 인터랙티브 엘리먼트에는 `aria-*` 속성 필수, 키보드 내비게이션 보장.
5. **애니메이션**: `framer-motion` 또는 CSS transition 사용. `requestAnimationFrame` 직접 호출 금지.

## 3. 커밋 메시지 규칙

`npm run ai-ui`가 자동으로 생성하는 커밋 메시지 형식:
```
ai-ui: UI updates @ 2025-10-21T05:30:00Z
```

수동으로 커밋할 때는 반드시 `ui-updates` 브랜치에서만 작업하세요.
`main` / `master` 브랜치에는 절대 직접 푸시하지 마세요.

## 4. 검증 로컬 실행

```bash
# UI 검증만 단독 실행 (aider 없이)
npm run validate:ui

# 전체 UI 파이프라인 (aider → 검증 → 커밋 → push to ui-updates)
npm run ai-ui

# 특정 UI 파일만 aider에 넘기기
npm run ai-ui -- src/ui/Table/HoldemTable.tsx

# 메시지 모드 (비인터랙티브)
npm run ai-ui -- --message "polish chip stack animation" src/ui/Chip/

# 푸시 없이 로컬만 커밋
AI_UI_NO_PUSH=1 npm run ai-ui
```
