# 스테이지 진행·몬스터 배치 재검토

2026-10-27. 기존 운영 버전 `a8f4f56` 이후 조사. 운영 배치를 원본이라고 잘못 설명하지 않는다.

## 결론

현재 `HuntEngine.loadStage()`는 일반 몬스터 정의를 6개 슬롯에 순환 배치하고, 일반 슬롯이 모두 죽으면 7번째 슬롯의 보스를 활성화한다. `compile_labyrinth_runtime.py`도 `WEB_ADAPTER_6_NORMAL_THEN_FINAL_BOSS`라고 기록한다. 이는 예전 프로토타입 규칙이며 원본 복원 결과가 아니다. 화면에 4마리만 보이더라도 내부 규칙은 고정 6+1이다.

원본 StageData.MonsterDatas는 **몬스터 종류/능력치/스킬을 조회하는 정의 목록**이다. 항목 수를 생성 마릿수로 쓰거나 순서를 웨이브 순서로 쓰면 틀린다. 소형·중형·특수·중간보스·보스 같은 `monsterInfoName`을 맵 스폰 리액터와 해시로 연결해야 한다.

예: 스테이지 101~105는 몬스터 정의 목록을 공유하지만 MapType은 각각 101~105다. 201은 MapType101을 재사용하면서 몬스터 종류/성장 수치가 달라진다. 따라서 챕터·구간 번호만 보고 동일한 일반몹 수와 보스 등장 순서를 만들 수 없다.

## 원본 호출 흐름

1. 맵 시작, 영역 진입, 선행 웨이브/스폰 종료 등의 트리거가 리액터로 메시지를 보낸다.
2. `MapEntityReactorWave.OnReceiveMessage(3)`은 웨이브를 한 번 시작하고 spawnDelay를 설정한다.
3. `OnAdvance`가 spawnDelay/repeatInterval/repeatCount를 처리한다. 같은 프레임에 누적 횟수를 while로 몰아서 생성하지 않는다.
4. `_spawnReactors`의 각 스폰 지점에 waveNo를 전달한다. 스폰은 해당 좌표와 monsterInfoName을 사용한다.
5. 종료 판정은 이 웨이브 그룹에 속한 실제 생성 개체가 모두 죽었는지를 확인한다.
6. 다음 웨이브/문/보스/목표는 별도의 연결 트리거로 진행한다. '일반 4마리/6마리 처치' 자체는 공통 보스 등장 조건이 아니다.
7. 스테이지 승리는 KillAllMonsters/KillNMonsters/KillBoss/ReachEndPoint/CompleteObjects/StateOnObjects/KillNMonstersWithNPC 등 StageData의 조건을 따른다.

`repeatCount=0`인 반복 웨이브는 무제한 반복 분기다. 반복이 꺼진 경우 1회 생성이다. 지연 시간이 한 프레임에 0 아래로 내려가면 먼저 0으로 보정하고 다음 업데이트에서 생성한다.

## 현재 자료에서 확인되는 범위

잔존 맵 덤프는 128개 웨이브 후보와 995개 스폰 후보를 포함한다. 웨이브별 스폰 리액터 수는 1~25개, 시작 트리거94개/웨이브 종료 트리거23개/영역 진입3개/없음8개, 반복 설정16개다. 이는 **남아 있는 덤프 전체의 집계**이며 특정 스테이지의 몬스터 수가 아니다. 스폰 리액터 수 역시 조건/반복을 적용하기 전이므로 총 처치 목표와 다르다.

기존 추출 파일명에는 serialized-file 구분이 없다. 같은 `(bundle,pathID)`가 서로 다른 씬에서 충돌한 조합이 5,498개다. 따라서 현재 덤프만으로 정확한 스테이지→웨이브→좌표 연결을 만들어 배포하지 않는다. `stage-layout-audit.json`에 재검토 근거와 범위를 기록했다.

## 이번 복원 코드

- `reference_stage_flow.py`: 원본 웨이브 타이머/반복/시작 메시지/그룹 종료 계약.
- `verify_stage_flow_native.py`: 실제 ARM64 OnAdvance를 실행해 2,304개 조건 비교. Spawn 및 그룹 사망 확인은 관측 콜백이며 맵 배치를 검증한 것이 아니다.
- `collect_map_graph.py`: bundle 직접 입력 또는 split APK 내부 map_scenes bundle 직접 추출. 씬별 serialized-file과 로컬 pathID, GameObject/Transform, 외부 참조를 함께 보존.
- 같은 serialized-file 이름이 여러 개여도 파일 객체별 번호를 붙여 분리하고 원래 이름을 따로 보존한다. 외부 참조를 pathID만으로 연결하지 않는다.
- `collect_map_graph.ps1`: 기존 PC 폴더에서 원본 bundle 또는 split_UnityDataAssetPack.apk를 찾는다. 여러 버전이면 과거 감사 APK SHA와 일치하는 파일을 우선 확인하며, 구분되지 않으면 자동으로 다른 버전을 고르지 않는다.

## 원본 배치 복원에 필요한 다음 입력

사용자 PC의 원본 `map_scenes*.bundle` 또는 `split_UnityDataAssetPack.apk`가 필요하다. ADB나 게임 실행/업데이트는 필요 없다. 기존 C:\Users\SHK\VardianRE 폴더에 보관된 파일로 재추출 가능하다.

PowerShell에서 실행:

```powershell
$tool = Join-Path $env:USERPROFILE 'Downloads\vardian-map-graph-tools'
New-Item -ItemType Directory -Path $tool -Force | Out-Null
$base = 'https://raw.githubusercontent.com/mist2finer-spec/holdem_coin/restore/rpg-stage-wave-graph/scripts/rpg'
foreach ($name in @('collect_map_graph.py', 'collect_map_graph.ps1')) {
    Invoke-WebRequest "$base/$name" -OutFile (Join-Path $tool $name)
}
powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $tool 'collect_map_graph.ps1')
```

바탕화면의 `vardian-map-graph-날짜.zip`을 제공하면 원본 맵 타입·스폰 위치·웨이브 조건·보스 트리거를 연결하고 웹 전투 진행을 교체할 수 있다. 출력 manifest의 오류/외부 참조/스키마 버전까지 확인한 뒤 연결한다. 원본 좌표의 웹 단위 변환은 별도 어댑터이며 생성 순서와 조건은 보존한다.

실행 코드가 새 자료 없이 고정 6+1을 다른 임의 마릿수로 바꾸지 않도록, 이번 브랜치는 조사/복원 도구만 담고 운영 main은 변경하지 않는다.

## Windows 추출 종료 오류 수정

UnityPy가 파일 경로로 연 입력을 계속 참조하여 TemporaryDirectory 삭제 시 WinError32가 발생한 사례를 수정했다. 수집기가 입력 스트림을 직접 열고 성공/실패 모두에서 닫도록 한다. 임시 폴더 정리 예외를 숨기지 않는다. JSON은 Windows 기본 코드페이지 대신 UTF-8로 저장한다. 열린 참조를 유지하는 UnityPy 모형과 Windows식 삭제 제한을 재현한 회귀 테스트를 포함해 reference 테스트 134개가 통과했다. 실제 Windows 전체 번들 재추출은 사용자 PC에서 확인해야 한다.
