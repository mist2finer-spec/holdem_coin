# 일반 사이드뷰·막힘 달리기·이동 속도 정정

사용자 확정 규칙은 **일반 구역 = 사이드뷰, 보스전만 = 쿼터뷰**다. 원신 환경 이식 과정에서 일반 구역까지 쿼터뷰로 바뀐 것을 수정했다. 이 규칙은 저장소 및 실제 Unity 프로젝트의 최상위 `AGENTS.md`에 기록했다. 이전 이식 보고서의 전체 쿼터뷰 설명보다 이 정정이 우선한다.

## 변경

- `unityBossMode`는 일반 구역에도 사용되므로 단독으로 보스전 시점의 조건으로 쓰지 않는다. 일반 10개 구역과 보스 모드의 일반 방은 `Side25D`, 보스 방은 `QuarterView`로 판별한다. 시점 버튼은 해당 구역 시점을 표시하고, 수동 전환과 V 키가 이 규칙을 우회하지 못하게 했다.
- 달리기 재생 시간을 실제 이동거리만으로 계산하던 방식에서, 이동 입력으로 요청한 보폭도 반영하도록 바꿨다. 장애물에 막혀 위치가 고정되어도 입력을 유지하면 달리기 모션이 계속 재생된다. 입력을 놓으면 대기 모션으로 돌아간다. 충돌 위치·공격·점프·구르기·슬라이드 판정은 이 표시 수정으로 바뀌지 않는다.
- 로컬 이동 프로파일 `source-run-v2`: 5.7819295m/s에서 **3.8546197m/s**로 변경했다. “1/3 감소”를 기존의 2/3로 해석했다. 점프 수평 이동거리, 구르기와 슬라이딩 거리도 같은 비율로 감소하며 액션 지속시간·점프 높이·중력은 유지한다.
- 이전 빌드의 맵·잔디·나무·돌·그림자·Nilo 캐릭터·액션 에셋은 유지했다. 새로운 네트워크 호출이나 매 프레임 할당은 추가하지 않았다.

## 검사

- 관련 엔진/번들/충돌/속도/공격 계약/전체 진행 검사 **11개 PASS**, RPG 타입 검사 PASS. 속도 비율과 정적 장애물에 막혔을 때의 달리기 상태 및 입력 해제를 검사했다.
- 새 프로파일 헤드리스 입력 검사: 일반 10구역 300처치 후 보스 승리, 25,494스텝. 기존 프로파일 미선택 경로도 기존 번들과 동치다.
- Unity 실제 실행: 왼쪽 맵 경계에 막힌 1.2초 동안 위치 변화 0m, 달리기 포즈 갱신 72회, 다리 회전 변화 64.48°. 입력 해제 후 `idle_loop`. 일반 구역 실제 화면은 사이드뷰, 실행 오류 0건.
- Unity 점프 정점 1.04996m, 수평 이동 3.210m, 구르기 2.168m. 슬라이드는 살아 있는 적에 막힌 구간이므로 해당 거리 0.297m를 자유 공간 최대 거리로 해석하지 않는다.

- **APK PASS:** 233.47초, 빌드 오류 0, 기존 미사용 필드 경고 1. ZIP·서명·16KB 정렬 검사 통과. 139,046,845 bytes, SHA-256 `55dcc85f94c01e1c5118cce9846417b978329d4e6e55fe6cf3845376a409094a`. [빌드](side-view-motion-fix-20261110/build-result.json), [무결성](side-view-motion-fix-20261110/apk-validation.json).
- **블루스택 막힘 모션 PASS:** 1.18초 동안 위치 변화 0.000m, 달리기 포즈 갱신 49회, 다리 회전 변화 69.94°. 입력 해제 후 대기 모션, 실행 오류 0. [측정](side-view-motion-fix-20261110/android-motion.json), [동일 위치 포즈 A](side-view-motion-fix-20261110/blocked-frame-13.png), [포즈 B](side-view-motion-fix-20261110/blocked-frame-13.4.png), [일반 구역 화면](side-view-motion-fix-20261110/android-side.png). 22초 실제 동영상은 로컬 `correction/evidence/android-motion.mp4`에 보존했다. 초기 로딩 중 캡처된 빈 화면은 동작 증거로 사용하지 않았다.
- **전체 경로·시점 PASS:** 523.68초 실제 APK 진행, 일반 10구역 300처치 후 보스 승리. 일반 10개 구역 모두 `Side25D`, 보스 전투 중과 완료 시 `QuarterView`. 실행 오류 0, 접촉 모션 불일치 0, 확인된 공격 접촉 600회. [검증](side-view-motion-fix-20261110/route-camera-validation.json), [원시 관측](side-view-motion-fix-20261110/route-camera-check.json), [전체 진행](side-view-motion-fix-20261110/android-complete.json), [실제 보스전](side-view-motion-fix-20261110/android-boss-active.png), [완료 화면](side-view-motion-fix-20261110/android-complete.png).
- **관측 경계:** 최초 `boss-loading`의 Update 기록에는 LateUpdate 전의 사이드뷰가 들어 있었고, 동일 기록을 3번 읽어 초기 관측 스크립트가 실패로 종료했다. 원시 기록을 보존하고 로딩 진입 표본과 전투 표본을 분리했다. 실제 보스전 화면 및 이후/완료 기록은 쿼터뷰이며, 로딩 완료 후 시점 불일치는 0건이다. [로딩 진입 기록](side-view-motion-fix-20261110/route-boss-1.json), [보스 전투 기록](side-view-motion-fix-20261110/android-boss-active.json).
- **성능:** 블루스택 안정 구간 평균 59.57FPS, p95 16.67ms. 전환 구간 최대 500.00ms. 실제 휴대전화 성능으로 해석하지 않는다.
- **GitHub CI PASS:** 소스 `6ec86e1aa02bcf650f4313282abea8f218ce51db`. [CI 실행](https://github.com/mist2finer-spec/holdem_coin/actions/runs/42870559650). 후속 커밋은 검사 결과 문서와 증거만 추가한다.
- **보존 PASS:** 기존 Unity 프로젝트/빌드 설정 해시 일치, Git 증분 파일 140개와 실제 프로젝트 내용 일치. [설정](side-view-motion-fix-20261110/settings-preserved.json), [소스](side-view-motion-fix-20261110/repository-file-hashes.json).


## 산출물과 재현

- 로컬 작업: `G:/holdem_coin-workspace/island-genshin-localcombat-20261110/correction`.
- APK: `builds/IslandGame-SideView-MotionFix-20261110.apk`, 버전 `0.1.0-test.20261110.2` / `2026111002`, `com.mist2finer.islandgame.dev`.
- [Unity 증분 소스](client-source-snapshot/2026-11-10-environment/README_KO.md). 실제 프로젝트는 `G:/new_project/IslandGame`이며, 기존 11월 9일 APK와 직전 환경 이식 APK는 보존했다.
- `npm run unity:training:kernel`, `npm run test:rpg:source-traversal`, `npm run test:rpg:local-training`, `npm run check:rpg`.
- 기존 `SourceEnvironmentProbe`는 일반 입력으로 경계에 접근하고 달리기/해제/액션을 기록한다. 시뮬레이션 위치를 직접 고치지 않는다. 검증용 localhost 서비스는 저장소 서비스와 익명 메모리 계정을 사용하며 외부 운영 서버에 데이터를 보내지 않는다.

원신 전체 물리와의 일치율, 실제 휴대전화 장시간 성능과 운영 계정 연동은 이 정정의 검증 범위에 포함하지 않는다.
