# Mount Sunday 독립 탐험 검토 프로젝트

Unity 6000.0.62f1 / URP 17.0.4. 기존 IslandGame과 별개 프로젝트다. Unity Hub에서 이 폴더를 열고 `Assets/MountSunday/Review/MountSunday_Exploration_Review.unity`를 연다. 기존 프로젝트에 통째로 덮어쓰지 않는다.

Play: WASD 이동, 오른쪽 마우스 시점, Shift 달리기, Tab 걷기/비행, 비행 Q/E 높이, N 다음 지점. Android: 왼쪽 터치 이동, 오른쪽 터치 시점, WALK/FLY 전환, NEXT POINT 보조 이동. 비행에서는 바라보는 방향으로 이동한다.

`MountSunday_Baseline.unity`는 임포트 기준 화면용이다. 일반 검토는 `MountSunday_Exploration_Review.unity`를 사용한다. 패키지 생성 메뉴를 다시 실행하면 Generated 자산을 다시 만들므로 별도 복사본에서 수행한다. 이미 생성된 씬은 메뉴 재실행 없이 사용할 수 있다.

평원→다리 상판→성문→마을→황금 전당 문 앞을 CharacterController로 664지점/약1.26km 연속 보행했다. 전투 검토 공간은 `Review combat clearings` 아래 표시한다. 전투·서버·기존 플레이어는 연결하지 않았다. 실제 DEM 기반 지형과 게임용 하천·건물·식생·집터를 구분한다.

성능은 식생·소품 LOD와 가시거리 중심으로 조정했다. 추가 지형 LOD는 타일 이음선 때문에 최종본에서 제외했다. 원본 64 근거리/16 원경 지형 메시와 프러스텀 컬링을 유지한다. 전체 맵 스트리밍과 모바일 전용 경량화는 후속 범위다.

참고 영상 수준의 미술 마감에는 미달한다. Android 실기 검사는 사용자 요청으로 제외했으며 모바일 FPS를 보장하지 않는다. 원본 출처와 라이선스는 SourceDocumentation/ATTRIBUTION.txt 및 함께 제공한 보고서를 참고한다.

재현용 코드: `Editor/ReviewSetup.cs`, `Editor/OptimizeStage.cs`, `Editor/FinishReviewScene.cs`. `ReviewRun`은 필요할 때만 호출하는 보행/성능 측정 도구다. LOD·영상 진단 클래스는 UNITY_EDITOR 조건으로 빌드에서 제외한다. 일반 씬에 진단 루프를 자동 실행하는 컴포넌트는 없다.

전체 검사와 수정 파일 목록: GitHub `mist2finer-spec/holdem_coin`의 `review/mount-sunday-20261107`, `docs/unity/MOUNT_SUNDAY_REVIEW_20261107_KO.md`.
