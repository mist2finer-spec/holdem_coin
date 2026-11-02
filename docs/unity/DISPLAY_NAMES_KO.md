# Unity 표시 이름 정리

적용 범위는 Unity 전용 표시 계층이다. 원본 TypeScript 카탈로그, 저장 ID, 태그, 수치, 효과, 획득처, 정복자 저장값은 바꾸지 않는다. `UnityDisplayNames`는 원본 카탈로그를 복제한 뒤 이름과 일부 주얼 설명의 호칭만 치환한다. 서버 응답과 명령에는 기존 ID를 그대로 쓴다.

PDF의 낯선 인물명과 길어진 수식어를 줄이고, 실제 태그와 효과를 먼저 알아볼 수 있게 정리했다. 엘리야의 불·생명의 숨·파수꾼·믿음처럼 짧고 알아보기 쉬운 이미지는 유지했다. 보조 에르텔은 발동 조건과 역할이 바로 드러나도록 이름을 붙였다. 성경 구절이나 새로운 설정 설명을 게임 효과에 덧붙이지 않았다.

예를 들어 `가죽띠 관통 → 꿰뚫는 화살`, `석판의 가속 → 빠른 재사용`, `성령의 영감 → 마나 절약`, `영육 통합 → 마나 보호`, `신비의 전지 → 마나 전환`이다. `fireball`은 실제로 화염 투사체이므로 PDF의 `불기둥`을 `화염탄`으로 고쳤고, `shaper_storm`은 현재 냉기 효과이므로 `서리 조율`로 정리했다. 단순 번역이나 길이 축약만 하지 않고 실제 효과와 어긋난 이름도 바로잡았다. 원래도 이해하기 쉬운 이름은 유지했다.

## 대조 결과

| 구분 | PDF 정의 | 실제 적용 |
| --- | ---: | --- |
| 액티브 | 35 | 35개 ID |
| 보조 | 30 | 30개 ID |
| 주요 노드 | 60 | 템플릿 60개 → 실제 `attr_*` 노드 181개 |
| 핵심 노드 | 25 | `keystone_` 접두사 포함 25개 ID |
| 주얼 | 29 | 영원 주얼 5 + 대형 군주얼 9 + 고유 주얼 15 |
| 합계 | 179 | PDF 정의 179개 모두 확인 |

PDF에 없는 중형 8·소형 9·일반 3종도 같은 화면에서 보이므로 표시 이름을 추가했다. 대형 군주얼 내부 주요 노드 27개와 정복자 표시명 15개, 영원 주얼 변환 결과 이름 12개도 함께 정리했다. 이 추가 항목은 PDF의 179개 합계에 포함하지 않는다.

매칭 실패 항목은 없다. 다만 PDF의 식별자를 그대로 런타임 키로 쓰면 주요 노드 60개와 핵심 노드 25개가 적용되지 않는다. `bloodless`와 `adders_touch`는 주요 노드와 핵심 노드 양쪽에 있으므로 범위를 구분했다. 주요 노드는 원본 생성 규칙의 영역/순번과 이름을 함께 검증하여 실제 ID에 연결했다. 번호 접미사는 유지한다.

PDF의 액티브 소제목은 앞부분 18/뒷부분 17로 적혀 있지만 표의 실제 행은 앞부분 17/뒷부분 18이다. 총 35개는 일치한다. 일부 핵심 노드의 실제 원본 이름에 있는 `· Adapted`와 곡선 따옴표도 확인했다. 아래 “기존 이름”은 PDF의 축약 표기 대신 실제 소스 값을 사용한다.

정복자 배열은 교체하지 않는다. 예를 들어 저장된 `Doryani`는 계속 `Doryani`이며 UI에만 `가인`으로 나온다. `Kongs`의 PDF 표시 제안 `여부대`는 `요나단`으로 정리했다. 주얼 이름, 정복자 이름과 독립적인 변환 규칙은 기존 값을 그대로 따른다.

## 액티브 35종

| ID | 기존 이름 | PDF 제안 | Unity 표시 이름 |
| --- | --- | --- | --- |
| `rift` | 대지 균열 | 창세의 균열 | 창세 균열 |
| `dark` | 암흑 구체 | 심연의 구체 | 심연 구체 |
| `frost` | 서리 폭풍 | 만나의 서리 | 서리바람 |
| `holy` | 빛의 심판 | 영광의 심판 | 빛의 심판 |
| `whirl` | 회오리 | 광야의 회오리 | 광야 회오리 |
| `heal` | 회복 | 치유의 은사 | 치유 |
| `cleave` | 쪼개기 | 언약의 도끼 | 넓게 베기 |
| `earthquake` | 지진 | 시내산 진동 | 산울림 |
| `lacerate` | 열상 | 채찍의 상처 | 깊은 상처 |
| `doublestrike` | 이중 타격 | 두 증인의 일격 | 두 번 베기 |
| `bladestorm` | 칼날 폭풍 | 세라핌의 칼날 | 칼날 소용돌이 |
| `moltenstrike` | 용암 타격 | 유황불 타격 | 유황불 타격 |
| `lightningstrike` | 번개 타격 | 시내산 번개 | 번개 일격 |
| `splitarrow` | 분할 화살 | 베릴 화살 | 갈래 화살 |
| `piercingshot` | 관통 사격 | 가죽띠 관통 | 꿰뚫는 화살 |
| `chainarrow` | 연쇄 화살 | 아론 싹의 연쇄 | 이어지는 화살 |
| `frostshot` | 얼음 사격 | 만나 화살 | 서리 화살 |
| `fireball` | 화염구 | 불기둥 | 화염탄 |
| `icespear` | 얼음 창 | 롱기누스의 창 | 서리 창 |
| `spark` | 전기불꽃 | 오순절 불꽃 | 번개 불씨 |
| `arc` | 연쇄 번개 | 시온의 번개 | 시온 번개 |
| `flameburst` | 화염 폭발 | 유다 횃불 | 횃불 폭발 |
| `icenova` | 얼음 폭발 | 새벽 서리 | 서리 파동 |
| `stormcall` | 폭풍 부름 | 폭풍 우심 | 천둥 부름 |
| `essence` | 정수 흡수 | 생명나무 정수 | 심연의 침식 |
| `contagion` | 전염 | 나아만 전염 | 퍼지는 저주 |
| `blight` | 황폐 | 땅의 저주 | 땅의 저주 |
| `toxicrain` | 맹독 화살비 | 독화살 비 | 독화살 비 |
| `viperstrike` | 독사 타격 | 에덴의 뱀 | 독니 베기 |
| `firestorm` | 불의 폭풍 | 엘리야의 불 | 엘리야의 불 |
| `vitality` | 활력 | 생명의 숨 | 생명의 숨 |
| `hatred` | 증오 | 에서의 분노 | 서리 오라 |
| `moltenshell` | 용암 방패 | 방패의 불 | 불의 방패 |
| `steelskin` | 강철 피부 | 골리앗의 갑옷 | 철갑 |
| `heraldstorm` | 폭풍 전령 | 사자의 폭풍 | 번개 전령 |

## 보조 30종

| ID | 기존 이름 | PDF 제안 | Unity 표시 이름 |
| --- | --- | --- | --- |
| `power` | 강타 | 권능의 강타 | 강한 일격 |
| `wide` | 광역 | 광야의 광역 | 넓은 범위 |
| `echo` | 메아리 | 예언의 메아리 | 메아리 |
| `quick` | 가속 | 석판의 가속 | 빠른 재사용 |
| `reach` | 도달 | 복음의 도달 | 넓은 타격 |
| `renew` | 재생 | 거듭남의 재생 | 치유 강화 |
| `melee` | 근접 물리 | 골리앗의 근접 | 근접 강화 |
| `brutality` | 포악함 | 삼손의 포악 | 물리 전념 |
| `spellpower` | 제어된 파괴 | 솔로몬의 지혜 | 주문 강화 |
| `elemental` | 원소 집중 | 자연의 원소 | 원소 강화 |
| `chaos` | 공허 조작 | 무의 공허 | 심연 강화 |
| `multistrike` | 연속 타격 | 여리고의 연속 | 연속 타격 |
| `volley` | 다중 투사체 | 사자의 다중 | 갈래 발사 |
| `barrage` | 일제 사격 | 기드온 300 | 집중 사격 |
| `chain` | 연쇄 | 다윗의 연쇄 | 연쇄 |
| `pierce` | 관통 | 롱기누스 관통 | 관통 |
| `swift` | 고통 격화 | 순교의 고통 | 고통 응축 |
| `duration` | 지속시간 증가 | 영원의 지속 | 오래 지속 |
| `poison` | 중독 | 독사의 중독 | 독 상처 |
| `bleed` | 출혈 | 상처의 출혈 | 출혈 |
| `burn` | 연소 | 횃불의 연소 | 불붙이기 |
| `critical` | 치명타 증가 | 운명의 치명 | 치명 강화 |
| `precision` | 정밀 공격 | 시편의 정밀 | 정밀 타격 |
| `leech` | 생명력 흡수 | 피의 흡수 | 생명 흡수 |
| `efficient` | 영감 | 성령의 영감 | 마나 절약 |
| `concentrate` | 효과 집중 | 명상의 집중 | 좁게 집중 |
| `fortify` | 방어 상승 | 기드온 방패 | 보호막 획득 |
| `triggerclock` | 주기적 시전 | 절기 시전 | 주기 발동 |
| `triggercrit` | 치명타 시 시전 | 시험 시 시전 | 치명타 발동 |
| `triggerhurt` | 피격 시 시전 | 순교 시 시전 | 피격 발동 |

## 힘 주요 노드 20종

템플릿 ID를 표기한다. 실제 저장 ID 대응은 뒤의 표에 정리했다.

| 템플릿 ID | 기존 이름 | PDF 제안 | Unity 표시 이름 |
| --- | --- | --- | --- |
| `heart_warrior` | Heart of the Warrior | 다윗의 심장 | 용사의 심장 |
| `sentinel` | Sentinel | 파수꾼 | 파수꾼 |
| `bloodless` | Bloodless | 무혈의 언약 | 생명의 맹세 |
| `berserking` | Berserking | 삼손의 광기 | 삼손의 맹공 |
| `warriors_path` | Warrior's Path | 용사의 길 | 용사의 길 |
| `golems_blood` | Golem's Blood | 골리앗의 피 | 생명의 샘 |
| `butchery` | Butchery | 학살 | 거센 일격 |
| `cleaving` | Cleaving | 언약의 도끼 | 갈라내기 |
| `juggernaut` | Juggernaut | 철의 전사 | 철갑 수호 |
| `barbarism` | Barbarism | 야만 | 불굴 |
| `slaughter` | Slaughter | 아말렉 학살 | 질풍 베기 |
| `master_arena` | Master of Arena | 경기장 승리자 | 넓은 칼날 |
| `art_gladiator` | Art of Gladiator | 검투사의 기술 | 민첩한 검술 |
| `gladiator` | Gladiator | 검투사 | 공방 숙련 |
| `soldier` | Soldier | 군인 | 방패 병사 |
| `iron_grip` | Iron Grip | 철의 손아귀 | 힘센 사수 |
| `retribution` | Retribution | 보응 | 빛의 보응 |
| `purity` | Purity | 정결 | 정결 |
| `consecration` | Consecration | 성별 | 성역 수호 |
| `faith` | Faith | 믿음 | 믿음 |

## 민첩 주요 노드 20종

템플릿 ID를 표기한다. 실제 저장 ID 대응은 뒤의 표에 정리했다.

| 템플릿 ID | 기존 이름 | PDF 제안 | Unity 표시 이름 |
| --- | --- | --- | --- |
| `fleetness` | Fleetness | 사슴의 발 | 사슴걸음 |
| `panther` | Aspect of Panther | 표범의 형상 | 표범의 몸놀림 |
| `hunters_gambit` | Hunter's Gambit | 담무스의 계략 | 사냥꾼의 한 수 |
| `herbalism` | Herbalism | 약초학 | 약초 지식 |
| `survivalist` | Survivalist | 광야 생존자 | 광야 생존 |
| `void_arrow` | Void Arrow | 공허의 화살 | 속사 |
| `primal_spirit` | Primal Spirit | 원시 영 | 맑은 정신 |
| `wolf` | Heart of the Wolf | 베냐민의 이리 | 이리의 추격 |
| `celerity` | Celerity | 신속 | 재빠른 손발 |
| `avoidance` | Avoidance | 회피 | 위험 감지 |
| `rangers_path` | Ranger's Path | 순찰자의 길 | 사수의 길 |
| `adders_touch` | Adder's Touch | 독사의 손길 | 급소 포착 |
| `fangs_frost` | Fangs of Frost | 서리의 송곳니 | 서리 송곳니 |
| `void_shadow` | Void Shadow | 공허의 그림자 | 심연의 장막 |
| `assassin` | Assassin | 요압 | 정밀한 일격 |
| `cruel_preparation` | Cruel Preparation | 잔혹한 준비 | 강인한 준비 |
| `shadowstalker` | Shadowstalker | 그림자 추적자 | 그림자 추적 |
| `projectile_tactician` | Projectile Tactician | 투사체 전술가 | 숙련된 사격 |
| `prolonged_pain` | Prolonged Pain | 연장된 고통 | 오랜 고통 |
| `acrobatics_path` | Acrobatics Path | 곡예의 길 | 유연한 몸 |

## 지능 주요 노드 20종

템플릿 ID를 표기한다. 실제 저장 ID 대응은 뒤의 표에 정리했다.

| 템플릿 ID | 기존 이름 | PDF 제안 | Unity 표시 이름 |
| --- | --- | --- | --- |
| `arcane_will` | Arcane Will | 신비의 의지 | 지혜의 방패 |
| `deep_wisdom` | Deep Wisdom | 솔로몬의 지혜 | 솔로몬의 지혜 |
| `blood_siphon` | Blood Siphon | 피의 사이펀 | 강인한 생명 |
| `sacrifice` | Sacrifice | 그리스도의 희생 | 헌신의 주문 |
| `dreamer` | Dreamer | 요셉의 꿈 | 꿈의 샘 |
| `mystic_bulwark` | Mystic Bulwark | 신비의 방벽 | 마나의 샘 |
| `lord_arcana` | Lord of Arcana | 신비의 주인 | 주문 방벽 |
| `mind_drinker` | Mind Drinker | 지성의 샘 | 정신 회복 |
| `endbringer` | Endbringer | 종결자 | 퍼지는 주문 |
| `witchs_lament` | Witch's Lament | 예루살렘 애가 | 애가 |
| `discipline` | Discipline | 훈련 | 정신 단련 |
| `devotion` | Devotion | 헌신 | 헌신 |
| `arcane_bond` | Arcane Bond | 신비의 언약 | 주문 결속 |
| `sanctuary` | Sanctuary | 지성소 | 성소 |
| `defiance` | Defiance | 항거 | 원소 방벽 |
| `strong_arm` | Strong Arm | 여호와의 팔 | 강한 팔 |
| `versatility` | Versatility | 다재다능 | 균형 감각 |
| `hybrid` | Hybrid Notable | 혼합 | 어우러진 힘 |
| `resourcefulness` | Resourcefulness | 자원 활용 | 마나 순환 |
| `heretical_ward` | Heretical Ward | 이단의 방어 | 신비의 장막 |

## 핵심 노드 25종

ID 열은 실제 저장 ID다.

| 실제 ID | 기존 이름 | PDF 제안 | Unity 표시 이름 |
| --- | --- | --- | --- |
| `keystone_resolute_technique` | Resolute Technique | 굳건한 기술 | 굳건한 일격 |
| `keystone_vaal_pact` | Vaal Pact | 피의 언약 | 흡혈의 언약 |
| `keystone_bloodless` | Bloodless Covenant | 무혈 언약 | 생명의 언약 |
| `keystone_iron_reflexes` | Iron Reflexes | 철의 반사 | 철갑 전환 |
| `keystone_avatar_fire` | Avatar of Fire | 불의 현현 | 불의 화신 |
| `keystone_acrobatics` | Acrobatics | 곡예 | 공격 회피 |
| `keystone_phase_acrobatics` | Phase Acrobatics | 위상 곡예 | 주문 회피 |
| `keystone_far_shot` | Far Shot | 원투 | 원거리 집중 |
| `keystone_endless_munitions` | Endless Munitions | 무한 투척 | 추가 발사 |
| `keystone_phase_run` | Phase Run | 위상 질주 | 신속한 걸음 |
| `keystone_chaos_inoculation` | Chaos Inoculation | 혼돈 면역 | 혼돈 면역 |
| `keystone_mind_over_matter` | Mind Over Matter | 영육 통합 | 마나 보호 |
| `keystone_eldritch_battery` | Eldritch Battery | 신비의 전지 | 마나 전환 |
| `keystone_pain_attunement` | Pain Attunement | 고통 조율 | 위기의 주문 |
| `keystone_blood_magic` | Zealous Oath · Blood Magic | 피의 맹세 | 피의 맹세 |
| `keystone_overleech` | Slayer Recovery | 승리자 회복 | 왕성한 회복 |
| `keystone_culling_strike` | Culling Strike | 마무리 일격 | 마무리 일격 |
| `keystone_gladiator_block` | Gladiator Block | 검투사 막기 | 검투 수비 |
| `keystone_elemental_overload` | Elemental Overload | 원소 과부하 | 원소 폭주 |
| `keystone_piercing_faith` | Constitution of Faith · Adapted | 믿음의 체질 | 원소 정밀 |
| `keystone_adders_touch` | Adder’s Touch | 독사의 손길 | 치명타 위력 |
| `keystone_shaper_storm` | Shaper of Storm · Adapted | 폭풍의 조율사 | 서리 조율 |
| `keystone_elemental_equilibrium` | Elemental Equilibrium · Adapted | 원소 균형 | 원소 균형 |
| `keystone_bastion_hope` | Bastion of Hope · Adapted | 희망의 보루 | 희망의 보루 |
| `keystone_ancestral_guard` | Ancestral Guard | 조상의 수호 | 수호의 맹세 |

## PDF 주얼 29종

대형 군주얼의 ID는 PDF에서 생략되어 있어 실제 소스에서 확인했다.

| ID | 기존 이름 | PDF 제안 | Unity 표시 이름 |
| --- | --- | --- | --- |
| `lethalpride` | Lethal Pride | 치명적 긍지 | 용사의 긍지 |
| `brutalrestraint` | Brutal Restraint | 잔혹한 절제 | 광야의 절제 |
| `militantfaith` | Militant Faith | 전투적 신앙 | 사제의 믿음 |
| `eleganthubris` | Elegant Hubris | 우아한 교만 | 왕의 교만 |
| `gloriousvanity` | Glorious Vanity | 영광의 허영 | 태초의 변환 |
| `axemancluster` | Axeman's Cluster | 도끼잡이의 무리 | 도끼의 길 |
| `strikercluster` | Striker's Cluster | 타격자의 무리 | 맹공의 길 |
| `rangercluster` | Ranger's Cluster | 순찰자의 무리 | 사냥꾼의 길 |
| `archercluster` | Archer's Cluster | 궁수의 무리 | 궁수의 길 |
| `critcluster` | Crit Master's Cluster | 치명타 장인의 무리 | 치명의 길 |
| `guardiancluster` | Guardian's Cluster | 수호자의 무리 | 수호자의 길 |
| `elementalistcluster` | Elementalist's Cluster | 원소술사의 무리 | 원소의 길 |
| `arcanecluster` | Arcane's Cluster | 비전술사의 무리 | 주문의 길 |
| `hybridcluster` | Hybrid's Cluster | 혼합가의 무리 | 균형의 길 |
| `prismatic` | Prismatic Jewel | 무지개 진주 | 무지개 진주 |
| `splitpersonality` | Split Personality | 분열된 인격 | 여정의 생명 |
| `watcherseye` | Watcher’s Eye | 파수꾼의 눈 | 파수꾼의 눈 |
| `forbiddenflame` | Forbidden Flame | 금단의 불꽃 | 금단의 불꽃 |
| `forbiddenflesh` | Forbidden Flesh | 금단의 육신 | 금단의 육신 |
| `bluepearl` | The Blue Pearl | 큰 진주 | 정화 진주 |
| `fortitudecovenant` | The Fortitude Covenant | 인내의 언약 | 인내의 언약 |
| `emberheart` | Ember Heart | 불씨의 심장 | 불씨의 심장 |
| `frostmemory` | Frost Memory | 서리의 기억 | 서리의 기억 |
| `stormglass` | Storm Glass | 폭풍의 유리 | 번개 수정 |
| `ironpromise` | Iron Promise | 철의 약속 | 철의 약속 |
| `fleetstep` | Fleet Step | 사슴의 발 | 사슴의 발 |
| `voidseed` | Void Seed | 공허의 씨앗 | 심연의 씨앗 |
| `arcanepearl` | Arcane Pearl | 비전 진주 | 마나 진주 |
| `warriorsvow` | Warrior's Vow | 용사의 맹세 | 용사의 맹세 |

## 정복자 표시명 15개

명령과 저장값에는 첫 번째 표시 열의 기존 키를 그대로 사용한다.

| 주얼 ID | 기존 저장 키 | PDF 제안 | Unity 표시 이름 |
| --- | --- | --- | --- |
| `lethalpride` | `Kaom` | 사울 | 사울 |
| `lethalpride` | `Rakanoth` | 다윗 | 다윗 |
| `lethalpride` | `Kongs` | 여부대 | 요나단 |
| `brutalrestraint` | `Asenath` | 이스마엘 | 이스마엘 |
| `brutalrestraint` | `Balbala` | 미디안 | 미디안 |
| `brutalrestraint` | `Nasima` | 에서 | 에서 |
| `militantfaith` | `Avarus` | 아론 | 아론 |
| `militantfaith` | `Dominus` | 레위 | 레위 |
| `militantfaith` | `Maxarius` | 멜기세덱 | 멜기세덱 |
| `eleganthubris` | `Caspiro` | 솔로몬 | 솔로몬 |
| `eleganthubris` | `Cadiro` | 느부갓네살 | 느부갓네살 |
| `eleganthubris` | `Victario` | 바로 | 바로 |
| `gloriousvanity` | `Doryani` | 가인 | 가인 |
| `gloriousvanity` | `Atziri` | 아벨 | 아벨 |
| `gloriousvanity` | `Xibaqua` | 아담 | 아담 |

## 대형 군주얼 주요 노드 27개

이 항목들은 독립 ID가 없으므로 주얼 ID와 기존 이름을 함께 키로 쓴다. `—`는 PDF의 예시 표에서 생략한 항목이다.

| 주얼 ID | 기존 이름 | PDF 제안 | Unity 표시 이름 |
| --- | --- | --- | --- |
| `axemancluster` | Battle-Scarred | 전투의 흉터 | 전장의 흔적 |
| `axemancluster` | Eye of the Storm | — | 번개 강타 |
| `axemancluster` | Karui Legion | 이스라엘 군단 | 용사의 행진 |
| `strikercluster` | Whirlwind | 광야의 회오리 | 광야 회오리 |
| `strikercluster` | Herald of Ash Grant | 재의 전령 | 횃불의 전령 |
| `strikercluster` | Crit Master | — | 치명 숙련 |
| `rangercluster` | Cat Ritual | 사자의 의식 | 사냥의 축복 |
| `rangercluster` | Hunter's Eye | 사냥꾼의 눈 | 사냥꾼의 눈 |
| `rangercluster` | Vulture Flight | — | 독수리 비상 |
| `archercluster` | Arrow Storm | 화살 폭풍 | 화살 폭풍 |
| `archercluster` | Far Sight | — | 먼 시야 |
| `archercluster` | Rain of Arrows | 화살비 | 화살비 |
| `critcluster` | Assassin's Mark | 암살자의 표식 | 치명의 화살 |
| `critcluster` | Nightstalker | 야행성 | 밤의 추적자 |
| `critcluster` | Deadly Strike | — | 치명타 단련 |
| `guardiancluster` | Sigil of Power | 능력의 인장 | 수호 인장 |
| `guardiancluster` | Fortify Eternal | — | 불굴의 성벽 |
| `guardiancluster` | Bastion | 보루 | 보루 |
| `elementalistcluster` | Elemental Mastery | — | 원소 숙련 |
| `elementalistcluster` | Stormcaller | 폭풍 부름자 | 천둥 부름자 |
| `elementalistcluster` | Fireheart | 불의 심장 | 불의 심장 |
| `arcanecluster` | Arcane Surge Grant | 비전 쇄도 부여 | 주문 축복 |
| `arcanecluster` | Mana Shield | — | 마나 방패 |
| `arcanecluster` | Spell Echo | 주문 메아리 | 주문 메아리 |
| `hybridcluster` | Adaptive Force | 적응의 힘 | 어우러진 힘 |
| `hybridcluster` | Versatility Master | 다재 다능가 | 만능 수련 |
| `hybridcluster` | Hybrid Fury | — | 기민한 맹공 |

## PDF 밖의 기존 주얼 20종

| ID | 기존 이름 | Unity 표시 이름 |
| --- | --- | --- |
| `cursecluster` | Curse · Ruin Cluster | 저주의 길 |
| `lifecluster` | Life Recovery Cluster | 회복의 길 |
| `manacluster` | Mana Recovery Cluster | 마나의 길 |
| `dotcluster` | Damage over Time Cluster | 침식의 길 |
| `criticalcluster` | Critical Cluster | 정밀의 길 |
| `elementalcluster` | Elemental Cluster | 원소 조각 |
| `wardcluster` | Arcane Ward Cluster | 장막의 길 |
| `battlecluster` | Battle Bond Cluster | 결전의 길 |
| `smalllife` | Life Small | 생명 조각 |
| `smallmana` | Mana Small | 마나 조각 |
| `smallresist` | Resist Small | 저항 조각 |
| `smallevasion` | Evasion Small | 회피 조각 |
| `smallarmour` | Armour Small | 철갑 조각 |
| `smallshield` | Energy Shield Small | 보호막 조각 |
| `smallstr` | Strength Small | 힘 조각 |
| `smalldex` | Dexterity Small | 민첩 조각 |
| `smallint` | Intelligence Small | 지혜 조각 |
| `crimson` | Crimson Jewel | 붉은 보석 |
| `silver` | Silver Jewel | 은빛 보석 |
| `cobalt` | Cobalt Jewel | 푸른 보석 |

## 영원 주얼 변환 결과 이름

기존 노드 ID를 유지하면서 효과가 바뀐 서버 응답은 원래의 기본 노드 이름으로 덮어쓰지 않는다. 변환 결과 이름을 먼저 확인하고, 알 수 없는 결과는 원문을 표시한다.

| 기존 결과 이름 | Unity 표시 이름 |
| --- | --- |
| Kaom's Will | 왕의 의지 |
| Karui Warpath | 용사의 진군 |
| Karui Fury | 용사의 맹공 |
| Asenath's Heart | 광야의 심장 |
| Maraketh Dance | 모래춤 |
| Desert Precision | 사막의 조준 |
| Avarus's Gambit | 사제의 결단 |
| Templar Doctrine | 신앙의 가르침 |
| Devoted Faith | 헌신의 믿음 |
| Caspiro's Frenzy | 왕의 격정 |
| Emperor’s Ambition | 왕의 야망 |
| Eternal Splendour | 영원의 광채 |

`Doryani · 기본 이름`, `Atziri · 기본 이름`, `Xibaqua · 기본 이름` 형식은 각각 `가인`, `아벨`, `아담` 접두사와 해당 기본 노드의 표시 이름으로 변환한다. 변환 결과 설명은 서버가 계산한 실제 효과 설명을 그대로 쓴다.

## 주요 노드 템플릿과 실제 ID 대응

| 템플릿 ID | 실제 노드 ID |
| --- | --- |
| `heart_warrior` | `attr_6_0`, `attr_1_20`, `attr_6_40` |
| `sentinel` | `attr_0_1`, `attr_6_21`, `attr_0_41` |
| `bloodless` | `attr_1_2`, `attr_6_2`, `attr_0_22`, `attr_1_42`, `attr_6_42` |
| `berserking` | `attr_0_3`, `attr_1_23`, `attr_6_23`, `attr_0_43` |
| `warriors_path` | `attr_1_4`, `attr_6_4`, `attr_0_24`, `attr_1_44`, `attr_6_44` |
| `golems_blood` | `attr_0_5`, `attr_6_5`, `attr_1_25`, `attr_0_45`, `attr_6_45` |
| `butchery` | `attr_1_6`, `attr_0_26`, `attr_6_26`, `attr_1_46` |
| `cleaving` | `attr_6_7`, `attr_1_27`, `attr_6_47` |
| `juggernaut` | `attr_0_8`, `attr_1_28`, `attr_6_28`, `attr_0_48` |
| `barbarism` | `attr_1_9`, `attr_6_9`, `attr_0_29`, `attr_1_49`, `attr_6_49` |
| `slaughter` | `attr_0_10`, `attr_1_30`, `attr_6_30`, `attr_0_50` |
| `master_arena` | `attr_1_11`, `attr_0_31` |
| `art_gladiator` | `attr_0_12`, `attr_6_12`, `attr_1_32` |
| `gladiator` | `attr_1_13`, `attr_0_33`, `attr_6_33` |
| `soldier` | `attr_6_14`, `attr_0_34` |
| `iron_grip` | `attr_0_15`, `attr_1_35`, `attr_6_35` |
| `retribution` | `attr_1_16`, `attr_6_16`, `attr_0_36` |
| `purity` | `attr_0_17`, `attr_1_37`, `attr_6_37` |
| `consecration` | `attr_1_18`, `attr_0_38` |
| `faith` | `attr_0_19`, `attr_6_19`, `attr_1_39` |
| `fleetness` | `attr_2_0`, `attr_3_20`, `attr_7_20`, `attr_2_40` |
| `panther` | `attr_3_1`, `attr_7_1`, `attr_2_21`, `attr_3_41`, `attr_7_41` |
| `hunters_gambit` | `attr_3_22`, `attr_7_22` |
| `herbalism` | `attr_2_3`, `attr_7_3`, `attr_3_23`, `attr_2_43`, `attr_7_43` |
| `survivalist` | `attr_3_4`, `attr_2_24`, `attr_7_24`, `attr_3_44` |
| `void_arrow` | `attr_2_5`, `attr_3_25`, `attr_2_45` |
| `primal_spirit` | `attr_3_6`, `attr_7_6`, `attr_2_26`, `attr_3_46`, `attr_7_46` |
| `wolf` | `attr_2_7`, `attr_3_27`, `attr_7_27`, `attr_2_47` |
| `celerity` | `attr_3_8`, `attr_7_8`, `attr_3_48`, `attr_7_48` |
| `avoidance` | `attr_2_29`, `attr_7_29` |
| `rangers_path` | `attr_2_10`, `attr_7_10`, `attr_3_30`, `attr_2_50` |
| `adders_touch` | `attr_3_11`, `attr_2_31`, `attr_7_31` |
| `fangs_frost` | `attr_2_12`, `attr_3_32` |
| `void_shadow` | `attr_3_13`, `attr_7_13`, `attr_2_33` |
| `assassin` | `attr_2_14`, `attr_3_34`, `attr_7_34` |
| `cruel_preparation` | `attr_3_15`, `attr_7_15` |
| `shadowstalker` | `attr_2_36`, `attr_7_36` |
| `projectile_tactician` | `attr_2_17`, `attr_7_17`, `attr_3_37` |
| `prolonged_pain` | `attr_3_18`, `attr_2_38`, `attr_7_38` |
| `acrobatics_path` | `attr_2_19`, `attr_3_39`, `attr_7_39` |
| `arcane_will` | `attr_4_0`, `attr_5_20`, `attr_4_40` |
| `deep_wisdom` | `attr_5_1`, `attr_4_21`, `attr_5_41` |
| `blood_siphon` | `attr_4_2`, `attr_5_22`, `attr_4_42` |
| `sacrifice` | `attr_5_3`, `attr_5_43` |
| `dreamer` | `attr_4_24` |
| `mystic_bulwark` | `attr_4_5`, `attr_5_25`, `attr_4_45` |
| `lord_arcana` | `attr_5_6`, `attr_4_26`, `attr_5_46` |
| `mind_drinker` | `attr_4_7`, `attr_5_27`, `attr_4_47` |
| `endbringer` | `attr_5_8`, `attr_4_28`, `attr_5_48` |
| `witchs_lament` | `attr_4_9`, `attr_5_29`, `attr_4_49` |
| `discipline` | `attr_5_10`, `attr_4_50` |
| `devotion` | `attr_5_11`, `attr_4_31` |
| `arcane_bond` | `attr_4_12`, `attr_5_32` |
| `sanctuary` | `attr_5_13`, `attr_4_33` |
| `defiance` | `attr_4_14`, `attr_5_34` |
| `strong_arm` | `attr_5_15`, `attr_4_35` |
| `versatility` | `attr_4_16`, `attr_5_36` |
| `hybrid` | `attr_4_17` |
| `resourcefulness` | `attr_5_18`, `attr_4_38` |
| `heretical_ward` | `attr_4_19`, `attr_5_39` |

## 적용과 검증

- 표시 데이터: `unity/IslandGame/Assets/Island/Resources/UnityDisplayNames.json`
- C# 표시 계층: `unity/IslandGame/Assets/Island/Runtime/UnityDisplayNames.cs`
- 카탈로그·PDF 대상 검증: `node scripts/unity/validate_names.mjs`
- C# 계약 검증: `scripts/unity/contracts/DisplayNameChecks.cs` (기존 계약 실행기에 포함)

카탈로그 검증은 실제 세 소스 파일을 읽어 35/30/60/25/29 정의의 ID와 타입별 범위를 확인한다. 실제 생성된 주요 노드 181개와 핵심 노드 25개, 주얼 49종, 변종 15개, 군주얼 주요 노드 27개의 대응을 검사한다. 원본 수치·태그·효과·저장 키와 기존 설명 수치를 대조하며, 중복 키·빈 표시명·누락·오래된 런타임 ID를 실패로 처리한다.

C# 계약 검증은 원본 객체 불변, 이름 이외 필드 불변, 정복자 배열 불변, 알 수 없는 ID의 원문 유지, 변환 노드와 군주얼 노드 표시를 검사한다. Unity Editor/Play Mode 실행은 별도 환경에서 필요하며 여기서 실행했다고 간주하지 않는다. 이 변경은 표시 계층이며 동시성·프로토콜·효과 규칙을 바꾸지 않아 형식 검증은 적용하지 않는다.

2026-11-02 검증 결과: `validate_names.mjs` 2,671개 검사 통과. 실제 .NET 8 + Newtonsoft.Json으로 실행한 전체 C# 계약 검증도 58개 검사 통과했으며 표시 이름 계약을 포함한다. C# 구문 검사도 통과했다. Unity Editor 실행 결과는 포함하지 않는다.

## 공개 범위 조정

GitHub 자동 승인 검토가 대용량 파생 카탈로그의 추가 공개를 거부하여, `RpgCatalog.json`은 기존 공개 버전과 바이트 단위로 동일하게 유지한다. 기존 스킬/보조/트리 표시명 적용과49종 주얼 이름 사전은 포함한다. 주얼 이름은 기존 공개 TypeScript 소스와 대조하며 새 주얼 수치 배열의 Unity 스냅샷 공개는 보류한다. 이 경계를 검사 성공으로 숨기지 않는다. 보스 시험은 별도 `bosses.json`을 쓰므로 영향을 받지 않는다.
