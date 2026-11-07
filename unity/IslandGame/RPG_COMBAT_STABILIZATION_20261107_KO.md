# RPG 전투 렉 안정화 작업지시서

작성일: 2026-11-07 (America/New_York)
상태: 작업 지시·검증 계획. 성능 개선 구현 및 Android 실기 측정 완료를 뜻하지 않는다.
코드 검토 기준: `58d096cc5cc42840bff55d6027b0daaab11209e4`. 착수 시 최신 main과 실제 로컬 변경을 재확인한다.

## 1. 사용자 결정과 최우선 목표

사용자 원문: “이거를 holdemcoin 유니티쪽에서 작업지시서를 볼수있게 작성해놔. 서버는 우선 교체하진않을거임. Rpg쪽 안정화부터 하고 다음으로넘어갈거임. 그리고 안드로이드에서 측정어떻데하나 어떤앱을쓸지얼려줘”

- 전투 중 끊김, 입력 지연, 위치 튐을 우선 해결한다.
- 현재 서버와 호스팅을 유지한다. 서버 교체·서비스 분리·요금제 변경·인프라 이관은 이번 작업에 포함하지 않는다.
- 같은 서버에서 필요한 API/계약 개선은 제안할 수 있으나, 구현·배포는 루트 AGENTS.md와 해당 작업의 승인 범위에 따른다.
- RPG 안정화와 실기 검증을 완료한 후 노드·접사·유니크·새 콘텐츠 확장으로 넘어간다.
- 이번 문서 작성 요청은 전투 코드 구현이나 운영 배포 완료를 뜻하지 않는다.
- 작업 전 [루트 정책](../../AGENTS.md), [Unity 안내](AGENTS.md), 실제 로컬 프로젝트와 이후 수정 내역을 읽는다. 실제 프로젝트는 기존 인계 기준 G:/new_project/IslandGame이며 원격 최소 폴더·참고 스냅샷과 구분한다.

## 2. 현재 확인된 구조와 조사 대상

참고 소스 루트: [2026-11-06 Runtime](../../docs/unity/client-source-snapshot/2026-11-06/Runtime/).
아래는 검토 리비전의 코드 사실이며 실기 병목 순위를 확정한 결과가 아니다.

| 위치 | 확인 내용 | 조사·개선 방향 |
| --- | --- | --- |
| IslandApp.StartRpg | RPG 입장 시 홀덤 socket.Close() | RPG 중 홀덤 응답이 함께 오는지와 서버 자원 공유를 구분 |
| RpgSession.Pump | HTTP 응답 후 100ms 대기, 순차 명령·재시도 | RTT·응답 간격·명령 대기 시간을 기록. 요청 병렬화로 순서 계약을 깨지 말 것 |
| RpgSession.Pump | Set-Cookie 수신 시 PlayerPrefs.Save() | 쿠키 변경 시에만 갱신, 전투 중 반복 디스크 저장 제거 |
| RpgContracts.MergeSnapshot | 빌드·성좌·장비 정적 데이터 DeepClone | 버전별 불변 메타데이터 캐시와 동적 전투 상태 분리 |
| NativeCombatPresentation.ProjectHero | 프레임마다 hero 복제, 이동 예측 최대 150ms | 수신 데이터와 표시 상태 분리, 재사용 상태·입력 예측·보정 검토 |
| IslandBattleHud.Update | 매 프레임 Layout/ConfigureBattleOutput, 일부 텍스트 갱신은 이미 제한 | 배치 계산은 화면·Safe Area·패널 변경 때 실행. 기존 갱신 제한 중복 구현 금지 |
| Battle3DView / IslandFrameBudget | BindScenery(null), 별도 배경 LOD·그림자 정책 존재 | 실제 배경 관리 코드와 연결 확인. 자체 프레임 정책은 온도 센서 기반 Adaptive Performance와 다름 |
| RpgLocalStageSession | 로컬 worker 전투와 구역 정산 경로 존재 | 현재 보스 HTTP 전투와 다름. 플래그 변경만으로 보스 로컬화가 완료되지 않음 |

홀덤과 RPG는 서로 다른 프로세스지만 시작 스크립트상 하나의 호스팅 서비스 자원을 공유한다. 부하 실측 없이 홀덤 때문에 렉이 생긴다고 확정하지 않는다. render.yaml의 설정만으로 실제 배포 플랜을 단정하지 않는다.
보스 모션은 후속 수정이 존재하므로 예전 T포즈 진단을 현재 코드에 그대로 적용하지 않는다.

## 3. 실행 순서

### M0 — Android 기준 측정

고정 시드·같은 장비·같은 경로·같은 입력의 슬라임→다리→보스 구간을 준비한다. 먼저 헤드리스에서 시뮬레이션 함수별 시간을 측정하고, 실제 폰에서 CPU/GPU/GC/통신을 함께 측정한다.

- 기종, SoC, Android/One UI, 화면 주사율, 앱 버전·커밋·규칙 버전, 해상도, 그래픽 API를 기록한다.
- 동일 밝기·전원 모드·네트워크·충전 조건을 사용한다. USB 충전과 프로파일러 오버헤드도 기록한다.
- 준비 구간 후 60초 이상 전투를 3회 측정한다. 초기 로딩은 별도 기록한다.
- 10~15분 지속 플레이 후 같은 구간을 다시 측정한다. 최종 시험은 일반 사용처럼 쿨러 없이 실시한다.
- 프레임 p50/p95/p99/max, 33.3ms·50ms 초과 횟수, CPU Main/Render/GPU 시간, GC Alloc·GC 정지, 메모리를 기록한다.
- 통신은 RTT, 응답 수신 간격, 수신 상태 age, 명령 큐 대기, 응답 바이트, JSON 파싱·병합 시간을 기록한다.
- 서버는 가능하면 같은 요청 ID로 처리 시간·시뮬레이션 시간·이벤트 루프 지연을 관측한다. 서로 다른 시계의 타임스탬프를 단순 차감하지 않는다.
- CPU와 GPU 시간을 단순 합산하지 않는다. 지원되지 않는 GPU 수치는 0ms 성공이 아니라 UNAVAILABLE로 표시한다.
- 기본 측정은 Deep Profile OFF. 특정 함수 조사 때만 짧게 사용한다. 프로파일러를 끈 배포형 빌드에서도 재확인한다.

### M1 — 반복 저장·복사·HUD 비용 제거

1. 동일 쿠키의 재저장을 피하고, 변경된 값만 메모리에 반영한다. 영구 저장은 입장 완료·안전한 메뉴 전환·앱 pause 등으로 모은다. Android 종료 콜백에만 저장을 의존하지 않는다.
2. compiled/tree/equipment 등 메타데이터는 buildRevision·세션·규칙 버전이 바뀔 때 교체한다. 캐시를 공유할 때 읽기 전용 경계와 갱신 시점을 명시해 데이터 오염을 방지한다.
3. 프레임마다 JObject를 만드는 경로는 재사용 가능한 표시 상태로 바꾼다. JSON 포맷을 모두 바꾸는 대공사 전에 할당량이 큰 경로부터 줄인다.
4. HUD 배치·출력 설정은 변경 감지로 실행하고 텍스트·아이콘은 값이 바뀔 때 갱신한다. 입력 감지는 매 프레임 유지한다.
5. 정적 HUD와 체력·쿨다운·피해 숫자의 Canvas를 갱신 빈도에 맞춰 나눈다. Canvas 수 증가에 따른 배칭 비용도 비교한다.
6. 전후 같은 실기 구간으로 프레임 스파이크·GC·입력 지연을 비교한다. 단위 테스트만으로 성능 개선을 선언하지 않는다.

### M2 — 현재 서버를 유지하면서 전투 반응성 안정화

싱글 RPG 권고: 입력·이동·회피·공격·몬스터 AI·피격은 로컬 전투에서 진행하고, 현재 서버가 계정·장비 소유·입장·영구 정산을 확정한다. 기존 서버 주소와 호스팅을 유지한다.

- 보스전의 360도 입력·지형·AI·공격 타이밍·충돌·피격·자원 상태를 포함한 로컬 실행 설계를 먼저 작성한다.
- 기존 Jint worker의 과거 지연을 측정 없이 재사용하지 않는다. 작은 보스전 범위의 C# 코어를 기존 TS 결과와 대조하는 방안을 검토한다.
- unityBossPreview=false만 바꾸어 다른 전투 경로로 넘어간 것을 현재 보스전 로컬화로 보고하지 않는다.
- 시뮬레이션 고정 스텝과 화면 보간을 분리한다. 메인 스레드의 무제한 catch-up 루프를 방지하고 일시정지·백그라운드 복귀 정책을 명시한다.
- 보상은 서버 발급 입장·규칙 버전·빌드 고정 정보에 연결한다. operation/receipt 식별자로 중복 정산을 막고 재시도 후 같은 결과를 반환한다. 로컬 결과 제출만으로 완전한 부정행위 방지를 주장하지 않는다.
- 장비 교체·규칙 변경·서버 재시작·통신 끊김·구역 경계 ACK 대기 시 상태 보존 정책을 검증한다.
- 서버 판정을 유지할 구간은 입력 번호·ACK·예측/보정·적 보간을 설계한다. HTTP를 WebSocket으로 바꾸는 것만으로 완료하지 않는다.
- 네이티브 포팅 동치성은 루트 정책을 적용하며 보스 C# 전환에도 최소 10만 건 동일 시드·동일 입력 대조를 권고한다. 위험도에 따라 확대하고 불일치 0건을 확인한다.
- M1이 먼저 끝나야 한다. M2 전체 이관 전, 입력 즉시 반응·안전한 보정의 작은 수직 구현으로 효과를 확인한다.

### M3 — 실측 병목에 따른 화면 비용 절감

GPU 병목일 때 배경 그림자/거리 → 풀·나뭇잎 오버드로 → LOD/컬링 → 3D 해상도 순으로 비교한다. UI 해상도는 별도 유지한다. Built-in에서 사용 가능한 출력 해상도 경로를 먼저 검토한다. 초기 작업에 URP 전체 전환을 묶지 않는다.

- 플레이어·근접 보스·공격 예고·입력 반응을 우선 보존하고 원거리 배경·먼 적부터 줄인다.
- 배경 LOD·그림자 정책에 실제 대상이 연결되는지 확인한다. 무조건 모든 Renderer를 매 프레임 순회하지 않는다.
- 생성·파괴와 리패런팅은 프레임 캡처에서 비용이 확인된 경로를 풀링한다. 현재 풀링·PlayableGraph 구현을 중복 제작하지 않는다.
- ASTC/텍스처 크기/Mipmap/Read-Write는 기기 지원과 런타임 접근 필요를 확인해 설정한다. 필요한 mesh CPU 접근을 일괄 비활성화하지 않는다.
- 포즈 갱신 빈도를 낮춰 타격 시점·보스 예고가 끊겨 보이지 않도록 검증한다.
- 높은 프레임 유지가 불가능한 기기는 안정된 품질/프레임 모드를 별도 검토한다. 목표 60FPS 미달을 숨기는 방식으로 사용하지 않는다.

## 4. Android에서 사용할 도구

| 도구 | 설치 위치·용도 | 이번 작업에서의 순서 |
| --- | --- | --- |
| Unity Profiler | PC Unity Editor 내장. 실제 Android Player의 C#·GC·렌더 비용 확인 | 필수 1순위 |
| GPUWatch | 지원 Galaxy의 설정 > 개발자 옵션 > GPUWatch. 별도 앱 없이 FPS·GPU 관련 오버레이 | 휴대폰에서 빠른 확인 |
| Perfetto / 시스템 추적 | Android 개발자 옵션의 시스템 추적 또는 PC 브라우저 ui.perfetto.dev | Unity 밖의 스케줄링·긴 프레임 조사 |
| Android Performance Analyzer (APA) | PC 도구. 시스템/GPU 심화 분석, 지원 기기·버전 확인 | GPU/시스템 병목일 때 추가 |
| Unity Memory Profiler / Profile Analyzer | PC Unity 패키지, 스냅샷·전후 프레임 비교 | 메모리·회귀 비교 시 추가 |

FPS 오버레이만으로 GC·서버 RTT·입력 지연 원인을 알 수 없다. Android의 “화면 주사율 표시”는 게임 FPS 계측을 대신하지 않는다. AGI 등 기존 GPU 도구 자료를 참고할 수 있으나 현재 APA 공식 안내와 기기 지원 조건부터 확인한다.

### PC + USB 기본 절차

1. PC Unity Hub에 프로젝트와 맞는 Editor 및 Android Build Support/SDK/NDK/OpenJDK를 준비한다. 기존 Unity 6000.0.62f1 기준이며 실제 프로젝트 버전을 확인한다.
2. 폰 설정 > 휴대전화 정보 > 소프트웨어 정보 > 빌드번호를 7회 눌러 개발자 옵션을 열고 USB 디버깅을 켠다. 데이터 케이블로 연결하고 PC 디버깅 허용 창을 승인한다.
3. SDK platform-tools의 adb에서 `adb devices`로 `device` 상태를 확인한다. unauthorized이면 폰 승인, 목록이 없으면 케이블·드라이버를 확인한다.
4. Unity File > Build Profiles > Android에서 Development Build와 Autoconnect Profiler를 켠다. Deep Profiling Support와 Script Debugging은 기본 OFF로 둔다.
5. Build And Run으로 설치·실행한다. 기존 APK가 Development Build/프로파일링 가능한 설정인지 불명확하면 새 프로파일링 빌드를 만든다.
6. Window > Analysis > Profiler를 열고 연결 대상에서 Android Player를 선택한다. Editor/Play Mode 측정을 실제 폰 결과로 혼동하지 않는다. 자동 연결 실패 시 연결 목록의 Android/ADB 대상을 확인한다.
7. CPU Usage Timeline에서 끊긴 프레임의 PlayerLoop·스크립트·GC·렌더 대기를 조사하고 Memory/Rendering도 함께 기록한다. GPU 모듈은 그래픽 API·기기 지원에 따라 제한된다.
8. 전투 구간의 Profiler 캡처를 저장하고 전후 비교한다. Profiler 연결/녹화 없는 빌드의 결과도 남긴다.

GPUWatch가 있는 Galaxy는 개발자 옵션에서 활성화하고 FPS·CPU/GPU 관련 위젯 중 제공되는 항목을 선택한다. 메뉴·제공 지표는 기종과 One UI 버전에 따라 다르다. 메뉴가 없으면 지원을 단정하지 말고 Unity Profiler로 진행한다.
Perfetto는 짧은 보스전 구간을 기록해 PC의 trace viewer에서 연다. 네트워크 RTT는 별도의 앱 내 계측이 필요하며 UnityWebRequest가 Android Studio Network Inspector에 모두 표시된다고 가정하지 않는다.

## 5. 완료 조건과 제출물

아래 목표는 실기 기준을 합의하기 위한 초기 목표이며 현재 달성 수치가 아니다.

- 목표 기기 60FPS/16.7ms 예산을 기준으로 p95/p99와 초과 프레임을 보고한다. 로딩과 전투 구간은 분리한다.
- 전투 중 반복적인 50ms 이상 멈춤을 제거한다. 남은 단발성 초과는 원인과 횟수를 제출한다.
- 이동·회피의 시각적 시작은 1~2프레임 목표. 서버 확정 시점과 구분한다.
- RTT 50/150/300ms와 지터·짧은 손실을 모사해 이동 멈춤·위치 튐·명령 유실·중복 정산을 검사한다. RTT 수치를 편도 지연 설정과 혼동하지 않는다.
- 10~15분 발열 후 같은 구간을 비교하고 저하와 품질 조절 결과를 기록한다.
- 장비·성좌·주얼·스킬 연결·저장·재입장·일시정지·보상 회귀를 검증한다.
- 적용 범위에 맞춰 npm run check:rpg, test:rpg:unity-boss, test:rpg:stage, test:rpg:build, test:rpg:rogue 및 저장 관련 검사를 선택한다. 실행한 검사와 미실행 검사를 구분한다.
- Unity 컴파일·Play·Android 빌드·실기 재현은 각각 결과를 보고한다. PC Editor PASS로 Android PASS를 대신하지 않는다.

제출: 변경 파일/diff, 기준·개선 빌드 식별자, 동일 구간 Profiler 캡처, 프레임/통신 요약 CSV, 영상(녹화 부하 표기), 회귀 결과, 남은 문제.
프로파일 로그에 쿠키·계정 토큰·개인 식별자는 넣지 않는다.
RPG 안정화 게이트를 통과하고 사용자 플레이 확인을 받은 후 다음 콘텐츠 확장으로 진행한다.

## 6. 참고와 적용 주의

- [Unity Android profiling](https://docs.unity3d.com/6000.0/Documentation/Manual/android-profiling.html)
- [Unity PlayerPrefs.Save](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/PlayerPrefs.Save.html)
- [Unity UI 최적화](https://unity.com/how-to/unity-ui-optimization-tips)
- [Samsung GPUWatch](https://developer.samsung.com/galaxy-gamedev/gpuwatch.html)
- [Perfetto Android tracing](https://perfetto.dev/docs/quickstart/android-tracing)
- [Android Performance Analyzer](https://developer.android.com/android-performance-analyzer)
- 사용자 제공 영상 요약: [1편](https://www.youtube.com/watch?v=1mJtoceqvro), [2편](https://www.youtube.com/watch?v=RLcSRuZsZQU). 자막·시간대 전체를 이번 문서 작성에서 재검증한 것은 아니다.

고정 콘텐츠는 ScriptableObject/사전 빌드 데이터가 적합하지만 동적 전투 JSON은 데이터 구조·캐시 문제로 다룬다. Android에는 zRAM이 있으며 “모바일은 스왑이 전혀 없다”로 단정하지 않는다. URP·Generic 리그의 성능 이득은 프로젝트별 측정으로 판단한다. 본 계층을 임의로 평탄화하거나 sharedMaterial로 모든 개별 상태를 공유하지 않는다. 코루틴 대기 객체의 공유도 종류와 동시 사용 의미를 확인한다.
