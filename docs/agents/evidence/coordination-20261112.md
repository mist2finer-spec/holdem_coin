# 작업 전달 도구 검증 — 2026-11-12

범위: 역할 간 작업 기록/조회/상태 처리. 게임 코드·에셋·빌드·배포는 대상 밖이다.

## 실행 결과

- `node --test scripts/agents/protocol.test.mjs`: 최초 27개 PASS. 실제 왕복에서 발견한 캐시 문제의 회귀 2개를 추가한 최종 29개 PASS.
- `node scripts/agents/context.mjs --check`: 13개 역할, 링크, 정적 묶음 12KiB 제한 PASS.
- `node scripts/agents/tasks.mjs inbox gameplay-dev`: 실제 GitHub 조회 PASS, 도입 시점 미처리 작업 0개.
- `git diff --check`: PASS.

회귀 범위: 댓글 순서가 뒤집혀도 같은 상태 복원, 중복 인수/중복 event ID/오래된 버전 거부, 다른 Issue로 오발송 거부, 인수 없는 제출 거부, 동일 실행의 자기 검수 거부, 검수 해시/기준 누락 거부, 본문/댓글 수정 감지, 요청 branch/SHA 불일치, BLOCK/RESUME/RELEASE/재검수, 원격 산출물 누락/해시 불일치, 의존 미완료/영수증 변경/순환, 닫힌 미완료 Issue 표시, 역할별 조회/페이지 처리/API 실패 구분, 한국어 요약의 4KiB 제한.

## 증거의 한계

실제 GitHub 댓글 작성 직후 공개 API가 이전 빈 댓글 목록을 반환한 경우를 확인했다. 상태 조회에 매번 고유 URL과 no-cache를 사용하고 Issue의 알려진 댓글 수보다 적은 응답은 UNAVAILABLE로 처리하도록 보강했다.

자동 검사에서 가짜 GitHub 응답을 사용하는 경우는 상태 전이·실패 처리를 검증한다. 실제 별도 AI 에이전트가 서로 이해하고 게임 작업을 수행했다는 검증이 아니다. 독립 검수, 실기 플레이, 아트 품질, Craft Anything 새 분석, ComfyUI 새 생성은 수행하지 않았다.

이 문서를 고정 커밋으로 가리키는 시험용 Issue의 인수/제출/검수 기록은 **프로토콜 왕복 시험**이다. 시험 역할/실행 ID는 실제 부서 작업 완료를 뜻하지 않는다. 이후 제품 작업은 별도 담당자의 실제 검수 전까지 DELIVERED로 유지한다.
