# 선택적 형식 검증 연결

정책의 기준 문서는 루트 `AGENTS.md`이다. 일반 테스트가 기본이며 이 연결은 게임 실행, Render 시작, 빌드 또는 CI에서 형식 검증을 자동 실행하지 않는다.

외부 도구: https://github.com/michael-denyer/agent-formal-verify
검토한 버전: `scripts/formal-verify-source.json`. 개발용 소스는 `.tools/`에 별도 체크아웃한다. 외부 GPL-3.0-only 소스는 게임 코드에 복사하거나 번들링하지 않는다. 버전 변경은 명시적으로 검토한 뒤 pin을 갱신한다.

## 준비

```sh
npm run formal:setup
npm run formal:doctor -- --tool tla
npm run formal:doctor -- --tool lean
```

doctor는 준비 상태만 검사한다. UNAVAILABLE/종료 코드 3은 미검증이다. READY도 프로그램의 검증 통과가 아니다. Java/Python/TLC/Lean 등은 개발 머신의 별도 도구이며 npm 설치나 서버 시작 시 내려받지 않는다.

필요한 도구가 없으면 외부 스킬 `skills/formal-verify/references/setup.md`의 pin·설치 방법을 따른다. Lean은 저장소에 실제 모델이 있을 때 그 프로젝트의 `lean-toolchain`으로 upstream `setup.sh lean <absolute-project>`와 `lean-check.sh`를 사용한다. Rust가 아닌 현재 게임 코드에는 Kani를 기본 설치·실행하지 않는다.

## 실행 판단과 결과

기존 모델이 보호하는 규칙을 변경하면 관련 검사만 재실행한다. 새 모델은 실제 고위험 대상이 선택된 경우에만 만든다. 순서/경합은 TLA+/TLC, 수학 불변 조건은 Lean 4가 우선이다.

검사를 실행한 경우 이 문서에 대상별 한 행을 유지한다: 모델 경로, 실제 코드·상태·사건 대응, 검증 규칙의 근거, 가정/경계, 재실행 명령, 결과, 의도적 오류 검출, 코드 재현 여부, 남은 위험. 실패/시간초과/미완성 증명/코드 대응 미확인은 성공으로 적지 않는다. 반례는 기존 테스트에서 재현하고 사용자에게 수정 권한이 있는 경우에만 코드를 바꾼다.

현재 프로젝트 모델: 없음. 이번 변경은 개발 도구·정책 연결이므로 게임 로직의 형식 검증은 생략한다. 기존 위험을 해결하거나 전체 프로그램을 증명했다는 의미가 아니다. 예제 도구 smoke test는 프로젝트 검증 결과에 포함하지 않는다.

초기 연결 확인(2026-10-28): TLC v1.7.4 SHA256 pin 확인, 예제 matrix 3/3 및 reach 1/1, 예제 의도적 오류 4/4 검출. Java 17 사용. Lean/elan 미설치, Kani는 현재 비-Rust 프로젝트에 불필요하여 준비하지 않음. 이 결과는 게임 코드의 증명이 아니다.
