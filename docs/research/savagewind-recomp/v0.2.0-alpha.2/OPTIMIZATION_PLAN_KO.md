# 최적화 연구 계획 — 먼저 측정하고 한 가지씩 비교

이 문서는 조사·실험 지시서다. **아래 변경은 아직 게임에 구현하지 않았으며 성능 향상 수치를 측정하지 않았다.** 실제 대상은 Unity 6000.0.62f1 Built-in/Android이고, Savage Wind의 Windows Vulkan 수치를 가져와 성능 목표 달성으로 보고하지 않는다.

## 1. 원본에서 확인한 기법

| 주제 | 읽을 위치/심볼 | 구현에서 확인한 것 | holdem에 대한 연구 가설 |
|---|---|---|---|
| 측정 비용 관리 | [perfmon.c](upstream/runtime/perfmon.c): `perfmon_frame`, `frames_summary`; [exec.c](upstream/runtime/nvn/vulkan/exec.c): `vk_prof_frame` | 프레임 시간 ring buffer, 무거운 머신 상태는 별도 스레드에서 초당 2회; per-draw 계측을 줄이는 `SAVAGEWIND_VK_PROF=2` | Unity 상세 계측을 매 프레임 UI 문자열로 만들지 말고 capture window 및 저장 주기를 구분 |
| 함수 호출 조사 | [fnprof.c](upstream/runtime/fnprof.c): `fnprof_hit`, `fnprof_frame`; [sampler.c](upstream/runtime/sampler.c) | 지정 프레임 구간의 함수 진입 횟수 및 샘플 기반 조사 | 호출 횟수와 CPU 소요 시간을 구분. Jint step, serialization, presentation을 각각 측정 |
| 반복 조회 제거 | [dispatch.c](upstream/runtime/dispatch.c): `rt_dispatch`, `dispatch_slow` | 주소를 검증하는 스레드 로컬 direct cache, miss 시 실제 lookup | 같은 clip/profile/material lookup 반복이 병목일 때만 캐시. stage/asset 버전 변경 시 무효화 |
| Shader 단계별 캐시 | [shaders.c](upstream/runtime/nvn/vulkan/shaders.c): `cache_load`, `cache_store`, translation cache | binary+설정+번역기 식별값에 따른 변환 캐시, GLSL→SPIR-V cache | Unity에서는 Unity의 셰이더/variant 경로 사용. 이 Vulkan backend를 통째로 이식하지 않음 |
| Pipeline cache 신뢰 경계 | [device.c](upstream/runtime/nvn/vulkan/device.c): `PcHeader`, `pipeline_cache_load`, `vk_pipeline_cache_save` | GPU/driver/UUID/번역기/크기/hash 검사, 불일치 시 empty cache, 임시 파일 후 교체 | 사용자 캐시/베이크 데이터에 버전과 무효화 조건을 명시. 구조체 바이트만 맹신하지 않음 |
| 첫 사용 준비 | [exec.c](upstream/runtime/nvn/vulkan/exec.c): `pso_load`, `pso_warm_one`, `pso_init`, `vk_pso_wait` | 이전에 관측한 pipeline 목록을 로딩 중 준비; 처음 보는 pipeline은 여전히 runtime 생성 | 실제 사용하는 캐릭터/검/슬라임/VFX material variants의 첫 사용을 별도 측정, 필요한 경우 진입 전 준비 |
| 동일 상태 재사용 | `exec.c`: `dc`, `dyn_check`, `vk_dyn_forget`, `set_finish`, `draw_` | dynamic state 중복 설정 생략, submission 안의 동일 descriptor set 재사용 | shared materials/atlas/static prop batching 후보를 Frame Debugger로 비교. 이미 존재하는 mesh/material cache는 유지 |
| 렌더 해상도 | [output_scale.c](upstream/runtime/nvn/output_scale.c), `exec.c`의 `scene_upscale` | 출력 해상도와 내부 scene 크기 구분; UI와 scene의 업스케일 경로 구별 | GPU 픽셀 병목일 때 전투 화면 해상도만 실험; UI 글자/터치/가로 폭 12 프레이밍 유지 |

원본 `set_finish`는 두 64-bit hash로 내용을 구별하며 완전한 원본 key 비교가 아니다. 이 기법을 보상/저장/전투 판정의 동치성 보장에 사용하지 않는다. 원본의 캐시 해제·락·재시작 구현도 정형 검증된 것으로 취급하지 않는다.

`docs/SAVAGE-WIND.md`에는 PC의 특정 구간에서 CPU 명령 변환 15.0→11.4ms 등 저자의 측정 기록이 있다. 이는 **upstream의 보고값**으로, 이번에 재현하지 않았다. README/릴리스도 실제 플레이에서 45~50FPS 하락과 처음 등장하는 효과의 hitch를 남은 문제로 적고 있다. pre-warm을 모든 효과의 최초 hitch 해결로 과장하지 않는다.

## 2. 우선순위 — 현재 구현을 읽은 뒤 정한 가설

| 우선순위 | 측정 대상 | 첫 실험 후보 | 성공/회귀 조건 |
|---|---|---|---|
| P0 | Jint 전투 `stageAdvance`, 고정 step당 시간, `MaxBatchMilliseconds`, `DroppedSeconds` | 시드/몹 수를 고정해 worker 계산과 snapshot 생성 시간을 분리 | 화면 FPS만 좋아지고 전투 시간이 누락되는 개선은 실패 |
| P0 | 입력 JObject→string→Jint parse, snapshot stringify→C# parse, 할당/GC | 변하지 않은 입력의 표현 재사용, 불변 자료 이동 유지, snapshot 빈도/크기 분석 | 버튼 edge·명령 순서·일시정지·구역 경계가 그대로 유지되어야 함 |
| P0 | `NativeCombatClock`/`ProjectHero`/카메라의 시간차 | 동일 입력을 표시 FPS별로 재생하고 lead/correction 기록 | 이동 속도·공격 횟수·타격 위치 유지; 시각적 뒤로 튐 감소 |
| P1 | `SampleAnimation`과 skinning, `CreatedModels`/`ReusedModels` | 기존 풀 16개가 실제 wave에 맞는지, 신규 allocation이 어디서 발생하는지 비교 | 첫 등장/재사용/화면 복귀·죽음 포즈·발 접지 모두 정상 |
| P1 | 첫 공격·첫 splash의 프레임 spike | 사용 material/mesh/VFX variant만 진입 시 준비, VFX pooling | 첫 사용 및 반복 사용을 모두 기록; 효과를 생략해 얻은 FPS는 실패 |
| P1 | 지형/나무/슬라임 draw calls, 그림자, overdraw | shared material 유지, static 배경 묶음, shadow 거리/품질 한 변수씩 비교 | GPU ms 개선과 외형 비교. 투명 슬라임/풀 카드가 비용을 늘리는지도 확인 |
| P2 | 픽셀 셰이딩/낮은 scene 해상도 | 전투 viewport 한정 render scale 비교 | 실제 GPU 병목이 줄어야 함. UI 가독성·입력 좌표·카메라 비율 유지 |
| 보류 | Jint를 C#/Rust/C++로 포팅 | 실제 CPU 병목이 입증된 후 평가 | 저장소 정책의 동일 입력 최소 10만 건 동치성 검사와 커널/서버 계약 유지 |

`Battle3DView`의 프레임별 자료 구조 할당과 `NativeBattle.LateUpdate`의 새 `HashSet`, `ProjectHero`의 JSON clone도 profiler로 확인할 후보다. 코드상 할당이 보인다는 사실만으로 주병목이라고 확정하지 않는다.

## 3. 재현 가능한 측정 프로토콜

1. 실제 로컬 프로젝트와 원격 스냅샷 차이를 확인하고 보존한다. 코드 SHA, asset SHA, 커널 SHA, Unity 버전, 패키지, 기기/GPU/driver, 해상도/targetFPS를 기록한다.
2. 동일 seed/장비/성장/입력 스크립트로 ① hero만 이동 ② 실제 wave의 슬라임 다수 ③ 적 혼합/스킬 연속 ④ 구역 경계/재입장 ⑤ 화면 밖 actor 복귀를 수행한다. 몹 수는 기존 게임이 허용하는 상태를 사용한다.
3. 각 변경 전후에 동일한 구간을 3회 비교한다. 최초 실행/빈 캐시와 반복 실행/준비된 캐시를 별도 기록한다. 기기를 충분히 유지한 뒤 장시간 발열 구간도 따로 측정한다. 기존 캐시는 삭제보다 별도 시험 경로/백업을 사용한다.
4. 권장 capture는 워밍업 후 60초. 처음 등장하는 이펙트는 별도의 짧은 capture로 남긴다. Deep Profile은 병목 탐색에 한정하고 대표 성능은 낮은 오버헤드 설정으로 다시 측정한다.
5. 평균 FPS 외에 frame time p50/p95/p99/max, >33.3ms 및 >50ms 횟수, main/render/worker/GPU ms, GC bytes/frame·회수 횟수, batches/SetPass/triangles, shader 첫 사용 spike를 기록한다.
6. worker batch 시간은 여러 전투 step을 포함하므로 Unity main frame ms와 더하거나 같은 값으로 해석하지 않는다. worker step당 비용, snapshot 나이, backlog/dropped simulation time을 같이 본다.
7. 성능 목표는 60FPS이면 프레임 16.67ms이지만 CPU/GPU 병렬 구간을 단순 합산하지 않는다. 목표 달성 여부는 실제 기기 프레임과 전투 시간 정확성으로 판단한다.

제안 계측 구간명(아직 추가하지 않음): `Combat.InputEncode`, `Combat.JintAdvance`, `Combat.SnapshotEncode`, `Combat.SnapshotParse`, `Presentation.ProjectHero`, `Presentation.SamplePose`, `Presentation.Camera`, `VFX.FirstUse`.

결과 표에는 다음 열을 남긴다: `run_id, code_sha, kernel_sha, asset_sha, device, scene, seed, settings, cold_or_warm, capture_seconds, p50_ms, p95_ms, p99_ms, max_ms, over_33ms, over_50ms, main_ms, render_ms, gpu_ms, worker_ms_per_step, dropped_sim_seconds, snapshot_age_ms, gc_bytes_per_frame, sample_calls, culled_samples, throttled_samples, created_models, reused_models, outcome, evidence_path`.

## 4. 검증과 보고 기준

- 아트·표시만 바꿀 때: P0, 실제 화면 비교, 접지/무기 타격/클립 loop 검사.
- 입력·전투 step·serialization 계약을 바꿀 때: 관련 P1, `npm run test:rpg:stage`, `npm run check:rpg` 및 해당 도메인 검사. 서버 지급/구역 복구 동작은 유지한다.
- 커널 변경 시: `npm run unity:stage:kernel`와 Unity TextAsset 동기화; 서버/APK 해시 호환성 검사.
- concurrency/cancellation/restart를 바꾸며 기존 테스트가 충분하지 않을 때만 저장소의 formal-verify 정책을 검토한다. 문서/소스 보관만으로 실행하지 않는다.
- 보고는 결과 상태, 코드/테스트, 실제 화면/소리, 미검증 범위를 나눈다. 이번 연구 준비의 실제 Unity/Android/게임 실행 결과는 **UNAVAILABLE**이다.
