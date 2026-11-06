# 구역 통신 운영 배포 완료

결과: **PASS**. 확인 시각(UTC): `2026-11-06T01:33:52.641Z`.

- 운영: https://holdem-coin-tavern.onrender.com
- 서비스: `holdem-coin-tavern`, `srv-dbb816bbc2fs73dds24g`, 사용자 확인한 `Test place` 작업공간.
- 배포: [`dep-dbmipvrncjis73a24vu0`](https://dashboard.render.com/web/srv-dbb816bbc2fs73dds24g/deploys/dep-dbmipvrncjis73a24vu0), **live** 확인.
- 운영 코드: [`774c9d6`](https://github.com/mist2finer-spec/holdem_coin/commit/774c9d6a09e09ec8c5f087316724cc28e342d2eb). 기존 main `a92b9bd`를 포함하는 fast-forward이며 강제 덮어쓰기는 하지 않았다.
- main 변경으로 기존 자동 배포가 시작됐다. 수동 중복 배포·캐시 초기화·서비스/환경변수/요금제/저장소 변경은 하지 않았다.
- 기존 코드 커밋 CI: [전체 통과](https://github.com/mist2finer-spec/holdem_coin/actions/runs/42140067224).

## 운영 검증

`/healthz`에서 웹과 포커 모두 정상, `/api/release`에서 위 코드 리비전을 확인했다.
별도의 새 게스트 계정으로 운영 `/api/rpg/rogue`에 접속했다. 사용자 쿠키·계정은 사용하지 않았다.

1. `island-stage-v1` 협상 성공, APK 커널과 같은 SHA-256 `23065421e8959b198df629426b1bda0fa3a8cf62329d66f097211a1619f2102b` 반환.
2. 같은 입장 요청 재전송 시 동일 ticket 유지.
3. 공유 전투 코어를 로컬에서 실제 실행하여 첫 구역 **50마리 / 시뮬레이션 35.90초** 클리어.
4. 서버가 고정 **432골드** 지급. 동일 결과 재전송에도 같은 영수증과 잔액 반환, 중복 지급 없음.
5. 다음 구역으로 ACK 후 로컬 전투 시간이 다시 증가.
6. 기존 프로토콜 클라이언트의 start 응답도 정상.

상세 결과: [검증 JSON](stage-sync-production-validation-20261105.json).
이 검사는 실제 운영 API와 공유 전투 코어의 연결 검증이며 S25 실행/FPS 측정은 아니다.

## 클라이언트와 저장소

새 APK를 다시 만들 필요는 없다. **0.1.0-test.20261105.4 / 2026110504**를 사용한다.
로컬 APK: `G:/new_project/IslandGame/Builds/Android/IslandGame-Test-StageSync-20261105.apk`.
SHA-256: `d04d8302765baa0980b3439d0ea4bc353125572c8389e7f55a31a5e0f3c185fc`.

일반 미궁 `/api/rpg/rogue`의 진행 중 combat tick 요청은 없고 구역 경계/사망에 정산한다.
성장·장비 변경 요청 및 별도 성장 사냥 `/api/rpg/session`은 기존 통신을 유지한다.
이미 실행 중인 사냥은 새로 입장해야 새 서버와 세션을 시작한다.

현재 운영 `/api/release`의 저장 상태는 **ephemeral SQLite**다. 재배포/재시작 후 데이터 유지가 보장되지 않는 기존 구성이며 이번 배포에서 변경하지 않았다. 영구 저장 구성과 안티치트 강화는 별도 후속 작업이다.
자동 검사 통과와 실기기 성능/사용성 승인을 구분한다.

운영 로그 확인 결과는 Render의 배포 로그와 실제 health/release 응답을 함께 기준으로 한다.
이 문서를 추가하는 문서 전용 커밋은 `[skip render]`를 사용해 불필요한 재배포를 방지한다. 따라서 main의 문서 커밋과 운영 `/api/release`의 코드 리비전은 달라도 정상이다.
