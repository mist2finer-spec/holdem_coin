# 추가 전투 복원 — 2026-10-26

이번 작업은 원본 증거·오프라인 복원과 컴파일러 보완이다. 현재 서비스의 전투 밸런스나 포커 규칙은 변경하지 않았다.

## 확정한 부분

| 항목 | 결과 | 근거 / 범위 |
|---|---|---|
| 잘못 추출된 enum | 10종, 109개 상수 교정 | v39 메타데이터 원본 바이트. int32는 압축 정수+부호 복원, uint32는 압축 무부호 정수 |
| MonsterAIType | None0 / Attacker1 / Neutral2 / Slow3 / Defender4 / NpcAttacker5 | 이전 고정 4바이트 값은 사용 금지. 이름 복원이 AI 행동 전체 복원을 의미하지 않는다 |
| ActionCooltimeMethod | Time0 / PerDefaultAttack1 | 원본 AdjustCooltimeByMethod가 방식1에서 정수 반올림하는 분기와 교차 확인 |
| 액션 원본 | 421개 유지 | SkillType 중복 원본도 보존. 실행용 딕셔너리의 357개와 다른 집계 |
| 액션↔SkillData | 142개 액션 레코드 연결 | SkillType 일치; 나머지는 곧바로 누락 판정하지 않는다. 기본 공격 등은 독립 SkillData 없이 존재할 수 있다 |
| 효과 파라미터 | 총466개 중459개 수치 해석 가능 | 레벨1 기준. 기존 심볼릭 효과 중72개를 추가 수치 복원. 필터/효과 실행 완료라는 뜻은 아님 |
| 파라미터 선택 함수 | 원본 ARM64 1,024건 일치 | 감사된 libil2cpp.so, 주소0x6b64a98, 함수 후킹 없음 |
| 반복 컴파일 | 메타데이터 중복 누적 제거 | row.extend 대신 row[3:] 교체. 2회 실행 SHA 동일, 기존 서비스 데이터와도 동일 |

파라미터 선택 규칙: Specified(0)는 전달한 실수 그대로, None(1)는0,
V1~V9(2~10)는 스킬 파라미터 구조체 해당 값을 반환한다. **심볼릭인 경우 효과에 저장된 V1을 곱하는 방식이 아니다.**
스킬 레벨별 파라미터 계산은 기존 검증된 `reference_progression.skill_parameters`를 재사용했다.
전체 스킬/효과 순서, 공격속도·치명타·속성·피해감소가 합쳐진 최종 피해식까지 검증했다는 뜻은 아니다.

## 추가로 확인한 원본 동작

- RunActionEffect는 필터 검사 → 대상 선택 → ChanceParam 해석 → 확률 검사 → RunEffect → 성공 FX/오디오 순서다.
- Chance 해석 결과가 0 이하이면 100%로 취급한다. 현재 원본466개 효과에서 Chance는464개가0, 2개가100이며 모두 리터럴이다. 이번 서비스에서는 기존 동작을 바꿀 이유가 없다.
- CheckActionCondition에는 HP/MP **비율**의 엄격 초과/이하, 실드 양수, 마킹 개수/최대 여부 분기가 존재한다. HP 값은 퍼센트/100과 비교한다.
- 현재 실행 데이터의323개 명령 조건은 모두 Always(0)다. 조건 인터프리터 확장이 당장 동작 누락을 메워 주는 것은 아니므로 검증되지 않은 마킹 저장 상태를 만들지 않았다.

## 남은 자료 / 후속 복원

| 우선순위 | 남은 부분 | 현재 상태와 필요한 증거 |
|---|---|---|
| 1 | 최종 피해식과 효과 상태 머신 | RunEffect / StartEffect / AdvanceEffect / InflictDamage 원본은 있음. 전체 분기와 필드 오프셋을 별도 검증해야 함 |
| 1 | 심볼릭 효과의 실제 장착 레벨 | 수치 선택 함수 복원됨. 캐릭터 실제 스킬 레벨·버프·장착 연결이 필요; 레벨1 값을 실서버에 일괄 대입하지 않음 |
| 1 | 효과 필터6건 | FilterDatas와 원본 FilterTarget 함수 확보. 범위·대상·마킹 저장 문맥과 연산 순서를 추가 검증해야 함 |
| 2 | 누락 액션4개 | Actor1011→2016, 1012→2036, 1013→2056, 535→2430. 제공된 ActionData에 해당 SkillType 없음 |
| 2 | 맵별 웨이브 / 출구 / 오브젝트 좌표 | StageData 목표·ID는 있음. 현재 웹 배치는 어댑터; 원본 맵 참조 그래프 연결 자료 필요 |
| 2 | NPC 실제 프로필 | 호위 승리 조건은 있으나 NPC ID→Prefab→Actor/Stats 연결 미확정 |
| 2 | 원본 보상 이벤트·드롭 추첨 | 테이블은 확보. 처치/웨이브/스테이지 이벤트 라우팅 및 RNG 연결 미완료 |
| 3 | 서버 재시작 복구 | 체크포인트 외 전투 중 개체/투사체/버프 상태 저장 필요. 원본 데이터 추출과는 별개 서버 설계 작업 |

## 재현

```bash
python scripts/rpg/recover_combat_gaps.py --metadata <global-metadata.dat> --review <enum-review-required.json> --decoded <decoded-dir> --output <output-dir>
PYTHONPATH=<unicorn-and-pyelftools>:scripts/rpg python scripts/rpg/verify_action_parameter_native.py --native <libil2cpp.so> --output <verification.json>
npm run test:rpg:reference
```

검증: Python 참조 테스트70건 통과, 원본 ARM64 파라미터 선택1,024건 통과,
컴파일러2회 재실행 동일 SHA. 원본 바이너리와 대용량 액션 증거는 공개 저장소에 넣지 않았다.
`recovered-combat-enums.json`은 교정된 참조 파일이다. 기존 SQLite/과거 패키지의 enum을 자동 덮어쓰지 않는다.
