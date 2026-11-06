# 구역 단위 통신 + Unity 로컬 전투 인계

대상: `assets/unity-lowpoly-combat`, 기준 `f28f3e8f35cb39976475b6c62c10f5659ec62ce6`.
실제 프로젝트: `G:/new_project/IslandGame`, Unity 6000.0.62f1.
이번 변경은 **일반 미궁 사냥(`/api/rpg/rogue`)** 에 적용한다. 성장 사냥(`/api/rpg/session`), 포커, 보스 체험의 기존 통신은 유지한다.
이 문서를 이전 로우폴리/주얼 인계보다 먼저 읽는다. 로우폴리 모델·성좌 V2 배치는 유지했다.

## 결과와 운영 적용 경계

- **PASS**: TypeScript 검사, 새 프로토콜 검사 8개, 관련 기존 전투 회귀 51개, 실제 Unity Play Mode 로컬 전투·연결 끊김·복구·중복 지급 검사.
- **PASS**: 서버와 같은 TS 전투 엔진을 번들로 실행하여 자동 사냥의 피해·처치·이동·구역 종료 결과를 대조했다. 별도 간이 전투식을 만들지 않았다.
- Android APK 결과·해시는 이 문서 하단과 `stage-sync-apk-validation-20261105.json` 참조.
- **UNAVAILABLE**: Galaxy S25 실행·FPS·발열·GC 측정. 연결된 adb 기기가 없다. Editor 결과를 모바일 성능 보장으로 해석하지 않는다.
- **미배포**: GitHub 작업 브랜치 게시와 로컬 적용까지만 수행했다. main 병합·운영 Render 배포는 하지 않았다. 운영 서버에 새 라우트가 배포되어야 운영 주소에서 구역 통신 모드가 활성화된다.
- 구형 운영 서버는 최초 `start` 응답에 새 프로토콜이 없어 클라이언트가 기존 방식으로 연결하며 안내한다. **구형 서버에 접속하면 기존 0.1초 폴링이 남는다. 이 APK만 교체해서 운영 통신 구조가 바뀌지는 않는다.**

## 전투와 통신

1. 입장 `start`: `clientProtocol=island-stage-v1`, 요청 UUID, 전투 커널 SHA-256을 보낸다. 서버는 계정·장비·성장·주얼을 계산한 고정 로드아웃, 맵 seed, 구역 ticket, 예상 처치 수, 고정 보상 예산을 반환한다.
2. 진행: Unity의 별도 작업 스레드가 기존 `RogueEngine` JS를 0.02초 고정 스텝으로 실행한다. 이동, AI, 공격, 충돌, 피격, 죽음, 스킬, 물약, 웨이브를 모두 로컬에서 처리한다. 메인 스레드에 약 20Hz 스냅샷을 전달한다. **진행 중 combat tick HTTP는 0회**다.
3. 구역 경계/사망: 이전 구역의 누적 처치·명목 골드·XP·소요 시간·실제 분기 도착 구역을 보낸다. 새 구역의 AI/피해 계산을 시작하기 전에 멈춘다. 서버 확정 응답 이후 다음 구역을 실행한다. 최종 방 9는 완료 상태로 끝난다.
4. 성장·장비 변경처럼 사용자가 명시적으로 누르는 저장 작업은 별도 `stage-action` 요청을 유지한다. 전투 tick으로 간주하지 않는다. 응답까지 시뮬레이션을 멈추고 계산된 로드아웃을 교체한다.
5. 앱 백그라운드 중에는 전투를 진행하지 않는다. 구역 진행 중 네트워크 단절은 전투를 막지 않는다. 구역 경계에서만 연결 복구까지 대기한다.

기존 일반 전투 엔진에 `pauseAtRoomBoundary` 옵션만 추가했다. 기본값 false라 웹/기존 서버 전투는 이전 동작을 유지한다. 맵 분기는 `roomGates()`로 확인하며 방 번호 +1로 가정하지 않는다.

## 보상·저장 계약

- 구역당 보상은 기존 `zoneRewardBudget(difficulty)`의 고정값이다. 1단계 시험에서는 50마리 처치, 432골드였다. 몬스터당 UI 명목 합계는 기존 `rewardForKill()` 배분을 유지한다.
- 서버는 입장 시 기록한 처치 목표와 고정 보상으로 합계를 검사한다. 클라이언트 임의 골드 값을 계정에 그대로 더하지 않는다. 일일 XP/골드 상한도 유지한다.
- 구역을 클리어해야 해당 구역의 보상이 확정된다. 실패한 현재 구역의 부분 처치 보상은 지급하지 않는다. 이전에 클리어한 구역의 저장 보상은 남는다.
- `rpg_stage_runs`, `rpg_stage_receipts`, `rpg_stage_actions`는 기존 계정/아이템과 **같은 SQLite 연결**을 사용한다. 지갑·처치·최종 난이도·보스 첫 보상·영수증을 하나의 트랜잭션으로 저장한다.
- ticket별 동일 결과 재전송은 저장된 응답을 돌려준다. 내용이 바뀐 재전송은 거절한다. 같은 결과가 도착해도 보상은 한 번만 지급된다. 성장 작업도 요청 ID로 중복 실행을 막는다.
- 결과는 전송 전에 `Application.persistentDataPath/stage-result-<endpoint+cookie hash>.json`에 기록한다. 응답 유실 시 같은 결과로 재시도한다. 앱 재시작 후에도 미확정 결과를 먼저 복구한다. 영구 거절된 파일은 `.rejected-*`로 보존한다.
- 일반 연결 오류는 제한 재시도, 구역 결과의 연결 오류는 1/2/4/8/16/30초 대기로 계속 재시도한다. 성공할 때까지 동일 요청 내용을 유지한다.
- 진행 중인 구역 자체의 디스크 체크포인트는 없다. 중간에 앱을 종료하면 그 구역은 다시 입장해야 한다. 미전송/미확정 구역 결과 복구와 구분한다. ticket 유효기간은 24시간이다.
- **안티치트 검증 완료가 아니다.** 현재는 계정·ticket·분기·처치/보상 합계·기간·중복만 검사한다. 조작 클라이언트가 그럴듯한 클리어 합계를 만들 가능성은 남는다. 서버 재현/시간·행동 검증은 사용자 요청대로 후속 범위다.

## 파일과 재현

| 파일 | 역할 |
|---|---|
| `src/lib/rpg-stage-service.ts` | 구역 계약, 고정 보상, 트랜잭션, 영속 중복 방지 |
| `src/app/api/rpg/rogue/route.ts` | 프로토콜 협상; 기존 웹 요청 유지 |
| `src/components/rpg/rogue/engine.ts` | 새 방 진입 경계에서 정지하는 선택 옵션 |
| `src/components/rpg/rogue-stage/*` | 원본 엔진 래퍼, 서버가 계산한 성장/장비 주입 |
| `scripts/build-unity-stage-kernel.cjs` | 원본 TS → 브라우저용 순수 JS; 불필요한 6천 캠페인 데이터 제외 |
| `src/lib/generated/rogue-stage-kernel.json` | 커널 버전, SHA-256, 바이트 수, 입력 소스 |
| 스냅샷 `Runtime/RpgSession.cs` | 일반 미궁 로컬 모드 진입, 기존 모드 호환 |
| 스냅샷 `Runtime/RpgLocalStageSession.cs` | HTTP/보상 경계/복구/메타데이터 결합 |
| 스냅샷 `Runtime/StageCombatWorker.cs` | 전용 스레드의 Jint 소유 및 고정 스텝 실행 |
| 스냅샷 `Runtime/IslandBattleBridge.cs` | 저장 경계 대기 시 조작 방지 |
| 스냅샷 `Resources/RogueStageKernel.js.txt` | Unity TextAsset으로 읽는 실제 커널 |
| 스냅샷 `Plugins/StageRuntime/*` | DLL GUID, link.xml, 버전/해시, 라이선스 |

`unity/IslandGame`은 최신 실제 프로젝트 전체가 아니다. **실제 프로젝트를 그 폴더로 덮어쓰지 않는다.**
`client-source-snapshot/2026-11-05/source-manifest.json`의 원본 경로·해시와 G: 파일을 비교하고 차이가 있으면 보존/검토한다. 이번 스냅샷의 포함 소스 146개는 실제 로컬 파일 해시와 대조했다. 전체 PlayerSettings는 개인 플랫폼 값 때문에 게시하지 않고 안전한 빌드 설정만 manifest에 기록했다.

커널 생성/검사:

```sh
npm ci --legacy-peer-deps
npm ci --prefix mini-services/poker-server
npm run unity:stage:kernel
npm run test:rpg:stage
npm run check:rpg
```

원본 전투/밸런스 변경 시 커널을 다시 생성하고 Unity `Assets/Island/Resources/RogueStageKernel.js.txt`도 교체해야 한다. CI는 커널의 오래된 상태를 거절한다. 서버와 APK 커널 해시가 다르면 로컬 모드 입장을 거절하므로 함께 배포해야 한다. 롤링 배포 중 해시 불일치 시 앱 업데이트 안내가 나온다.

로컬 JS 실행은 **Jint 4.17.0 / Acornima 1.7.0 / Unsafe 6.0.0**의 관리 DLL을 사용한다. CLR 접근·HTTP·파일시스템을 JS에 노출하지 않는다. Android는 IL2CPP/ARM64이며 런타임 C# 코드 생성이나 JS JIT를 쓰지 않는다. 관련 assembly를 link.xml로 보존한다. 라이선스는 인접 텍스트 파일에 포함했다.

DLL 바이너리는 텍스트 전용 GitHub 연결로 업로드하지 않았다. 공식 NuGet URL·버전·DLL SHA-256으로 복원한다:

```sh
python scripts/unity/restore-stage-runtime.py --project G:/new_project/IslandGame
```

기존 DLL이 다르면 백업하고, 다른 소스/메타데이터가 다르면 덮어쓰지 않고 중단한다. NuGet 패키지에서 정확한 대상 프레임워크 DLL만 추출한다. 복원 후 Unity 재임포트/컴파일을 확인한다.

## 실제 검사와 남은 성능 위험

상세 증거: `stage-sync-validation-20261105.json`. 새 검사 8개는 HTTP 협상·기존 요청 호환, 본문 크기, 성장 요청 중복, 고정 보상·변조 합계·계정·nonce·분기·만료 거절, 사망, 최종 클리어/일일 상한, COMMIT 오류 주입/롤백, SQLite 재오픈 후 재전송, 원본 엔진/번들 동일 입력 대조를 포함한다.

Unity Play Mode에서는 frame이 실제 증가하는 것을 확인했다. 입장 HTTP 1회로 48마리까지 처치했다. 연결 중단 뒤 50마리 경계에 도달했다. 서버 저장 직후 응답을 유실시키고 재전송했을 때 432골드로 한 번만 저장됐다. 두 번째 연결 중단에서도 100마리 경계까지 갔으며 복구 후 864골드, 이후 111마리까지 이어졌다. 정상 진행 중 `tick` HTTP는 없었다. 연결 오류 재시도는 구역 경계에서만 발생했다. 강제 응답 유실이 Unity Curl 52 로그와 Editor Error Pause를 유발해 수동 재개했으며 전투 예외는 아니었다.

서버 요청 제거가 **전체 렉 해결을 보장하지 않는다.** Jint 해석 실행과 JSON 스냅샷에는 CPU/GC 비용이 있다. 실제 Editor 부하 시험에서 누적 시뮬레이션 시간 드롭과 최대 389.5794ms 작업 스레드 배치가 관측됐다. 이것은 메인 프레임 시간도 S25 측정값도 아니다. 작업 스레드로 UI와 분리했지만 실제 기기에서 Profile해야 한다. 필요하면 같은 입력 대조를 유지하면서 이후 네이티브 전투 코어로 옮긴다.

형식 증명은 이번에 실행하지 않았다. 기존 모델이 없고, 핵심 지급 불변 조건은 실제 동일 DB 트랜잭션·COMMIT 오류 주입·재오픈·중복 요청 테스트로 확인했다. 전체 안티치트나 프로그램 전체 안전성 증명을 의미하지 않는다.

## Android 테스트 빌드

버전 `0.1.0-test.20261105.4` / code `2026110504`, 패키지 `com.mist2finer.islandgame.dev`.
씬은 `Assets/Island/Scenes/Island.unity`, IL2CPP ARM64 Development Build.
기본 서버는 기존 `https://holdem-coin-tavern.onrender.com`이며 시험용 localhost·쿠키·이름·토큰 설정은 복원했다. 로비는 변경하지 않았다.
APK는 로컬 `G:/new_project/IslandGame/Builds/Android/IslandGame-Test-StageSync-20261105.apk`에 제공한다. 바이너리 GitHub 업로드는 하지 않는다. **PASS**: 100,717,769 bytes, SHA-256 `d04d8302765baa0980b3439d0ea4bc353125572c8389e7f55a31a5e0f3c185fc`. 서명·ZIP 무결성·16KB 정렬·INTERNET 권한·ARM64 IL2CPP·버전 검사를 통과했다. `STAGE_RUNTIME_LICENSES.txt`를 APK와 함께 제공한다. 첫 빌드는 Bee 임시 응답 파일 생성 실패였고, 같은 입력의 재실행은 289.454초에 성공했다.

실제 기기 실행은 미검증이다. 서버 코드가 운영에 배포되기 전 이 APK는 운영 주소에서 기존 폴링 호환 모드로 동작한다.
