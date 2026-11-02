# Unity 10보스 시험장

작업 브랜치: `feat/unity-ten-boss-test`. 웹 운영 코드와 배포 설정은 변경하지 않는다.
사용자가 제공한 `boss_fight_10boss_specs.pdf`의 기획을 현재 좌우 이동 전투에 맞게 구현한 **로컬 시험 전투**다. 바르디안 원본 보스 AI 전체를 추출한 결과가 아니다.

## 진입과 화면 전환

`던전 → 보스 시험 10종 선택 → 준비 → 전투 → 승리/패배 → 재도전 또는 선택창 → 로비`.

- 기존 `IslandApp.OpenBossTrials()`는 온라인 소켓과 RPG 세션을 정리하고 기존 전투 출력을 비운 뒤 진입한다.
- 서버 상태는 무기 외형을 고르는 읽기 전용 복사본으로만 참조한다. 실제 장비·젬·노드·성장 스탯을 새 시험 계산에 적용하지 않는다.
- 기존 씬에서 `BossTrialController.ShowMenu()`를 호출하면 안전한 IslandApp 진입으로 연결한다. 연결이 병합되지 않은 온라인 호스트에는 진입을 거부한다.
- 독립 시험: `Island > Boss Trial Test (new unsaved scene)`에서 새 미저장 씬을 만들고 Play. 기존 수정 씬의 저장/취소 선택을 존중한다.
- 시험 전투는 계정 경험치·아이템·지갑·드랍을 변경하지 않는다. PDF 드랍표도 지급하지 않는다.

## 구성

| 파일 | 역할 |
|---|---|
| `Runtime/BossTrials/BossTrialModel.cs` | Unity에 의존하지 않는 고정 60Hz 전투·쿨다운·판정·페이즈 |
| `Runtime/BossTrials/BossTrialController.cs` | 선택·전환·입력·결과·일시정지 UI |
| `Runtime/BossTrials/BossTrialRenderer.cs` | 원본 맵 메시와 Spine 배우, 판정 데이터 기반 예고 출력 |
| `Resources/BossTrials/bosses.json` | 10보스와 49패턴 정의 |
| `Resources/BossTrials/map-contract.json` | 원본 좌표·카메라·시험장·바닥과 에셋 대응 |
| `Editor/BossTrialTestMenu.cs` | 기존 씬을 덮어쓰지 않는 시험 진입 |

## 보스와 기존 에셋 대응

기획의 용·기계 외형을 새로 생성하지 않고 보유한 원본 Spine을 시험 대역으로 쓴다. 선택창에도 대역을 표시한다.

| ID | 보스 | HP | 기존 대역 |
|---|---|---:|---|
|B01|잿빛 비룡 파이로스|1,800|박쥐 우두머리|
|B02|부패의 군주 모르산|1,400|해골 마법사 우두머리|
|B03|화강암 수호자|3,200|대지 정령|
|B04|폭풍의 무희 실피드|950|물 정령|
|B05|그림자 엮는 자 벡스타라|1,100|스닉스 우두머리|
|B06|센티넬 프라임 AXIOM-9|2,400|고블린 전사 우두머리|
|B07|무리 여왕 니드라|1,600|거미 우두머리|
|B08|레이비저 드론 군집|800 합계|마법 박쥐 5개체, 각160HP|
|B09|디지털 마인드 VIRUS-7|1,500|푸른 슬라임 우두머리|
|B10|종말 프레임 TITAN-X|4,500|노하즈 우두머리|

보스별 화염탄·장판·소환·돌진·충격파·연쇄 공격·분신·레이저·알 부화·반쪽 전장 공격 등을 카탈로그에서 선택한다. 준비→활성→복귀와 개별 재사용 대기를 분리한다. B08은 5개 본체를 모두 처치해야 승리한다. 소환수는 최대6개로 제한하고 처치/복귀 시 정리한다.

PDF와 달라진 명시적 시험 규칙:

- B03의 혼재된 66%/50% 문구는 **50%**를 채택한다. B08은 **잔여 2기 이하**에서 2페이즈다.
- B01의 부위 파괴는 별도 부위 충돌체 대신 일반 타격8회로 꼬리 봉쇄, 냉기3회로 착지시키는 근사다.
- B04는 회피50%→70%와 냉기 억제, HP1 분신2기. B05 분신은 최대1기이고 암전 중에도 표식을 유지한다.
- B06은 방어막HP180을 파괴하면8초 무력화. B07 알은HP60이며4초 뒤 부화하고 살아 있는 알·소환수를 합쳐6기로 제한한다.
- B09는 직전 패턴 반복을 금지하고 최근 행동을 낮은/상단 띠로 모방한다. 4페이즈는 열린 패턴 풀을 사용하며 과거 페이즈 전체를 재생하지 않는다.
- B10은 형태 전환3초 무적 후2초 피해1.5배. 종말포는 전장 정확히 절반만 공격한다. 보스를 안전측 먼 가장자리로 옮기고 이전 공격을 지워, 일반 이동만으로도 안전 구역에 도착할 통로를 보장한다.
- 60초 과부하의 피할 수 없는 전멸은 경고3.2초의 반쪽 포격으로 바꿨다. 원문 아이템·면역 전체·실제 변신 모델을 완성한 정식 모드는 아니다.

## 전투 판정과 조작

- 좌우 이동 A/D 또는 방향키, 공격 Space/K, 점프 J/W/위, 슬라이드 S/아래/Shift, 회피 Q/E, 시험 서리 기술1. 화면 터치 버튼도 제공한다.
- 시험 홍은 HP360, 일반 공격62, 세 번째 공격84의 독립 시험값이다. 서리 기술은 계정에 장착된 액티브를 뜻하지 않는다.
- 낮은 투사체·충격파는 점프, 높은 공격은 슬라이드, 수직 장판은 좌우 이동으로 피한다. 슬라이드는 하단 공격에 면역이 아니다.
- 노란 예고와 실제 피격은 같은 `TrialHazard`의 범위/높이/시간을 이용한다. 예고 중에는 피해를 주지 않는다. 빠른 투사체는 이전 위치까지 포함해 검사한다.
- 일반 이동은 적 몸을 통과하지 않는다. 회피는 작은 적 최대3개와 빈 착지를 확인하며, 큰 보스·4개 이상·막힌 착지에서는 제자리 회피한다.
- 최장 상단 빔을 피할 수 있도록 슬라이드 자세1.65초, 쿨다운2.1초로 조정했다. 이는 원작 수치 복원이 아닌 시험 조정이다.

## 원본 맵과 카메라

원본 `Map002_001`의 33개 geometry,108개 renderer,14개 material,14개 texture를 재조립한다. 진행축은 **Z**, 높이는 **Y**, 배우 깊이는 **X=-4**, 바닥은 약 **Y=10**이다. 웹의 픽셀 좌표나 `/100` 환산을 섞지 않는다. static-batch 메시의 월드 정점에 인스턴스 행렬을 다시 곱하지 않는다.

- 기본 시험장은 원본 서쪽 회랑 Z[-61,-37], 플레이어-56, 보스-42이다.
- 원본 카메라 검사 모드는 원본 위치·회전·물리 렌즈를 적용하고 전투를 일시정지한다.
- 전투 모드는 원본 회전/FOV36도를 유지하되 카메라 X를4m 뒤로, Z를 시험장 중앙으로 옮기고 렌즈 이동을0으로 한다. 출력1152×648의16:9로 전장 폭을 확보한다.
- 배우까지 약24m 거리에서 수평 시야는 약27.7m이다. 런타임에서24m 경기장과 여유 폭을 담는지 검사한다. Spine 발 슬롯은 바닥에 맞추며 슬라이드 표시 높이도 판정0.72m에 맞춘다.
- 바닥40개 삼각형은 원본 시각 메시에서 시험용 이동 스트립을 파생한 것이다. 원작 Collider/Navigation/전체 CameraFollow 복원과 구분한다.
- 셰이더는 원본 UV/텍스처를 쓰는 간이 어댑터다. 원작 HDR 조명·라이트맵 출력·촛불 파티클·미해결 후처리2종의 시각 동일성은 완료하지 않았다.

자세한 수치와 출처: [BOSS_ASSET_COORDINATES.md](BOSS_ASSET_COORDINATES.md).
외부 프레임워크 검토 및 PDF 모순 처리: [BOSS_FRAMEWORK_REFERENCE.md](BOSS_FRAMEWORK_REFERENCE.md).

## 검증 결과와 경계

이번 환경에서 실제 실행한 검사:

- 전투 모델 C# 실행: **48,118개 assertion 통과**,10보스/49패턴 데이터, 예고 무피해, 공격 타이밍, 점프/슬라이드, 충돌/회피 착지, 돌진 후 기절, 소환 제한·알 파괴, 페이즈·승리·정리. 반복 고정 스텝 검사도 포함하므로 독립 테스트48,118개라는 뜻은 아니다.
- 기존 Unity 계약 및 이름 helper C# 실행:58개 통과.
- 이름 매핑:2,671개 검사 통과. 원본 PDF179정의, 액티브35/보조30, 실제206개 노드 및49주얼 대응.
- 맵 데이터 Python14테스트, 별도 임시 프로젝트 PowerShell 설치3테스트 통과.
- 자산249개 해시와 JSON 참조/원본 메시·UV·카메라/10개 대역 연결 확인.
- C# 문법20파일 및 PowerShell 문법 검사 통과. **Unity 의미 분석 컴파일 성공을 뜻하지 않는다.**

일반 재현 테스트와 고정 스텝 모델로 변경 범위를 검사할 수 있고 온라인 정산/저장 프로토콜을 바꾸지 않으므로 AGENTS.md에 따라 형식 검증은 생략했다.

**Unity Editor는 이 환경에 없어 실행하지 않았다.** Spine 임포트, URP 셰이더, 실제 카메라 화면, 터치 조작,10보스 Play Mode 승패, 기존 로컬 uGUI 병합은 로컬 연결 에이전트가 확인해야 한다. CPU 시뮬레이션 통과를 실제 플레이 확인으로 보고하지 않는다.

재실행 명령(.NET8/Python/PowerShell/Node 의존성 필요):

```powershell
dotnet run --project scripts/unity/boss-trial-checks/BossTrialChecks.csproj
python scripts/unity/boss-trial-checks/run_checks.py --dotnet-root /path/to/dotnet-sdk
dotnet run --project scripts/unity/contracts/Contracts.csproj
python -m unittest discover -s scripts/unity -p test_map_contract.py -v
python -m unittest discover -s scripts/unity -p test_install_boss_trials.py -v
node --import ./mini-services/poker-server/node_modules/tsx/dist/loader.mjs scripts/unity/validate_names.mjs
python scripts/unity/check_csharp.py
python scripts/unity/prepare_assets.py --no-checkout --skip-catalog
python scripts/unity/validate_export.py
```

준비 스크립트는 별도 소스 체크아웃에서 실행하고, 현재 프로젝트에는 `install_boss_trials.ps1`로 추가 파일만 옮긴다. 변경된 기존 파일은 `.island-incoming`에 수동 병합 후보로 두며 로컬uGUI와 GUID를 덮어쓰지 않는다. 설치 보고만으로 Editor 검증 완료라고 판단하지 않는다.

오프라인 C# runner는 .NET8 SDK의 Roslyn과 SDK 동봉 Newtonsoft.Json을 사용한다. 이번 실제 실행은 SDK8.0.427/런타임8.0.33이며, SDK Newtonsoft.Json의 참조 런타임 차이에 관한 CS1701 경고가 있었지만 실행 검사는 통과했다.

로컬 Unity 에이전트용 전체 지시: [BOSS_TRIAL_AGENT_PROMPT_KO.md](BOSS_TRIAL_AGENT_PROMPT_KO.md).
