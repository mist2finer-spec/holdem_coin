> 최신 정정: **일반 사이드뷰 / 보스전만 쿼터뷰**, 이동속도 3.8546m/s, 막힘 상태 달리기 지속. [정정 빌드·검증](SIDE_VIEW_MOTION_FIX_20261110_KO.md). 아래의 전체 쿼터뷰·5.78m/s 설명은 최초 이식 당시의 기록이다.

# 2026-11-10 LocalCombat 환경 이식 시험

11월 9일 최종 `IslandGame-LocalCombat-20261109.apk`를 기준으로 기존 전투 규칙과 맵을 유지하면서 쿼터뷰, 원신 잔디·나무·돌, 이동 프로파일과 그림자를 연결했다. 기존 Pink Glass 액션과 Nilo 캐릭터 셰이딩을 사용한다. 새 원신 독립 시험 씬으로 게임을 교체하지 않는다.

- 기준 APK SHA-256: `216322baee38d6940933e87ce783c2f4a15ece27535364d16eebb2dec8a51a02`.
- 시험 APK: `IslandGame-GenshinEnvironment-20261110.apk`, 버전 `0.1.0-test.20261110.1` / `2026111001`, 패키지 `com.mist2finer.islandgame.dev`, ARM64 Development.
- APK 크기: 139,036,198 bytes. SHA-256: `516c74a432c981467a70680cd10bd92682ab20aa5044e20ac05b70e352c0151a`.
- 로컬 APK 위치: `G:/holdem_coin-workspace/island-genshin-localcombat-20261110/builds/IslandGame-GenshinEnvironment-20261110.apk`.
- [증분 Unity 소스·리소스](client-source-snapshot/2026-11-10-environment/README_KO.md), [원본 근거](source-environment-20261110/provenance.json), [APK 검사](source-environment-20261110/apk-validation.json).

## 유지한 것과 바뀐 것

10개 일반 구역과 보스 구역의 지형, 경로, 충돌 배치, 진행 조건, 적 수·능력치, 공격 판정·타이밍·피해·스킬 규칙을 유지한다. 기본 시점을 쿼터뷰로 바꾸며 기존 시점 전환도 사용할 수 있다. 일반 구역의 경로 제한과 보스 구역의 평면 이동 방식은 기존대로다.

원신 LongGras 메시 4 LOD, CyTree01/FirTree01, MDSRock06/07과 텍스처를 사용한다. 나무·돌은 기존 배치의 위치와 크기 범위에 맞춘 시각 교체다. 잔디는 지형에서 0.38m 간격에 흔들림을 주어 배치하고 기존 흙길 마스크와 급경사를 제외한다. 보스 지형은 0.42m 간격이다. 실제 원신 원본 배치를 Island 맵에 덮어쓰지 않는다.

가까운 잔디를 유지하면서 4m 공간 셀·시야 검사·거리 30m·4 LOD·1,023개 묶음으로 그린다. 부하가 높으면 거리 22m와 한 단계 낮은 LOD를 사용한다. 개별 풀 오브젝트와 물리 Collider를 만들지 않는다. 풀은 그림자를 받으며, 캐릭터·나무·돌·지형은 그림자를 드리운다. 나무/돌은 2 LOD를 사용한다. 생성된 추가 환경 리소스는 메타파일을 포함하여 약 5.9MB다.

`source-run-v1`은 로컬 훈련만 선택한다. 달리기 5.7819295m/s, 점프 정점 1.05m·중력 9.81m/s², 구르기·슬라이드 거리의 속도 연동을 적용한다. 원본 Run 클립의 averageSpeed가 속도의 근거이며 원본 컨트롤러 실측값은 아니다. 중력·정점과 잔디 접촉 복원 시간은 시험 조정값이다. 정적 장애물은 구르기로 관통하지 않게 했고 기존 전투 무적과 적 몸체 예외는 유지한다.

## 검증

- **PASS — 코드:** 기존 회귀 62개, 새 프로파일·번들·탄도·정적 장애물·공격 계약·전체 진행 검사 6개. RPG 및 새 테스트 타입 검사 PASS. 원본 엔진 기본 경로는 기존 번들과 동치다.
- **PASS — 헤드리스 전체 진행:** 일반 입력으로 10구역 300처치→보스 승리, 새 프로파일 24,334 스텝. 맵 데이터를 바꾸거나 체력·위치를 시험 코드로 조작하지 않았다.
- **PASS — 빌드:** 283.96초, 오류 0, 기존 미사용 필드 경고 1. ZIP/서명/16KB 정렬 PASS.
- **PASS — 실제 Unity:** 쿼터뷰와 원본 환경 메시·그림자 표시, 기존 달리기·점프·구르기·슬라이딩 클립 재생. 달리기 다리 회전 변화 82° 이상, 점프 정점 약 1.05m, 실행 오류 0. [기록](source-environment-20261110/editor-motion.json).
- **PASS — Android 입력 시험:** 블루스택 900×1600에서 동일 클립 재생, 점프 약 1.05m, 구르기 약 3.25m, 실행 오류 0. 왼쪽 슬라이드는 적 몸체에 막혀 약 0.30m 이동했다. 이 구간을 자유 공간 최대 이동거리로 해석하지 않는다. [기록](source-environment-20261110/android-motion.json), [실제 화면](source-environment-20261110/android-motion.png).

- **PASS — Android 전체 진행:** 491.64초 동안 10개 일반 구역 300처치 후 보스 승리. 실행 오류 0, 잘못된 공격 접촉 자세 0, 확인된 공격 접촉 600회, 지면 검사 28,538회 중 누락 0. 최대 지면 간격 0.0273m. 씬 최대 2개, 애니메이션 그래프 최대 8개. [전체 기록](source-environment-20261110/android-complete.json), [완료 화면](source-environment-20261110/android-complete.png).
- **성능:** 블루스택 안정 구간 27,939프레임 평균 59.38FPS, p95 16.67ms. 50ms 초과 14회, 최대 116.67ms. 전환 구간 292프레임 평균 20.95ms, 최대 516.67ms. 로컬 시뮬레이션의 누적 지연 버림 0.667초도 기록했다. 실제 휴대전화 측정값으로 해석하지 않는다.
- **PASS — 실제 터치·일시정지:** Android 스와이프와 점프·구르기·슬라이드 버튼 터치 확인. 홈 전환 중 로컬 스텝 1,672로 정지하고 복귀 후 1,740으로 재개, 요청 수는 모두 1로 유지. [기록](source-environment-20261110/android-pause.json), [터치 후 화면](source-environment-20261110/android-touch.png). 원본 동영상은 로컬 작업 폴더 `evidence/android-touch.mp4`에 보존했다.
- **PASS — 산출물 보존:** 설치된 APK의 해시가 빌드 APK와 일치. 기존 Unity 프로젝트·빌드 설정 파일의 SHA-256이 작업 전과 동일. Git에 저장된 Unity 증분 파일 136개가 실제 프로젝트 파일 해시와 일치. [설정](source-environment-20261110/settings-preserved.json), [APK](source-environment-20261110/installed-apk.json), [소스](source-environment-20261110/repository-file-hashes.json).
- **PASS — GitHub CI:** 소스 커밋 `497f3bb852af9a877e2d56a5003e5957113954ed`의 server 검사 22단계 통과. [실행 결과](https://github.com/mist2finer-spec/holdem_coin/actions/runs/42866016679), [기록](source-environment-20261110/ci.json). 후속 커밋은 최종 검증 문서·증거만 추가한다.

GitHub 작업 브랜치는 [`codex/genshin-environment-20261110`](https://github.com/mist2finer-spec/holdem_coin/tree/codex/genshin-environment-20261110)이다. main 병합이나 운영 배포는 수행하지 않았다.

검증 입장은 외부 운영 서버에 계정 정보를 보내지 않는 localhost 시험 서비스의 익명 메모리 데이터로 수행했다. 실제 전투·맵·AI·계정 기본 형식은 저장소 서비스 코드를 사용한다. 운영 서버 입장/계정 연동 재검증과 물리적 휴대전화의 장시간 발열 시험은 이번 결과에 포함하지 않는다. 원신 전체 물리·조명·식생의 정확한 일치율은 측정하지 않았으며, 테스트 성공이나 에셋 수를 일치율로 해석하지 않는다.

## 재현

`npm run unity:training:kernel`, `npm run test:rpg:local-training`, `npm run test:rpg:source-traversal`, `npm run test:rpg:mount`, `npm run test:rpg:unity-boss`, `npm run check:rpg`.

Windows 로컬 환경에서는 기존 설치된 tsx/TypeScript 경로를 사용했고 임시 경로를 G: 작업 폴더로 지정했다. 새 패키지 설치나 서버 배포는 하지 않았다. 형식 검증은 새 프로토콜·동시성 구조를 도입하지 않으므로 별도 모델 없이 기존 회귀와 실제 실행 검증을 사용했다.
