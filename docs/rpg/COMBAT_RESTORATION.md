# 전투 복원 1차: 근거·매칭·추가 추출 경계

작업 브랜치: `feature/rpg-combat-restore`. 홀덤 main/서버/배포 설정은 변경하지 않는다.
이 버전은 원작 전체 복제가 아니라, 확보된 Native 구조를 웹 프로토타입에 연결한 1차 복원이다.

## 이미 있는 근거

`Vardian_COMPLETE_HANDOFF_2026-10-18.zip` 안의
`02_EVIDENCE/VERIFIED_SOURCE/Vardian_Bulk_Combat_Audit.zip`에서 필요한 Native 함수 16개를 찾았다.
전체 재디컴파일은 필요 없다. 파일·메서드 토큰·주소·SHA-256은 `combat-handoff-evidence.json`에 있다.

중요: `AssemblyCSharp_Export.zip`의 C#은 대부분 빈 메서드/기본 반환값을 가진 구조 덤프다.
`AutoCombat => false`, `DefaultAttackSkillTypeCount => 0`을 실제 게임 규칙으로 포팅하면 안 된다.
타입/필드/메서드 이름을 찾는 용도로만 사용하고, 동작은 Native 본문과 데이터로 대조한다.
ForgeTrail v0.2 또한 독립 예제이며 원작의 콤보·피해·경제 수치 근거가 아니다.

| 기능 | 원본 근거 | 이번 웹 연결 | 근거 수준 |
| --- | --- | --- | --- |
| 콤보 순환 | `CombatHeroAI.OnAdvance`, token `0x60044EE`: 인덱스 증가 후 실제 기본공격 목록 길이로 modulo | 설정 목록 길이 3/4/5에 대응 | Native 구조 확인, 실제 장착 목록 미확정 |
| 콤보 초기화 | `ResetDefaultAttackCombo` `0x60044E9`, OnAdvance 타이머 만료/상태 조건 | 입력 공백 뒤 초기화 | 초기화 구조 확인, 웹 .55초는 임시 |
| 접근 가속 | `StartRush` `0x600433F`, `ProcessRush` `0x6004466`, OnAdvance의 거리/config 분기 | AUTO/공격 요청 시 접근, 사거리 앞 정지, 수동 이동/AUTO OFF 취소 | Rush 구조 확인, 거리·속도는 임시 |
| 별도 Dash 액션 | `StartDash` `0x600432F`, `ProcessDash` `0x6004464` | 접근 Rush와 구분하여 문서화; 공격형 Dash는 아직 구현하지 않음 | Native 구조 확인 |
| 타격 액션 | `RunActionImpactor` `0x6004498`, `ExecuteSkill` `0x60043AE` | 시작 즉시 피해 대신 예약 시점에 거리/방향/대상 세대 재검사 | 원작 액션 시스템 확인, 정확한 히트 프레임 미확정 |
| 모션 시퀀스 | `RunActionMotion` `0x6004495`의 PlayAnim/ReserveAnim | 시작/loop/end와 재생 serial 연결 | Native 예약 구조와 에셋 확인, 실제 ActionData 매칭 미확정 |
| 회피 | `ReserveAvoid` `0x60044E7`, `RunActionAvoid` `0x60044AF` | 0.5초 avoid1 동안 연속 이동 | 모션 길이 확인, 회피 거리·무적/인터럽트 조건 미확정 |

## 에셋에서 직접 확인한 값

`motion-profile.json`은 `public/rpg/Hero_Axe01.json`의 모든 타임라인에서 최대 time을 산출한다.
소스 해시와 Spine 버전을 포함하고 `scripts/rpg/build_motion_profile.py`로 재생성한다.

- attack1–4: 각 0.3667초, attack5: 0.6667초.
- dash/avoid1: 각 0.5초.
- skill3/4: 각 1.1667초. 기존 공통 .6초 잠금으로 잘리던 문제를 수정했다.
- skill5 / skill5_loop / skill5_end: .1667 / .3333 / .5초. 웹에서는 한 번씩 이어 재생한다.
- 공격 모션에는 타격 이벤트가 없다. footstep을 피해 이벤트로 해석하지 않는다.
- 슬라임에는 damage1이 없다. 존재하지 않는 피격 모션 대신 가벼운 흔들림을 사용하고 die1은 실제 재생한다.

## DESIGN_PROPOSAL로 남긴 값과 제한

`combat-rules.ts`의 기본 5단계 목록, 마지막 타격 피해 30/다른 타격 20, hitAt=길이의 55%,
이동/접근 속도, 접근 거리 밴드, 입력 버퍼, 콤보 유지시간은 원본 검증값이 아니다.
원작 장착 목록이 3/4타이면 생성자에 해당 목록을 넣으면 되며 숫자 5로 하드코딩해 순환하지 않는다.

공격 버튼/Space 길게 누르기와 끝부분 단발 입력 예약을 지원한다. 피해는 타격별 한 번만 적용하며,
사거리 이탈·대상 교체 시 이전 타격이 새 몬스터에 전달되지 않는다. 보상은 처치당 한 번이다.
Rush는 접촉 피해가 없는 접근 이동이다. 수동 조이스틱 이동 자체가 임의로 대시를 강제하지 않는다.
회피 무적, 회피 예약/외력 취소의 원작 전체 조건, 공격형 관통 Dash, 몬스터 공격 AI,
충돌/넉백/공격속도 스탯, 실제 원작 피해 공식과 다중 몬스터는 아직 복원 범위 밖이다.
스킬 아이콘-효과 매핑과 HP/재화/경험치는 기존 테스트용 값이며 계정/포커와 연동하지 않는다.

## 정말 추가로 필요한 매칭 자료

1. Hero/장착 설정의 **기본공격 SkillType 목록과 순서**. Native getter의 개수는 목록 길이이지 상수 5가 아니다.
2. 각 SkillType → SkillData/ActionData → Motion alias/sequence 연결.
3. Impactor 생성·활성 시각, 공격 범위/방향/피해 계수와 실제 공격 속도 보정.
4. Rush enable, min/max 거리, 속도 및 stop/collision 설정.
5. 회피의 보호 판정/외력 인터럽트/취소 허용 시간.

기존 에셋 라이브러리의 TextAsset 340개는 Spine JSON/atlas 계열이며, 이것만으로 위 게임 설정표가
확보됐다고 보지 않는다. 다음 우선순위는 기존 `metadata/config/`, Prefab/MonoBehaviour 연결,
별도 설정/데이터 어셈블리와 Config accessor이다. 이름 매칭만으로 의미를 확정하지 않는다.
해당 데이터가 없으면 원본 작업 환경의 libil2cpp/global-metadata.dat 또는 실행 시 Config 스냅샷으로
위 필드만 선별 추출한다. 이미 있는 Native 16함수를 처음부터 다시 Ghidra 처리할 필요는 없다.

추가로 `Vardian_Remaining_Assets_And_Loader_Audit.zip`의 config 오브젝트 88개를 점검했다.
이 범위에서는 Rush/Combo/DefaultAttack 필드 매칭을 찾지 못했다. `Actions Database`라는 이름의
오브젝트는 로컬 참조를 따라가면 `SpeedAction`, `WaitAnyInputAction`, `WaitForAction`이다.
이를 전투 ActionData 목록으로 오인해 공격/피해 설정에 연결하면 안 된다.
이 확인이 다른 어셈블리/런타임의 실제 GameConfig에도 해당 데이터가 없다는 뜻은 아니다.

## 필요한 함수만 다시 꺼내는 명령

Python 표준 라이브러리만 사용한다. 입력 ZIP을 수정하지 않고 로컬 참고 코드만 선별 추출한다.
`data/rpg-reference/`는 Git에서 제외하며 원본 함수 본문을 공용 저장소에 추가하지 않는다.

```sh
python scripts/rpg/audit_combat_handoff.py /path/to/Vardian_COMPLETE_HANDOFF_2026-10-18.zip --output docs/rpg/combat-handoff-evidence.json --extract-dir data/rpg-reference
python scripts/rpg/build_motion_profile.py
npm run test:rpg
```

추출 대상이 이미 있으면 덮어쓰지 않고 중단한다. Native 바이너리 실행이나 추가 디컴파일은 하지 않는다.

## 검증 범위

16개 엔진 테스트: 실제 에셋 해시, 피해 시점/중복 방지, 3/4/5타 순환, 버퍼/초기화,
접근·취소·경계, 회피 연속 이동, 긴 스킬·채널 모션, 쿨다운/회복, 사망/재출현/보상,
일시정지, 고정 입력 재현성을 검증한다. 두 Spine 데이터의 런타임 검사 및 TS/build도 실행한다.
유한 좌표와 엔진 테스트 통과는 실제 브라우저 모든 기기에서 시각적 원작 일치를 입증하지 않는다.
