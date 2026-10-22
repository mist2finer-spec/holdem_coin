# RPG 에셋 라이브러리

`assets/rpg-library`는 에셋 작업 전용 브랜치입니다. 실행 중인 홀덤/사냥 프로토타입은 `main` 브랜치를 사용합니다. 이 폴더는 웹 공개 경로인 `public/`와 분리되어 있습니다.

개별 이미지 3,902개와 Spine 파츠 4,526개, Spine 세트 170개를 정리했습니다. [검증 결과와 호환성 참고](VALIDATION.md)를 확인하세요.

## 다른 AI에게 전달할 시작점

1. 이 README와 [AI 작업 지침](AGENTS.md)을 읽습니다.
2. [분류별 미리보기](PREVIEWS.md)에서 대상을 고릅니다.
3. [개별 파일 색인](catalog/assets.csv) 또는 [갤러리 색인](catalog/gallery.json)에서 정확한 경로를 찾습니다. `parts/` 분류에는 Spine 파츠가 있습니다.
4. 캐릭터는 [Spine 색인](catalog/spine.json)에서 `skeleton`, `atlas`, `pages`, `skins`, `animations`, `parts`를 확인합니다.
5. 원하는 파일만 수정하여 같은 브랜치에 커밋하거나 별도의 작업 브랜치를 만듭니다. 게임에 채택할 파일만 이후 `main`의 `public/rpg/` 등에 복사합니다.

GitHub에서 `assets/rpg-library` 브랜치를 반드시 선택하세요. 이미지 미리보기는 GitHub에서 열 수 있으며, 전체 파일을 AI 프롬프트에 넣을 필요가 없습니다.

## 폴더

| 경로 | 내용 |
|---|---|
| `characters/heroes/` | 영웅의 Spine 원본, 아틀라스 PNG, 개별 파츠 |
| `characters/enemies/` | 적 캐릭터와 파츠 |
| `characters/npcs/` | NPC와 파츠 |
| `characters/objects/` | 기타 Spine 오브젝트 |
| `maps/backgrounds/` | 배경·타일·구성 레이어 |
| `maps/backgrounds/*.face-*.png` | 반사 큐브맵의 개별 면 이미지 |
| `maps/lightmaps/` | Unity 라이팅 텍스처 |
| `effects/textures/` | 이펙트 텍스처 |
| `ui/portraits/`, `ui/skills/`, `ui/items/`, `ui/icons/` | 초상화·스킬·아이템·기타 아이콘 |
| `ui/uicommon/`, `ui/uipopup/` | 버튼·프레임·패널 및 UI 데이터의 이미지 |
| `geometry/` | 추출 가능한 메시 OBJ. Unity 재질·트랜스폼은 별도 메타데이터 참조 |
| `misc/` | 폰트·로그인·기타 이미지, 텍스트, 기타 데이터 |
| `metadata/<번들분류>/<Unity타입>.zip` | 모든 Unity 오브젝트의 개별 JSON 메타데이터 |
| `sources/` | 원본 번들. 입력 ZIP 안의 파일과 SHA-256 동일 |
| `catalog/` | 개별 파일·전체 오브젝트·출처·오류·해시 색인 |
| `previews/` | 페이지별 컨택트 시트 JPG |

원본 텍스처와 Unity Sprite는 별도로 유지합니다. 겹치는 이미지라도 서로 다른 Unity 오브젝트이므로 함부로 병합하지 않았습니다. 일반 텍스처의 영역을 임의로 잘라 아이콘이라고 추정하지 않습니다. Unity Sprite는 메타데이터로, Spine 파츠는 아틀라스의 정확한 영역으로 분리했습니다.

## 검색과 개별 오브젝트 확인

저장소 루트에서 Python 표준 라이브러리만으로 실행할 수 있습니다.

```bash
python scripts/rpg/asset_tool.py find Hero_Axe01 --limit 10
python scripts/rpg/asset_tool.py find SkillIcon --type Texture2D --limit 20
python scripts/rpg/asset_tool.py metadata 'find 명령이 반환한 정확한 id'
python scripts/rpg/asset_tool.py verify
```

- 동일 이름이 여러 개일 수 있습니다. 정확한 식별자는 `bundle:serialized_file:path_id`입니다.
- `catalog/<번들분류>.jsonl`은 **모든 Unity 오브젝트**를 한 줄에 하나씩 기록합니다. 각 행의 `metadata.archive`와 `metadata.member`로 해당 개별 JSON만 읽을 수 있습니다.
- Unity PathID는 JavaScript에서 정밀도를 잃지 않도록 문자열로 취급하세요. 메타데이터 안의 안전 범위를 넘는 정수도 문자열이며, 비유한 실수는 `$float` 태그로 보존합니다.
- 메타데이터 ZIP은 파일 수가 과도하게 늘어나는 것을 방지하는 묶음입니다. 내부에는 오브젝트마다 별도 JSON이 있습니다. 파싱할 수 없는 타입은 `tree_error`와 원시 바이트를 보존합니다.
- 텍스처·텍스트·폰트의 대용량 페이로드는 메타데이터에서 `$source_payload`로 원본 오브젝트와 추출 파일을 참조합니다. 전체 원시 데이터는 `sources/`에 보존됩니다.

## 로컬 이미지 검색 화면

```bash
python -m http.server 8080 --directory rpg-assets
```

브라우저에서 `http://localhost:8080/gallery.html`을 엽니다. 검색 결과를 200개씩 표시하며 이미지 클릭 시 개별 PNG를 엽니다. GitHub 파일 보기 자체는 HTML을 실행하지 않으므로 GitHub에서는 `PREVIEWS.md`를 사용하세요.

## 재추출

```bash
python -m pip install -r scripts/rpg/requirements-assets.txt
python scripts/rpg/export_library.py '/path/to/asset bundle.zip' --output rpg-assets-new
```

출력 폴더가 이미 있으면 중단합니다. 기존 파일과 입력 번들을 덮어쓰지 않습니다. 갤러리 생성기는 저장소의 `rpg-assets` 경로를 사용합니다.

```bash
python scripts/rpg/build_asset_catalog.py
python scripts/rpg/seal_asset_library.py
python scripts/rpg/asset_tool.py verify
node scripts/rpg/check-library-spine.mjs
```

## 사용 시 유의점

- Spine 파츠 PNG만으로 원래 애니메이션을 재현할 수 없습니다. 스켈레톤 JSON의 메시·웨이트·본·스킨과 아틀라스를 함께 사용하세요. 실제 버전은 각 `spine-manifest.json`에 있습니다.
- `parts/`의 PNG는 패킹 회전을 해제하고 원래 여백을 복원한 편집용 이미지입니다. 회전·영역·오프셋·원본 크기는 매니페스트에 남깁니다. 패킹된 원본 페이지도 그대로 보존합니다.
- 배경 텍스처는 완성된 맵이 아닐 수 있습니다. 씬 구성과 타일·UV·재질은 Unity 메타데이터를 참고하세요.
- ParticleSystem, Shader, Animator, Prefab 등은 Unity 데이터입니다. JSON 추출은 웹 실행 코드로 변환한 것이 아닙니다.
- 큐브맵 PNG는 원본 면 번호를 유지하며 HDR/압축 소스의 표시용 디코딩 결과입니다. 원래 정밀도·밉맵은 번들에 보존됩니다.
- `catalog/errors.json`의 미지원·실패 기록을 확인하세요. 원본 보존과 렌더 가능한 추출은 서로 구분됩니다.
- 원본 에셋의 이용·재배포 권리는 제공자의 라이선스를 따릅니다. 이 정리는 새로운 이용 허가를 부여하지 않습니다. Spine 런타임 라이선스는 `../public/rpg/SPINE-RUNTIME-LICENSE.txt`를 확인하세요.
