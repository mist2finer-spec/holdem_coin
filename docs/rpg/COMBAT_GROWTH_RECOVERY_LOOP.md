# 전투·성장 반복 복원 결과와 재실행

작업일: 2026-10-26 (미 동부). 작업 브랜치: `restore/rpg-combat-growth-loop`.
이 문서는 원본과 대조해 확인한 범위, 웹 실행 데이터 수정, 미완료 항목을 구분한다.
**전체 원작 전투/성장을 완벽 복원했다는 의미가 아니다.**

## 이번에 복원·수정한 범위

| 항목 | 결과 | 실제 범위 |
|---|---|---|
| 최종 피해식 | 원본 ARM64 비교 3,980건 일치 | 48개 능력치 필드, 물리/마법·공격 종류·대상 분류별 보정 순서, 상대 Valor/Mental, 명시적으로 전달된 속성/Actor 보너스, MaxDefRate 하한, 최소 피해/무피해 플래그, DmgRate222·DefRate224 수치 적용 |
| 회복량 | 원본 ARM64 비교 405건 일치 | 대상 최대 HP 비율, 양수 고정 회복값 우선, HealRate229 및 원본 하한값 적용. HP 상한 반영/대상 선택/버프 수명은 별개 |
| 효과 조건 | 원본 ARM64 비교 4,096건 일치 | Always/Never, HP·MP 엄격 초과/이하, 보호막 유무, 대상 부재. 원본 대상 탐색·상태 조회는 테스트 fixture 사용 |
| 필터6건 | 6건 모두 `FilterOp=0`으로 판명 | 비활성 목록을 필터가 있다는 이유만으로 제외하던 컴파일러 수정. 리터럴 피해3건 복구; 나머지3건의 실제 장착 스킬 레벨은 여전히 필요 |
| 스킬 레벨→효과 | `reference_effects.resolve_effect` 추가 | 지정한 실제 장착 레벨의 V1..V9 선택, 필터→확률 순서, 피해 부가 파라미터. 레벨 누락 시 임의로1을 대입하지 않음 |
| NPC | 설정101개 중100개→ActorData 연결 | 고유26개 Actor 프로필. 외형 GUID·크기·태그 등이며 실제 NPC HP/성장/위치는 아직 미확정 |
| 반복 도구 | `recovery_loop.py` | 추출/컴파일→누락 감사→참조·네이티브·웹 검증→반복 컴파일 동일 SHA 확인. 최대3,600초, 결과 안정화 시 조기 종료 |

피해 함수 검증은 **원본 CalcFinalDamage 본문을 실행**하지만, Actor 조회/숫자 저장 표현/외부 조회 함수와 효과 목록은 명시적인 fixture를 사용한다. 전체 원작 엔진을 실행한 것이 아니다. `reference_damage.py`는 오프라인 참조 함수이며 현재 웹의 `HuntEngine.hurt`를 일괄 교체하지 않았다. 미지원 활성 효과 문맥은 예외로 거절한다. 현재 웹에 해당하는 변경은 필터 컴파일러와 그 결과 데이터다.

## 남은 핵심과 새로 발견한 결함

1. **전체 최종 피해 처리:** 버프/디버프 수명·중첩·해제, 면역·확률 발동·반사막, 실제 명중/치명타 선택, 그로기 배율, 보호막 소모 및 InflictDamage 이벤트 순서를 더 복원해야 한다. DmgRate/DefRate 수치를 계산할 수 있는 것과 그 상태 머신을 복원한 것은 다르다.
2. **누락 액션4개:** Actor1011→2016 `MediumSlime_Fire_Skill1`,1012→2036 `MediumSlime_Water_Skill1`,1013→2056 `MediumSlime_Earth_Skill1`,535→2430 `StatueTrap02_Attack1`. enum과 Actor 참조는 존재하지만 제공된 ActionData421행에는 실행 행이 없다. 확인한 두 파일은 SHA가 같아 독립 버전2개를 확인한 것도 아니다. 인접 액션 복사는 하지 않았다.
3. **맵 원본 연결:** 기존 map-scenes 인덱스186,373행에서 `(bundle,PathID)`가 충돌하는 키5,498개, 최대중복170회를 확인했다. JSON 파일명에 serialized-file 식별자가 없어 서로 다른 씬을 덮어썼다. 남아 있는128개 웨이브·995개 스폰 정의는 후보이며 플레이 가능한 원본 그래프가 아니다. 덮인 내용/Transform 좌표는 원본 번들 재추출이 필요하다.
4. **NPC:**100개 Actor 연결을 원본 호위 NPC의 전투 스탯이나 stage 배치로 해석하면 안 된다. 아직 MapType/MapEntityGroupId→serialized scene→Transform→NPC 전투 메타 연결이 필요하다.
5. **성장·보상:** 현재7800레벨 EXP 곡선/기존 성장 산술은 유지한다. 전체 장비 등급·돌파/옵션·착용 스킬 합산, 원본 이벤트/드롭 보상 라우팅, 전투 중 개체/버프 상태의 재시작 복구는 추가 작업이다. 웹 임시 처치 보상/장비 상한을 원본이라고 재표기하지 않았다.

## 코드와 검증 결과

- `scripts/rpg/reference_damage.py`, `verify_final_damage_native.py`
- `scripts/rpg/reference_conditions.py`, `verify_conditions_native.py`
- `scripts/rpg/reference_effects.py`
- `scripts/rpg/recover_scene_links.py`, `collect_map_graph.py`, `collect_map_graph.ps1`
- `scripts/rpg/audit_recovery_state.py`, `recovery_loop.py`
- `docs/rpg/recovery-loop/`: 검증 수치·근거 SHA·미해결 목록·NPC 프로필

독립 비교는 바이너리 SHA `42784ff220ca0eec7a21f9eafb64ac89088ff7463193b25f76baa19536c484e5`에서만 실행된다. 다른 버전은 주소/레이아웃부터 재검증해야 한다. 바이너리와 대량 원본 코드·개인 세이브는 git에 넣지 않는다.

검증: 참조 테스트99건, RPG 회귀 테스트88건, RPG TypeScript 검사, Next.js 프로덕션 빌드 통과. 두 번째 컴파일에서도 동일 SHA로 안정화되었다.

## 반복 복원 실행

```bash
# 순수 추출/회귀 검증. 새 출력 폴더를 지정한다.
npm run rpg:restore:loop -- \
  --source /path/to/decoded-tables \
  --stages /path/to/labyrinth.jsonl \
  --output /path/to/new-recovery-output \
  --seconds 3300 --rounds 3
```

네이티브 비교는 Python 환경에 `unicorn`, `pyelftools` 설치 후 `--native /path/to/libil2cpp.so`를 추가한다. 기존 맵 추출물 감사는 `--legacy-root /path/to/Vardian_Remaining_Assets_And_Loader_Audit`, 다른 ActionData 버전 대조는 반복 가능한 `--action-source /path/to/ActionData.json`을 추가한다.

출력이 `stable-with-blockers`이면 결정론적 추출·검증은 통과했고 새 입력 없이는 더 복원되지 않는 항목이 있다는 뜻이다. 전체 복원 완료가 아니다. 실패 시 중단하고 단계 로그를 보존한다. 시간 초과 시 해당 자식 프로세스 그룹을 종료한다. 이 도구는 LLM/API/자동 푸시/배포를 호출하지 않는다.

## 사용자 PC에서 필요한 자료 — 지금은 이 항목만 보류

원본 `map_scenes*.bundle`을 찾으면 아래를 실행한다. 기존 JSON 묶음만으로 덮어쓴 씬을 되살릴 수는 없다.

```powershell
# GitHub의 scripts/rpg 폴더를 함께 받은 위치에서 실행
python -m pip install UnityPy
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\rpg\collect_map_graph.ps1 -Root "$env:USERPROFILE\VardianRE"
# 여러 번들이 나오면 -Bundle "실제 map_scenes 파일 전체 경로"를 명시
```

새 추출기는 `(bundle, serialized_file, path_id)`를 보존하고 GameObject·Transform·MonoBehaviour·MonoScript와 외부 참조 목록을 함께 저장한다. 이 추출기 자체는 현재 환경에 원본 번들이 없어 실제 번들로 검증하지 못했다. 네임스페이스 충돌/외부 참조 규칙은 회귀 테스트로 검증했다. 새 결과가 오기 전까지 임의의 원본 웨이브/좌표를 서비스에 주입하지 않는다.
