# 보스 접촉 판정과 분리된 디오라마 미리보기 — 2026-11-07

기존 안정화 흐름과 서버를 유지한다. 시작 시 실제 전투 프로젝트는 Unity 6000.0.62f1 / Built-in이었다. 별도 PreviewProject에서 URP 17.0.4와 같은 구도의 재질 비교를 검증한 뒤, 사용자가 **“수정 Nilo 기준 승인”**을 선택했다. 약한 Bloom의 비용을 확인하고 승인된 룩을 본 전투에도 통합했다. 사용자 선택에 따라 Unity CLI beta.16을 유지했다. 사용자는 이번 Android 실기 검증을 Unity 테스트로 대체하고, 배포 APK를 직접 기기에서 확인하기로 했다.

## 전투 구현

- 서버 이동, 점프·슬라이드·구르기에 보스 몸체 반경 140 + 플레이어 반경 22의 비관통 제약을 적용했다. 초기 겹침은 경계·나무를 고려한 최대 65개 후보 검사로 보정한다. 표시 이동에도 같은 반경을 적용한다.
- 원본 GLB/본/클립/높이/이동 좌표를 변경하지 않았다. 원본 훅 클립 1.63초를 기존 공격 시간 2.2초에 매핑한다. 동일한 접지 처리를 거쳐 197개 포즈의 팔·손 위치를 추출했다. 손 부피를 맞추는 BakeMesh는 에디터 추출 과정에서 한 번만 사용한다.
- 오른팔 phase 0.18–0.40, 왼팔 0.64–0.84에서 실제 팔 캡슐/손 구와 플레이어 Hurtbox 캡슐의 3D 접촉을 검사한다. 서버 20ms 스텝 안에서 제한된 보간 샘플을 검사하며, 각 타격은 한 번만 피해를 준다. 회피·피격 무적과 pause를 유지한다.
- `attackId`, `strike`, `contactAt`, `contactRevision`, 접촉 위치를 피해와 훅 이벤트에 함께 넣는다. 투척 경고·폭발·피해도 같은 공격 ID와 예정 접촉 시간을 사용한다.
- 디버그 검증 후 훅 피격 Flash·짧은 원본 생성 효과음·카메라 오프셋을 연결했다. 공유 재질은 변경하지 않고 MaterialPropertyBlock을 복원한다. 기존 카메라 제어기에만 오프셋을 합성한다. `Time.timeScale`은 1을 유지한다.
- 원본 거인의 주먹 하단이 일부 구간에서 서 있는 플레이어보다 높다. 따라서 머리 위로 지나가는 훅은 피해를 주지 않는다. 실제 점프 입력으로 접촉하여 피해를 받는 경우를 별도로 검증했다. 피해를 강제하기 위해 Hurtbox나 팔을 늘리지 않았다.

소스와 도구: [전투 delta](client-source-snapshot/2026-11-07-contact/README.md).

## 확인 결과

- **PASS — 서버:** 보스·route·접촉 테스트 33개. 유효 구간, 높이/방향, 실제 점프, 무적, pause, 중복 피해, 몸체 이동, 경계 겹침, 투척 ID/시간 포함. RPG 타입 검사 통과. 확장 RPG 135개, stage sync 8개, 포커 245개 및 20핸드 시뮬레이션도 통과. Windows에서는 POSIX 환경변수/실행기 명령만 동등한 환경으로 치환했다. stage 생성물의 코드 해시는 일치하지만 node_modules junction의 메타데이터 경로 차이로 로컬 생성물 check는 실패했으므로 Linux CI의 표준 명령도 최종 PASS로 확인했다.
- **PASS — Unity:** 실제 뼈/추출 곡선 164개 대조, 최대 위치 차이 0.00000123m. 최종 Play Mode 몸체 접근 2,295프레임, 최소 간격 162.20, 관통 0, 오류 0.
- **PASS — 피격 연출:** 이벤트 중복 소비 방지, 공격 ID/시간 일치, Flash 복원, 공유 재질 사용자 격리, 카메라 오프셋 범위, AudioSource/Listener 연결 검증. 소리의 최종 체감은 사용자 기기 확인 대상이다.
- **PASS — 원본 보존:** 실제 프로젝트와 미리보기의 GLB/애니메이션 파일 33개 해시 일치.

같은 seed 111, 모사 RTT 150ms, 1080×2340 Editor에서 25초 준비 후 60초를 기록했다. 이전 안정화 작업과 같은 추가 전투 카메라 RenderTexture 진단을 사용했다. 아래 GPU 값은 Editor 진단이며 Android GPU 성능이 아니다.

| 항목 | 변경 전 | 변경 후 |
| --- | ---: | ---: |
| 프레임 p95 | 19.02 ms | 19.04 ms |
| 프레임 p99 | 20.47 ms | 20.10 ms |
| CPU active 평균 / p95 | 1.58 / 4.06 ms | 1.69 / 4.10 ms |
| GPU 진단 평균 / p95 | 0.181 / 0.157 ms | 0.230 / 0.158 ms |
| GC 평균 | 23,742 B/frame | 17,843 B/frame |
| 33.3ms 초과 / 50ms 초과 | 3 / 0 | 1 / 0 |
| 이동 중 진단 draw / SetPass 평균 | 311.4 / 248.6 | 345.9 / 270.3 |
| 고정 카메라 draw / SetPass | 138 / 131 | 138 / 131 |
| 고정 화면 Editor used / reserved | 690.8 / 1025.9 MB | 652.7 / 984.0 MB |

몸체 제약으로 실제 이동 경로와 노출 지형이 달라져 이동 중 draw 평균은 늘었다. 같은 위치·카메라·모델의 별도 대조에서는 draw/SetPass가 같았다. 고정 화면 메모리는 Editor 전체 할당이며 캐시·GC·실행 순서의 영향을 받으므로 메모리 절감 성과로 해석하지 않는다. 정지 화면만으로 전투 성능 완료를 주장하지 않는다.

## 미리보기와 승인 경계

[별도 디오라마 미리보기](diorama-preview-20261107/README.md)에 세 장면, 두 셰이더 후보, 조명·Volume 프리셋, 역할별 재질·별도 마스크, Undo/복원 설정 도구를 보관했다. 강한 셀 경계와 외곽선은 기본값으로 쓰지 않는다. 원본 텍스처는 보존하고 지형 보정본은 별도로 생성한다.

첫 비교는 같은 카메라·포즈에서 원본 재질 / URP Lit / 수정 Nilo를 촬영했다. Bloom·DOF·Rim·외곽선·Shake는 꺼져 있다. 결과는 3D 디오라마이며 캐릭터 도트화는 구현하지 않았다. 이 비교 이후 사용자가 **수정 Nilo 기준을 승인**했다. 승인 후 Bloom 0.10 / threshold 1.15만 추가했고 DOF·Vignette·Rim·외곽선은 기본 OFF다. 본 전투는 검증된 URP 17.0.4로 전환했다. 전역 카메라·조명·지형을 새로 만드는 방식은 사용하지 않았다.

### 미리보기 Editor 비용

1080×1920, 각 장면 5초 준비 + 10초 이동 측정. 후처리 OFF, 자동 품질 하락 0, 오류 0. GPU는 Editor 진단값이며 Android 실기 측정이 아니다. 전체 p99·CPU/GPU·GC·draw/SetPass·메모리는 [측정 JSON](diorama-preview-20261107/Evidence/preview-cost.json)에 있다.

| 장면 | 원본 p95 | URP Lit p95 | 수정 Nilo p95 |
| --- | ---: | ---: | ---: |
| ForestSide | 19.16 ms | 17.88 ms | 17.93 ms |
| BossQuarter | 17.92 ms | 17.83 ms | 17.93 ms |
| DarkArea | 18.48 ms | 17.85 ms | 17.81 ms |

원본과 URP 비교에는 조명·재질·지형 팔레트·배경 렌더링 차이가 포함되므로 이를 셰이더만의 비용 차이로 해석하지 않는다. Lit/Nilo는 같은 URP 무대와 모델을 사용한다. 짧은 이동 영상은 화면 검토용 저빈도 캡처이며 FPS 측정 영상이 아니다.

## 승인된 본 전투 통합

- `BattleDioramaLook`는 기존 전투 카메라·조명 2개·지형 1개에만 재질/조명 설정을 적용한다. 전투 카메라 제어기는 1개이며 앱의 기존 배경 카메라·비활성 스킬 트리 카메라는 별개다. 후처리 Volume은 1개다.
- 새 캐릭터와 스트리밍 배경 생성 시에만 재질을 변환하고 캐시한다. 배경 제거 시 렌더러 참조를 해제한다. 프레임마다 전체 계층을 검색하지 않는다. 재입장 3회 모두 같은 룩 컴포넌트를 재사용하고 Volume 중복 없이 검증했다.
- 경고·폭발 재질의 색/투명도 변화는 원래 시간 기준을 그대로 유지한다. 기존 가림 제어기에 주먹과 경고 영역 보호를 추가했다. 물은 원본 Deep/Shallow 색을 보존한 저비용 투명 재질이며 Built-in GrabPass/테셀레이션은 이식하지 않았다.
- 재질과 Volume 컴포넌트는 개별 복제한다. Flash 복원/격리, 효과별 스위치, 품질 하락 시 Bloom·DOF·Vignette 우선 해제, 원본 Volume 미변경을 검증했다.
- 원본 지형의 16,641개 높이 값과 크기, 6개 detail prototype을 보존했다. 원본 모델/애니메이션 33개 해시도 일치한다.
- `Island > Diorama > Apply approved Nilo battle look`는 기존 설정 에셋을 재사용하고 Undo를 지원한다. `Restore pipeline before approved integration`은 Graphics/6개 Quality 파이프라인을 복원한다. 원본 재질은 덮어쓰지 않았다.

최종 URP 접촉 재생: 2,034프레임 몸체 접근, 최소 간격 162.20, 관통 0, 오류 0. 같은 클립/뼈의 164개 표본 최대 오차 0.00000123m. Nilo 재질에서도 Flash 복원·격리·중복 이벤트 방지·사운드 연결·카메라 오프셋 검증 PASS. 소리의 실제 체감은 사용자 기기 확인 대상이다.

### 본 전투 비용

아래는 같은 60초 입력 시나리오, seed 111, 모사 RTT 150ms, 1080×2340 Editor의 결과다. 추가 진단 렌더는 동일한 1080×1170 타깃이며 Built-in은 Camera.Render, URP는 SingleCameraRequest를 사용한다. 따라서 렌더 파이프라인별 draw 집계 차이도 포함된다.

| 항목 | 접촉 수정 후 Built-in | 승인 Nilo + Bloom |
| --- | ---: | ---: |
| 프레임 p95 / p99 | 19.04 / 20.10 ms | 18.93 / 20.47 ms |
| CPU active 평균 / p95 | 1.69 / 4.10 ms | 1.25 / 3.50 ms |
| GPU 진단 평균 / p95 | 0.230 / 0.158 ms | 0.270 / 0.163 ms |
| GC 평균 | 17,843 B/frame | 20,709 B/frame |
| draw / SetPass 평균 | 345.9 / 270.3 | 428.5 / 49.5 |
| 33.3ms 초과 / 50ms 초과 | 1 / 0 | 2 / 0 |

SetPass는 감소했지만 draw와 GC는 증가했다. 이를 전 항목 성능 개선으로 보고하지 않는다. 기존 프레임 안정성은 이 Unity 구간에서 유지됐고, Android GPU/발열/장시간 메모리는 실기 확인이 남아 있다. 같은 구도·카메라 대조에서는 draw 122→223, SetPass 106→29였다. Editor used 메모리는 785.3→784.5MB, reserved는 1212.3MB로 같았다. 그림자·후처리 패스와 가림 처리 차이가 포함되며 메모리 절감으로 주장하지 않는다. [고정 구도 결과](client-source-snapshot/2026-11-07-contact/Evidence/fixed-diorama.json)를 참조한다.

## 빌드·배포

최종 전투 APK: `IslandGame-Boss-Contact-Diorama-20261107.apk`, `0.1.0-test.20261107.3` / `2026110703`, 기존 `com.mist2finer.islandgame.dev` 패키지. 별도 미리보기: `Island-Diorama-Preview-20261107.apk`, `0.1.0-preview.20261107.2`, `com.mist2finer.islandgame.diorama.preview`. 둘 다 ARM64 IL2CPP. 최종 서명·해시·배포 상태는 아래 배포 확인에 기록한다.

## 후속 작업도 유지할 흐름

1. 현재 서버/전투 기준과 원본 자산을 확인하고 파일별 백업을 남긴다.
2. 판정·이동·입력 문제를 먼저 고치고 공격 ID/시간을 디버그로 대조한다.
3. 연출은 기존 제어기에 합성하고 별도 룩 씬에서 검증한다.
4. 같은 구도/시드/입력의 CPU·GPU 진단·p95/p99·GC·draw/SetPass·메모리를 함께 비교한다.
5. 재입장·복원·품질 토글을 검사한 뒤 main/서버/API/Unity 연결과 APK를 검증한다.
6. 사용자 실기 피드백을 다음 수정의 근거로 삼는다. Editor 결과를 실기 결과로 바꾸어 표기하지 않는다.

전투 APK 검증: PASS, 106,934,784 bytes, SHA-256 `eb2240c862aa22e451ffa5f0bfd68f7d950e5057289252f9d09bf033dcbe0236`.

미리보기 APK 검증: PASS, 106,934,275 bytes, SHA-256 `d2854a67eab37f5256633b1722c210fd25a72a614660a32439f04dd3f78bb372`.

## 배포 확인

- main 소스: [`611190d`](https://github.com/mist2finer-spec/holdem_coin/commit/611190d36350022f099d3d0d0694e13f2bbff001).
- Render Testplace / holdem-coin-tavern: `dep-dbnm9pp42hec73cjngr0` **LIVE**. `/healthz` 200, `/api/release` 리비전 일치.
- [GitHub CI](https://github.com/mist2finer-spec/holdem_coin/actions/runs/42398285444) **PASS**. 포커·RPG·Unity boss·stage 생성물·서버 smoke 포함.
- 운영 API **PASS**: 144회 요청, 접촉 리비전 `boss-contact-v1`, 입력 ACK, 공격 ID/시간 일치, 경고→폭발 2초, 넉다운→기상, tick 쿠키 재저장 0. 별도 훈련 세션으로 영구 보상 없음.
- [최종 APK 2개와 비교 화면·영상·검증 자료](https://github.com/mist2finer-spec/holdem_coin/releases/tag/unity-boss-contact-diorama-20261107.3). 두 APK의 ZIP·서명·16KB 정렬·패키지·ARM64 IL2CPP 검증 PASS.
- 실제 Unity 운영 연결 **PASS**: 152개 스냅샷, 순서 역행 0, 오류 0, 접촉 리비전 및 승인 Nilo 활성 확인.
