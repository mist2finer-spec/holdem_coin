# 성좌 노드 겹침 및 무궁한 주얼 밀집 수정 — 2026-11-05

사용자 요청: 중간 레이어 병목·겹침 제거. EmmittJ/PoESkillTree 및 PathOfBuildingCommunity/PathOfBuilding 참조. 속성 변환 노드는 일정 반경에서 최대 8개로 제한하며 세부 수치는 조정 허용.

## 적용 경계

- 실제 수정 프로젝트: `G:/new_project/IslandGame`. Git 저장소가 아니므로 기존 변경을 유지하고 `.island-backups/node-spacing-20261105/`에 덮어쓰기 전 파일을 백업했습니다.
- GitHub 작업 브랜치: `fix/unity-tree-spacing-20261105`. 이전 문서 브랜치 c2db8f7 위의 후속 작업이며 main/운영 배포를 변경하지 않습니다.
- **Unity 표시 배치는 로컬 적용 완료입니다. 서버의 실제 8개 변환 제한은 이 브랜치 소스에 구현·검증했으며, 운영 서버에는 아직 배포하지 않았습니다.** 현재 운영 서버와 연결하면 변환 결과는 여전히 운영 서버 응답을 따릅니다. 클라이언트가 임의로 효과를 잘라내지 않습니다.
- 원격 `unity/IslandGame`은 전체 로컬 프로젝트와 동기화된 상태가 아닙니다. 최신 C#은 [참고 스냅샷](client-source-snapshot/2026-11-05/Runtime/)에만 갱신했습니다. 폴더 전체 덮어쓰기를 금지합니다.

## 원인과 참조에서 확인한 내용

Unity는 `SkillTreeManager.Bind`에서 서버 x/y를 바로 0.01배로 그렸습니다. 웹의 `layoutTree`는 이미 표시 좌표 충돌을 분리했지만 Unity에는 해당 과정이 없었습니다. 기존 780개 중 중심 거리 44 원본 단위 미만이 307쌍이고 완전히 같은 좌표도 있었습니다. 기존 무궁한 소켓 반경 310의 변환 가능 노드 수는 77/51/50/44/47/42/44/49개입니다.

- `EmmittJ/PoESkillTree`는 현재 `PoESkillTree/PoESkillTree`로 연결됩니다. 조사 커밋 `459df43fcd7a00c43285fe488bc0a2b4f6421921`. [그룹/궤도 및 연결선 렌더링](https://github.com/PoESkillTree/PoESkillTree/blob/459df43fcd7a00c43285fe488bc0a2b4f6421921/WPFSKillTree/SkillTreeFiles/SkillTree-Drawing.cs), [주얼 반경과 대상 강조](https://github.com/PoESkillTree/PoESkillTree/blob/459df43fcd7a00c43285fe488bc0a2b4f6421921/WPFSKillTree/TreeDrawing/JewelRadiusDrawer.cs)를 확인했습니다.
- PathOfBuilding 조사 커밋 `3dbca4463c0a59079d9f7f032d8240cf868e09da`. [PassiveTree.lua](https://github.com/PathOfBuildingCommunity/PathOfBuilding/blob/3dbca4463c0a59079d9f7f032d8240cf868e09da/src/Classes/PassiveTree.lua)는 그룹 중심+궤도 반경/각도로 실제 좌표를 복원하고 소켓별 반경 내 노드 목록을 미리 계산합니다.
- 두 프로젝트가 임의의 그래프를 자동 정렬하거나 8개 제한을 제공하는 것은 아닙니다. 좌표·연결·주얼 대상 계산을 구분하는 구조를 참고했습니다. 외부 코드/이미지를 게임에 복사하지 않았습니다.

## 구현

### Unity 표시 전용 배치

`SkillTreeLayout.cs`를 추가하고 `SkillTreeManager.Bind`가 그 결과로 노드·연결선·카메라 경계를 함께 계산하도록 수정했습니다.

- 기존 영역의 x/y 앵커를 0.016배로 넓혀 사용합니다. 노드 ID, 907개 연결, 원본 x/y, 습득/회수/경로/포인트는 변경하지 않습니다.
- 소켓→시작점→핵심→주요→일반→동적 군주얼 순서와 ordinal ID 정렬로 결과를 고정합니다. 노드 목록의 배열 순서에 의존하지 않습니다.
- 공간 격자와 국소 궤도 탐색으로 **중심 간격 최소 0.9 월드 단위**를 확보합니다. 가장 큰 노드 반경은 0.22입니다.
- **표시 반경 3.1 월드 단위 안의 변환 가능한 기본 노드는 소켓마다 최대 8개**입니다. 시작점/소켓/핵심/동적 군주얼 노드는 변환 대상으로 세지 않습니다.
- 표시 밀도 반경과 서버 원본 반경 310은 별개의 좌표계입니다. 표시 반경 안의 8개 ID가 서버의 가까운 8개 ID와 같다는 보장은 없습니다. Unity에 실제 효과의 원형 범위라고 표시하지 않습니다. 향후 주얼 UI는 서버 `transformations`의 정확한 ID로 강조해야 합니다.
- 효과/습득 상태만 바뀌면 배치를 재탐색하지 않도록 기하 정보 서명을 캐시합니다. 매 프레임 물리/힘 기반 정렬을 수행하지 않습니다. 군주얼 추가는 마지막에 배치하여 기존 기본 노드를 움직이지 않습니다.
- 넓어진 영역을 볼 수 있도록 `SkillTreeCameraController.MaxOrthographicSize`만 22→42로 확장했습니다. 기본 줌 4.5와 탭·팬·핀치 동작은 유지합니다.
- 씬 YAML 수정 없이 기존 `Island.unity` 런타임 생성 흐름에 연결했습니다.

### 실제 주얼 효과 제한 — 서버 배포 대기

`src/components/rpg/jewel-system.ts`에 `MAX_TIMELESS_TARGETS=8`, `timelessTargets`를 추가했습니다. 원본 좌표 반경 310 내에서 변환 가능한 기본 노드를 거리순으로 정렬하고 동률은 ordinal ID로 결정해 최대 8개를 선택합니다. 시작점/소켓/핵심/군주얼 노드를 제외하며 8개를 채우기 위해 반경을 넓히지 않습니다. 할당 여부에 따라 대상 목록이 바뀌지 않습니다.

여러 주얼이 같은 노드를 대상으로 하면 기존 장착 order의 마지막 주얼이 우선합니다. 장착 해제하면 이전 매핑이 복원됩니다. 저장 형식은 유지하지만 기존 장착 빌드를 새 코드로 계산하면 변환 대상 수가 줄어드는 밸런스 변경입니다. 운영 반영은 별도 배포 단계가 필요합니다.

`GemCorePanel.tsx`도 같은 선택 함수를 사용해 정확한 최대 8개를 강조합니다. 표시 좌표 이동 후에는 실제 범위를 설명하지 못하는 원형 테두리를 제거하고 대상 수 안내를 넣었습니다.

## 검증

[정량 결과](evidence/2026-11-05-tree/validation-summary.json), [서버 전체 결과](evidence/2026-11-05-tree/server-tests.log), [Unity 검사 스크립트](evidence/2026-11-05-tree/ValidateLayout.cs).

- Unity 컴파일 오류/경고 0. Play 진입 후 실제 프레임 진행(11822→11829)을 확인했습니다. 현재 Console groundTruth 오류/경고 0이며 Pipeline의 누적 이력에 이전 턴 캡처 경로 오류가 남아 있는 것과 구분했습니다.
- 780개 전체 303,810쌍: 최소 중심 거리 0.9001667, 겹침 0. 8개 소켓의 표시 반경 대상 수 모두 8개.
- 입력 배열 역순에서도 동일 좌표, 원본 데이터 불변. 군주얼 18개 추가한 798개도 최소 간격 0.9001667이며 기본 780개 위치 불변.
- 1080×1920 / 1080×2340 / 1080×2520에서 각 18개 입력 검사, 총 54개 PASS. 팬, 핀치, 탭 역투영/2D 선택, 부모 ScrollRect 잠금·복원, 취소, 줌·경계 Clamp 포함.
- 서버 성장 관련 9개 파일 **58개 PASS, 실패/스킵 0**. 8소켓×5무궁한 계열, 경계 310 포함/310.001 제외, 동률, 변환 제외 대상, 중첩·복원, 변환 수식, 군주얼, 경로/포인트/회수/저장·서비스 검증 포함.
- 테스트 실행 중 Windows 자식 프로세스의 `--import C:/...` 오류를 발견해 `test-items.ts`에서 `pathToFileURL`로 수정했습니다. 그 뒤 독립 프로세스 동시성 검사도 통과했습니다. 이 수정은 테스트 실행 경로에만 해당합니다.
- 첫 전체 배치 계산은 이 Editor에서 약 90ms였습니다. 시작/구성 변경 시 한 번의 측정이며 모바일 성능 보장은 아닙니다.
- 실제 시작점/중앙 노드 구간의 Game View를 확인했습니다. PNG는 로컬 `C:/Users/SHK/island-layout-review/`에 보관했습니다. 선 교차를 제거하는 평면 그래프 재설계는 하지 않았습니다.
- 실제 휴대폰 터치·GPU/발열, 전체 웹 타입 검사 및 웹 브라우저 화면은 미검증입니다. 웹 전체 의존성을 설치하지 않았고 TS 검증은 실제 테스트 로더 실행 기준입니다. 컴파일 통과를 미술 승인으로 취급하지 않습니다.

재실행 예(원본 저장소 의존성이 설치된 환경): `npm run test:rpg:build`. 이 Windows 검증에서는 별도 도구 폴더의 tsx를 file URL로 로드해 동일 9개 파일을 실행했습니다. Unity는 `unity command script run --file <ValidateLayout.cs> --entry ValidateLayout.Main --project-path G:/new_project/IslandGame --caller plugin --skill unity-cli`로 열린 성장 화면을 검사하며, `ValidateLayout.Expanded`는 Edit Mode에서도 군주얼 포함 정적 배치를 검사합니다.

## 종료 및 다음 작업

Play 종료, 백그라운드 실행 override/auto tick 해제, 검증용 메모리 서버 종료. Game View는 1080×2340입니다. PlayerPrefs 서버 주소와 씬 파일은 변경하지 않았습니다. 씬 SHA-256은 `7AD746CA1498A7623219D8E6DDD3873472B1EE61982EAC0F4CD3EDE71F5B71E1`입니다.

다음 에이전트는 로컬 수정과 [snapshot manifest](client-source-snapshot/2026-11-05/source-manifest.json)를 비교하고, 운영 서버 미배포 상태를 먼저 확인해야 합니다. 원본 좌표와 표시 좌표를 혼용하거나 클라이언트에서 효과를 계산해 서버 상태를 덮어쓰지 마세요.
