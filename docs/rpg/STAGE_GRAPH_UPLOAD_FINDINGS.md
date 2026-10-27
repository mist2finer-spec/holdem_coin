# 원본 맵 그래프 업로드 분석 — 2026-10-27

대상: vardian-map-graph-20261027-104034 (2).zip. 과거 감사 APK SHA와 일치한다. 운영 main은 a8f4f56이며 이번 변경은 복원 브랜치의 분석·도구만 포함한다.

## 확인 결과

- 씬 객체 116,487개, serialized file 134개, 맵 헬퍼 85개, 웨이브 484개, 몬스터 스폰 정의 3,637개, 트리거/리액터 6,002개를 읽었다.
- 이전 덤프의 동일 PathID 충돌을 이번 자료에서는 파일별로 분리할 수 있다. 웨이브의 스폰 참조와 Transform 계층, 원본 XYZ 변환 행렬, 활성/비활성 여부 및 두 트리거 분기를 보존했다.
- 원본 미궁 DB 6,000개 중 5,532개는 과거 map-assets 감사의 유일한 config 이름과 새 씬 그래프를 대조한 연결 **후보**다. 468개는 씬 이름 대조가 해결되지 않았다. 5,532개가 실행까지 복원되었다는 뜻이 아니다.
- 기존 MapHelper의 `_stageIdUpper`, `_stageIdLower`, `_mapEntityGroupId`는 에디터 미리보기다. 실제 StageData의 MapTheme/MapType/MapEntityGroupId로 선택해야 한다. 예를 들어 Map001_001 편집 설정은 31-1/그룹5다. 이것을 1-1의 배치로 오인하면 안 된다.

## 초반 미궁 DB와 config 이름 대조

| 구간 후보 | 맵 키 | 웨이브 정의 | 스폰 지점 정의 | 종류 |
|---|---|---:|---:|---|
| 1-1 | 1 / 101 | 2 | 19 | 소형19 |
| 1-2 | 1 / 102 | 3 | 21 | 소형18, 중형3 |
| 1-3 | 1 / 103 | 3 | 13 | 소형9, 중형3, 대형1 |
| 1-4 | 1 / 104 | 5 | 24 | 소형19, 중형4, 대형1 |
| 1-5 | 1 / 105 | 1 | 1 | 보스1 |

이는 원본 스폰 **정의 수**이며 화면에 동시에 등장하는 수 또는 최종 처치 목표로 고정하면 안 된다. 반복·메시지·플레이어 진입·컷신·활성 상태를 실행해야 최종 결과가 결정된다.

1-1의 두 웨이브는 OnStart(10), spawnDelay0, 비반복이다. 각각 스폰15개와4개를 참조한다. waveNo를 정렬해 '4마리 다음15마리'로 실행하는 것은 근거가 없다. 1-3/1-4에는 OnStart로 설정되어 있는데 `_waveReactorsToCheck1`에 값이 남아 있는 리액터도 있다. 선택되지 않은 Inspector 필드를 무조건 선행 처치 조건으로 취급하면 진행이 꼬인다.

1-5의 `MapEntityRoot/SpawnArea`에는 OnEnterArea(20)와 `_targetsToOn1`이 있고, 대상은 해당 씬의 PathID843 웨이브다. 이 웨이브 자체와 보스 스폰은 TriggerType0이다. 따라서 '일반몹을 다 죽이면 무조건 보스 생성'을 공통 규칙으로 둘 수 없다. 영역/활성화 메시지를 함께 복원해야 한다.

## 추출 도구 추가 수정

업로드 manifest의 오류85건은 전부 `PPtr object has no attribute assets_file`이다. 객체 JSON 추출 오류는 아니다. UnityPy의 container 값은 ObjectReader가 아닌 PPtr이므로 `deref()`한 대상 ObjectReader에서 파일과 PathID를 읽도록 수정했다. 실제 UnityPy PPtr 클래스로 smoke test가 통과했다. 새로운 추출에서 정상 container 경로가 생기면 복원 스크립트가 legacy 이름보다 우선 사용한다.

현재 자료에는 map-assets serialized file 자체가 포함되지 않아 config 참조85개가 외부 미해결로 남는다. 이전 감사 index로 유일한 이름은 보조 대조하되, 빠진 serialized-file을 있다고 취급하지 않는다. 재추출로 컨테이너 경로를 확보하면 씬 이름 연결을 보완할 수 있다. 기존 자료를 버릴 필요는 없다.

## 코드·검증·다음 연결

- `scripts/rpg/restore_map_graph.py`: ZIP을 압축 해제 없이 읽고 자격화된 객체/외부 참조를 연결한다. 좌표는 회전·스케일까지 포함한 부모 행렬을 합성한다. 빈 참조는 스폰 개수에서 분리한다. 웨이브·트리거·액션 대상 연결과 미해결 원인을 JSON으로 내보낸다.
- `scripts/rpg/test_reference_map_graph.py`: 파일별 동일 PathID, 중복 외부 파일 거부, 회전/스케일/위치 합성, 비활성 부모, 순환 계층 차단, 미사용 Inspector 필드 보존, 액션 대상 연결, ZIP 경로 보호 테스트.
- reference 테스트 144개 통과. Windows 실제 원본 번들 전체 재실행을 이 환경에서 했다는 뜻은 아니다.
- 런타임 교체에는 현재 일곱 고정 슬롯 대신 유한 스폰 개체 목록, native 트리거 메시지/활성화, 그룹별 종료, 지역 진입과 벨트스크롤 좌표 투영이 필요하다. 이 부분을 구현하기 전에는 새 JSON을 운영 encounterLayout으로 켜지 않는다.

실행 예:

```sh
python scripts/rpg/restore_map_graph.py --graph-zip INPUT.zip --legacy-audit LEGACY_AUDIT --stages DECODED/stages.jsonl --output NEW_OUTPUT
python -m unittest discover -s scripts/rpg -p 'test_reference*.py'
```

자세한 수치 및 초반 보스 연결은 `stage-graph-upload-audit.json`에 기록했다. 전체 원본에서 파생한 scene-graphs/stage-candidates는 별도 비공개 분석 산출물로 보존한다.
