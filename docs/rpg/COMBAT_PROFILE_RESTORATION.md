# 실제 BalanceData를 연결한 전투 프로토타입

브랜치 `feature/rpg-combat-restore`. 온라인 홀덤과 Render 배포는 변경하지 않았다.

## 구현과 확정 범위

| 연결 | 결과 | 근거/제한 |
|---|---|---|
| GUID → ActorType 2 → SkillType 911–915 | ActorData 연결 확인 | GUID `7d09d20bec5eaf94cbaa907e7bc294e6` |
| GUID → Hero_Axe01 | 카탈로그 문자열 인접 관계로 보강 | GUID 다음 문자열이 Hero_Axe01.prefab. 원본 Addressables resource-location 구조는 확보하지 못해 확정 연결로 표기하지 않음 |
| Hero_Axe01 Prefab → Spine JSON | 오브젝트 참조로 확인 | GameObject `768041873079057063` → SkeletonAnimation `7164544061370055335` → SkeletonData `5623481548197092486` → TextAsset `-5641566546299852505` |
| SkillType → Motion/Impactor | ActionData 및 ISIL getter로 확인 | Basic.Type 1=Motion, 33=Impactor는 Native RunAction switch에서 확인 |
| AnimationState 11–15 → attack1–5 | 웹용 명시적 매핑 | 원본 enum-to-string 함수 미확보. 에셋에는 실제 클립들이 존재하지만 숫자 enum을 복원했다고 주장하지 않음 |
| Basic.Time → 타격체 생성 | 데이터 및 실행 흐름 확인 | ProcessActions가 조건을 확인하고 시간 구간 통과 시 RunAction 호출. 공격속도 보정 시 action elapsed도 보정됨 |
| 타격체 생성 → 피해 | 웹 단일 대상 근사 구현 | 생성 시점에 대상 ID·거리·방향을 재검사. 원본 충돌체 이동·다중 대상·방어/피해 공식은 미복원 |

Basic.DataIdx로 같은 종류의 child 목록에서 항목을 선택하며 DataId도 대조한다. DataId만으로 전체 자식들을 합치지 않는다. 비저장 DataIdx는 0번째 항목으로 해석하는 웹 어댑터이며 현재 Axe 기록과 일치한다. 조건이 명시된 타격체/복수 Motion/복수 타격체는 자동 적용하지 않고 생성기가 중단한다.

## 반영한 값

| SkillType | 웹 클립 | 타격체 생성 시각 | 공격 유지시간 |
|---|---|---:|---:|
| 911 | attack1 | 0.20초 | 0.50초 |
| 912 | attack2 | 0.20초 | 0.50초 |
| 913 | attack3 | 0.20초 | 0.50초 |
| 914 | attack4 | 0.20초 | 0.50초 |
| 915 | attack5 | 0.30초 | 0.67초 |

공격 유지시간은 현재 Axe ActionData.HoldTime이며 클립 길이와 분리했다. Native GetActionDuration은 조건에 해당하는 Basic.Time들의 최대값과 HoldTime을 비교하므로, 원본 전체 조건 인터프리터까지 복원한 것은 아니다. 웹 기본공격은 위 확인한 단일 활성화만 적용한다. 짧은 공격 클립이 끝나도 유지시간 전에 새 공격이 즉시 시작되지 않는다.

- ComboDelay 0.75초를 공격 유지시간 뒤의 입력 공백에 적용.
- MinDefaultAttackDelay 0.15초를 최소 동작 간격의 하한으로 유지.
- 회피 쿨다운 2초. 회피 애니메이션은 에셋의 0.5초. 무적 판정은 추가하지 않았다.
- Rush 사용 플래그와 거리 1–2, 속도 20을 사용. **웹 스케일 100px/원본 단위는 설계값**으로 명시했다. 이동 속도 175px/s·정지거리 100px·기본 사거리 120px·회피거리 125px도 원작 단위의 완전한 복원이 아니다.
- MovingHitCount=2를 동일 적에게 2회 피해를 주라는 뜻으로 해석하지 않는다. 현재는 활성화당 대상 한 명에게 한 번만 피해를 적용한다.
- 5단계 전체 사용은 프로토타입 장착 설정이다. PowerBlow/FinishBlow 마스터리 해금은 별도 복원이 필요하다.
- 각종 스킬 공격, 공격형 Dash, 피해량 20/30, 보상, 몬스터 AI는 기존 프로토타입 규칙을 유지했다.

## 재생성

`build_combat_profile.py`는 ZIP을 수정하지 않으며 결과에 원본 해시와 제한 사항을 저장한다. 에셋 브랜치는 `fef94dd999990ae7437681f4566eed6d84b4ff91`에 고정해 메타데이터를 읽는다. 해당 Git object가 없으면 먼저 `git fetch origin assets/rpg-library`를 실행한다. 기존 Native 선별 추출 파일은 `rpg-handoff-source/extracted/` 아래에 있어야 한다.

```bash
python scripts/rpg/build_combat_profile.py \
  --chain /path/to/vardian-combat-chain-20261022-213633.zip \
  --balance /path/to/vardian-balance.zip \
  --handoff /path/to/Vardian_COMPLETE_HANDOFF_2026-10-18.zip
npm run test:rpg
python scripts/rpg/test_trace_combat_chain.py
```

입력 ActorData/ActionData 해시가 trace의 해시와 다르면 중단한다. Public Spine JSON의 해시와 원본 TextAsset object ID도 대조한다. 전체 원본 ZIP이나 비밀키를 웹 공개 폴더에 넣지 않는다.

## 검증

- Spine 에셋의 32개 클립을 런타임에서 확인.
- 전투 회귀 테스트 18개 통과: 타격 시점, 공격 유지시간, 3/4/5단계 순환, 버퍼, 대상 교체, 사거리 이탈, Rush 취소, 회피 쿨다운, 재생 serial, 처치/부활 및 결정론적 자동 플레이.
- RPG 파일 대상 TypeScript 검사 및 프로덕션 빌드 확인.
- 루트 전체 TypeScript 검사는 기존 포커 테스트의 .ts import 설정·예제 socket.io 타입 등의 오류가 있어 통과하지 못했다. 이번 작업 범위에 포함시키지 않았다.

남은 원본 자료는 BalanceData.AnimationState enum/문자열 변환 함수와 실제 Addressables GUID resource-location이다. 정확한 피해 복원에는 Impactor 이동/접촉·방어 계산과 마스터리 해금도 추가로 필요하다. 이 프로토타입의 동작 개선과 원작 전체 복원 완료를 구분한다.
