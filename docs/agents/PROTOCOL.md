# GitHub 작업 전달 규약 v1

## 원본·범위

GitHub Issue 본문은 작은 불변 요청 패킷, 댓글은 순서가 있는 추가 기록이다. `scripts/agents/protocol.mjs`가 이를 해석한다. 로컬 사본·브랜치별 CURRENT·채팅은 별도 원장이 아니다. 13개 프로세스를 자동 실행하지 않는다.

- 제목은 `[agent-task:<수신 역할>] 목표`. 본문/댓글은 도구가 생성하는 `agent-task:v1` / `agent-event:v1` JSON 블록이다.
- GitHub 댓글 ID 순서와 `expected_version`으로 동일 작업의 첫 유효 요청만 반영한다. 중복 ID/오래된 버전은 거부 내역에 남는다. 저장 후 반드시 재조회한다.
- `trustedLogins`의 GitHub 작성자만 인정한다. 초기 값은 저장소 소유자 `mist2finer-spec`. 다른 계정은 저장소 검토 후 목록에 추가한다. 역할과 실행 ID는 협업 식별자이며 인증 수단이 아니다.
- 요청 본문/프로토콜 댓글을 수정·삭제하지 않는다. 수정된 댓글 또는 요청 해시 불일치는 UNAVAILABLE로 중단한다. 잘못된 범위는 새 Issue에 기존 번호와 사유를 연결한다. 관리자의 기록 삭제까지 막는 감사 시스템은 아니다.
- GitHub Close는 검수 완료가 아니다. 닫혀도 ACCEPTED가 아닌 작업은 수신함에 남는다. 완료 후 Close는 화면 정리용이다.

## 상태와 책임

`OPEN → CLAIMED → DELIVERED → ACCEPTED`

- CLAIM: 수신 역할, 고유 `instance`, 실제 checkout branch/SHA 확인. 인수 확인(ACK)을 겸한다.
- CHECKPOINT: 소유자가 마지막 결과와 `next_step`을 기록. 수신함은 최신 요약만 출력한다.
- BLOCK / RESUME: 중단 사유·해제 조건을 기록하고 소유자가 재개한다.
- RELEASE: 실행 종료를 확인한 소유자가 인수를 반환한다. 새 세션은 이전 실행의 종료를 확인하고 인계받는다. 시간만 지났다고 소유권을 뺏지 않는다.
- DELIVER: 소유자가 지정 커밋에 결과를 올린 뒤 제출. `validation`, `limitations` 필수.
- ACCEPT / REQUEST_CHANGES: 지정 검수 역할의 다른 실행 ID가 처리. ACCEPT에는 모든 기준의 PASS·근거 파일 경로·제출 해시가 필요하다.
- REOPEN: 발신자/검수자가 완료를 다시 열면 이전 검수 기록이 무효가 된다. 수정 후 재제출·재검수한다.
- 의존 Issue는 ACCEPTED여야 CLAIM/RESUME/DELIVER/ACCEPT 가능하다. 영수증이 바뀌면 downstream은 BLOCKED_DEPENDENCY로 표시한다. 기준 변경 후 동일 결과를 자동 재승인하지 않는다.

director는 범위/우선순위, tech-director는 공유 파일/계약 순서, 분야 lead는 수용 기준, qa-release-lead는 필요한 검수 배정을 맡는다. 모든 계층 승인을 추가하지 않는다. 파일 존재/해시 검사는 실제 품질 검토를 대신하지 않는다.

## Node 명령

Node 22 이상, 외부 npm 패키지 없음. 공개 저장소 조회는 인증 없이 가능하나 API 제한이 있다. `GH_TOKEN`/`GITHUB_TOKEN`이 있으면 사용한다. 토큰을 파일/로그에 저장하지 않는다. 쓰기에는 Issues 쓰기 권한이 필요하다. 기존 GitHub 연결 도구도 사용할 수 있다.

```sh
node scripts/agents/context.mjs gameplay-dev
node scripts/agents/context.mjs technical-artist --unity --offline
node scripts/agents/tasks.mjs inbox gameplay-dev
node scripts/agents/tasks.mjs inbox gameplay-dev 3
node scripts/agents/tasks.mjs show 10
node scripts/agents/tasks.mjs init task.json
node scripts/agents/tasks.mjs create task.json
node scripts/agents/tasks.mjs prepare 10 event.json
node scripts/agents/tasks.mjs send 10 event.json
node scripts/agents/tasks.mjs manifest FULL_RESULT_SHA docs/agents/evidence/task-10.md
node scripts/agents/tasks.mjs verify 10
```

`init`/`prepare`는 JSON을 출력하며 원격 쓰기를 하지 않는다. `create`/`send`만 쓴다. 실패한 쓰기를 재시도하기 전 Issue에서 event ID를 확인한다. `prepare`와 실제 기록 사이에 상태가 바뀌면 재준비한다. `show`는 요청/현재 상태/최신 체크포인트/거부 사유만 보여주며 전체 댓글은 출력하지 않는다.

CLAIM 입력 (`event.json`; 실제 branch/SHA로 채운다):

```json
{
  "type": "CLAIM", "login": "mist2finer-spec", "role": "tools-perf-engineer",
  "instance": "tools-session-20261112-a", "summary": "요청과 범위 확인 후 인수",
  "checkout": {"branch": "main", "sha": "전체 40자리 실제 SHA"}
}
```

`prepare`가 schema/event ID/요청 해시/상태 버전/의존 영수증을 추가한다. BLOCK/CHECKPOINT에는 `next_step`, DELIVER에는 [제출 예제](examples/delivery-event.json)의 `delivery`, ACCEPT에는 [검수 예제](examples/accept-event.json)의 `checks`를 채운다. 체크포인트에는 결과·파일·검증·다음 한 단계를 짧게 쓴다.

## GitHub 연결 도구만 사용하는 세션

1. 역할 문서 3개를 읽고 저장소 Issues를 페이지 끝까지 조회한다(PR 제외). 제목 접두어와 본문의 `from`/`to`/`reviewer`로 해당 역할을 고른다. 검색은 색인 지연이 있으므로 결과의 완전성을 확인하지 못하면 UNAVAILABLE로 보고한다.
2. 선택 Issue의 본문/댓글을 조회한다. 가능하면 로컬 `show`/`prepare`로 검증한 본문만 연결 도구에 넘긴다. 전체 댓글/자료를 모델에 반복 입력하지 않는다.
3. `create_issue`에는 `init` 출력의 title/body, 댓글 작성 도구에는 `prepare` 출력의 body를 전달한다. 작성 후 `show`로 실행 ID/version을 확인한다.
4. Node를 실행할 수 없으면 같은 규약으로 수동 조회/기록하되 **기계 검증 미실행**이라고 표시한다. 파일·해시를 확인할 수 없으면 ACCEPT를 작성하지 않는다. GitHub 검사나 실행 가능한 담당자에게 검증을 넘긴다.

## 공유 근거·Craft Anything·ComfyUI

**역분석은 사용자 지정 로컬 전용 정책을 우선 적용한다.** [역할 우선 지침](../../.agents/roles/reverse_eng_designer.md)은 자료 묶음의 Git 커밋/푸시·LFS·Release/Issue 첨부·본문 업로드를 금지한다. 분석 원본·추출물·`.cany`·상세 보고서·로그·영상은 로컬에 유지한다. 다른 역할이 이 자료를 받아도 같은 방침을 따른다.

GitHub에는 [로컬 위치 인덱스](examples/reverse-reference.json)처럼 경로와 식별정보만 남긴다. `access: local-only`, 실제 `G:/` 절대 보관 경로, 첫 진입 파일, 필요한 자료 파일/해시, 버전, 확인 시각·상태를 기록한다. 분석 본문·전체 파일 목록·대량 로그는 복제하지 않는다. 예제의 `<task>`와 미확인 값은 실제 확인 후 채운다. 새 작업물은 `G:/holdem_coin-workspace/island/maintenance/<task>` 아래에 두며 기존 기록/아카이브는 현 위치를 가리킨다. 경로 변경 시 인덱스를 갱신한다. 사용자 지정 작업 경로는 게시할 수 있지만 인증정보는 기록하지 않는다.

`expected_artifacts`는 여전히 이 저장소의 1MiB 이하 커밋 파일이다. **역분석 작업에서는 원본 자료 대신 작은 위치 인덱스의 저장소 상대 경로**를 지정한다. `sources`는 HTTPS 참조가 없으면 `[]`로 두고, 로컬 경로를 HTTPS인 것처럼 넣지 않는다. DELIVER의 SHA-256 및 `checks[].evidence`도 인덱스 파일을 가리킨다. 원격 도구는 커밋 후손 관계와 인덱스 바이트만 검사하며 로컬 원본을 다운로드/업로드하지 않는다. 일반 작업의 산출물 해시 검증은 기존대로다.

수신·검수하는 로컬 에이전트는 해당 절대 경로를 직접 열어 존재·버전·해시와 요청한 범위의 내용을 확인한다. 원본 확인 전에는 인덱스가 있다는 이유로 ACCEPT하지 않는다. 로컬 확인 결과·미확인 항목은 DELIVER의 validation/limitations와 검수 summary에 짧게 남긴다. G: 부재/경로 불일치/해시 불일치는 BLOCK/UNAVAILABLE로 남긴다. 이를 해결하기 위해 자료를 GitHub에 올리거나 클라우드 에이전트 접근용 사본을 만들지 않는다. 검수 기록은 실제 로컬 에이전트의 확인 진술이며 GitHub CI가 확인한 것으로 표현하지 않는다.

reverse_eng_designer는 Craft Anything session/target/질문/evidence ID/관찰을 로컬 인계 파일에 두고 위치 인덱스의 고정 커밋 링크를 수신 역할별 Issue에서 재사용한다. ComfyUI의 역분석 연계 시안/workflow/model 식별자·seed·해시·검증 범위도 로컬 인계에 둔다. 일반 아트 작업은 기존 방식으로 수신자가 접근 가능한 시안 위치와 검증 범위를 전달한다. 원본 또는 시안 접근이 안 되면 해당 검수를 보류한다. 이번 정책으로 기존 게시 자료를 소급 삭제하지 않는다.

## 검사·한계

```sh
node --test scripts/agents/protocol.test.mjs
node scripts/agents/context.mjs --check
```

GitHub `Agent coordination` workflow는 코드/문서 변경 검사와 Issue 변경 시 읽기 전용 상태 확인을 실행한다. Issue 문장을 셸 명령으로 실행하거나 자동 인수/승인하지 않는다. CI 성공은 프로토콜 정합성이지 수신자의 실제 이해/플레이 성공이 아니다.

수신함은 최종 상태 요약 최대 3개(4KiB 이하), 정적 역할 묶음은 12KiB 이하. 페이지/네트워크/권한/해시 오류는 UNAVAILABLE이며 작업 없음으로 취급하지 않는다. 알림 데몬은 없으므로 시작·재개·제출 전후에 조회한다. 이슈 단위 동시성은 처리하지만 여러 Issue의 파일 변경은 tech-director가 조율한다.

설계 참고: [세션 요약](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/abc0de79d6ceb0b5d7aa693945849b3937afbe6a/.claude/docs/context-management.md), [산출물 확인](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/abc0de79d6ceb0b5d7aa693945849b3937afbe6a/.claude/hooks/validate-agent-artifact.sh). 외부 프레임워크/코드를 복사하거나 Claude 전용 hook을 Codex에 설치하지 않았다.
