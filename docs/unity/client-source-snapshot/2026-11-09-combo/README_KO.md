# 세 모션 콤보 증분 패치

기준: `4849528791b31d653724e45b5ee20c2499c793f3`의 2026-11-09-contact-boss 적용 상태. 전체 프로젝트가 아니다. `manifest.json`의 before와 현재 로컬 소스를 대조하고 다르면 사용자의 후속 변경을 병합한다. 원본 GLB, 애니메이션 클립, 루트 스케일, 물리 몸통 크기는 변경하지 않았다.

서버 소스와 `src/lib/generated/unity-hero-contact.json`, Unity `HeroContactProfile.json`은 반드시 함께 적용한다. 기본 attacks는 기존 큰 적/보스용, lowAttacks는 Mount .31m 슬라임용이다. 두 프로파일은 같은 원본 클립에서 추출되며 후자만 런타임 상완 회전 보정을 포함한다. 새 HeroMeleePose.cs와 meta를 포함한다.

모션별 contact window는 attack1/2=.32~.58, attack3=.32~.78. 세 모션 각각 새로운 attackId, 적별1회 피해다. 스킬·회피·보스 공격의 serial 증가가 일반 콤보 순서를 바꾸지 않는다.

StartMountTest의 테스트 origin은 메모리에서만 유지한다. 일반 앱 재시작은 온라인 origin을 사용한다. 이전 island-mount-server 키는 Awake에서 제거하며 사용자 계정·세이브는 지우지 않는다.

검증/배포/다운로드 기록: [최신 인계](../../COMBO_DEPLOY_20261109_KO.md).

## 재현 도구와 프레임 지연 보정

`Tools/ExportComboContact.cs`의 `ExportComboContact.Run`은 기존 프로젝트 리소스를 읽어 정상/낮은 적 프로파일을 `Temp/hero-contact-export.json`에 추출한다. 컴파일 완료 후 Unity CLI script run으로 실행한다. 726포즈 재추출과 저장 프로파일의 오차0을 확인했다. 원본 클립을 수정하지 않는다.

`VerifyComboPlayback.Run`은 Mount 테스트 Play 상태에서234개 실제 검 포즈와45개 버퍼 검사를 실행한다. `VerifyContactBarrier.Run`은 편집 모드에서도 프레임 지연과 연속 접촉, 중복/역재생 방지, 일시정지, 세션 교체를 검사한다. 결과 출력 경로는 도구의 마지막 줄에 있는 작업 폴더 경로를 현재 환경에 맞게 바꾼다.

최종 CombatSnapshotBuffer는 이미 서버가 확정한 접촉을 프레임 지연으로 건너뛰지 않게 최초 접촉에서 한 프레임 보여준다. 다음 프레임부터 전진하고, 지난 접촉으로 되감거나 클라이언트가 피해를 만들지 않는다. 네트워크가 너무 늦어 이미 표시 시점이 지난 사건을 받는 경우는 이 보정의 범위 밖이다.
