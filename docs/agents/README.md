# 역할별 작업 시작

GitHub에 연결한 뒤 이렇게 요청한다:

> `gameplay-dev`를 읽고 작업준비. 전투 카메라 수정에 필요한 부분만 확인해.

[AGENTS](../../AGENTS.md) → [CURRENT](CURRENT.md) → [gameplay-dev](../../.agents/roles/gameplay-dev.md) 순으로 시작한다. 준비 단계에서는 전체 구조·모든 인계·전체 코드를 읽지 않는다.

## 13개 역할

| 계층 | 역할 | 담당 |
| --- | --- | --- |
| Tier 1 | [director](../../.agents/roles/director.md) | 게임·프로덕션 총괄 |
| Tier 1 | [tech-director](../../.agents/roles/tech-director.md) | 기술·아키텍처 총괄 |
| Tier 2 | [design-lead](../../.agents/roles/design-lead.md) | 기획·밸런스 |
| Tier 2 | [art-lead](../../.agents/roles/art-lead.md) | 아트·사운드·VFX |
| Tier 2 | [qa-release-lead](../../.agents/roles/qa-release-lead.md) | 품질·빌드·운영 |
| Tier 3 | [gameplay-dev](../../.agents/roles/gameplay-dev.md) | 전투·캐릭터·카메라 |
| Tier 3 | [network-server-dev](../../.agents/roles/network-server-dev.md) | 소켓·DB·보안 |
| Tier 3 | [ui-ux-dev](../../.agents/roles/ui-ux-dev.md) | HUD·테이블 UI·조작 |
| Tier 3 | [systems-level-designer](../../.agents/roles/systems-level-designer.md) | 스킬·스테이지·재화/경제 |
| Tier 3 | [technical-artist](../../.agents/roles/technical-artist.md) | 셰이더·이펙트·3D-to-2D |
| Tier 3 | [tools-perf-engineer](../../.agents/roles/tools-perf-engineer.md) | 에디터 툴·최적화·빌드 자동화 |
| Tier 3 | [qa-tester](../../.agents/roles/qa-tester.md) | 회귀 테스트·실기 검증 |
| 횡단 역할 | [reverse_eng_designer](../../.agents/roles/reverse_eng_designer.md) | 분석 설계·분배 |

- Tier 1: director가 게임 범위·우선순위, tech-director가 기술 계약·의존성을 조율한다.
- Tier 2: 디자인/아트/검증 리드가 해당 분야의 결과 기준을 관리한다.
- Tier 3: 요청된 specialist가 담당 파일부터 직접 작업한다.
- reverse_eng_designer: 세 계층을 가로질러 Craft Anything 분석 질문과 근거를 설계·분배한다. 상시 실행되는 네 번째 리드가 아니다.
- 원래 요청이 단일 분야이면 specialist 하나로 시작한다. 역할 지정은 프로세스 자동 생성이나 다른 플랫폼의 agent 등록을 뜻하지 않는다.

## 로컬 명령

```sh
node scripts/agents/context.mjs --list
node scripts/agents/context.mjs gameplay-dev
node scripts/agents/context.mjs technical-artist --unity
node scripts/agents/context.mjs reverse_eng_designer
node scripts/agents/context.mjs --check
```

기본 출력은 공통 규칙·현재 요약·선택 카드뿐이다. `--unity`는 Unity 조사에 필요한 짧은 규칙을 추가한다. 소스·로그·모든 역할은 출력하지 않는다. GitHub 도구만 쓰는 경우 같은 문서 3개를 직접 읽는다.

## 요청 예시

- “holdem_coin 연결, `network-server-dev` 읽고 소켓 재접속 문제 작업준비.”
- “`technical-artist`로 길티기어풍 셰이더 준비. 기존 도트 설정과 연결점만 확인.”
- “`reverse_eng_designer`로 Craft Anything 관찰을 gameplay-dev와 technical-artist에 나눌 근거 패킷 준비.”
- “`qa-tester`로 이번 diff에 필요한 회귀만 정하고 미실행 항목 표시.”

## 갱신 위치

경로가 바뀌면 담당 카드, 게임 기준이 바뀌면 [CURRENT](CURRENT.md), 공통 보호 규칙은 AGENTS만 갱신한다. 작업 전후의 긴 기록은 기존 분야 문서/로컬 증거에 보관한다. 전달 서식은 [HANDOFF](HANDOFF.md), 조건부 규칙은 [WORK_RULES](WORK_RULES.md), 분석/아트 도구는 [REFERENCES](REFERENCES.md).

검사 명령은 13개 역할, 링크/소스 경로, 12KB 시작 묶음을 확인한다. 바이트 감소는 컨텍스트 입력량 지표이며 실제 청구 토큰 절감률은 별도 측정해야 한다.
