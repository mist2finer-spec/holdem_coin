# 이미지/게임 에셋 AI 작업 지침

- 이 브랜치는 RPG 에셋 정리 및 이미지 작업용이다. 우선 README.md와 catalog/summary.json, catalog/errors.json을 읽는다.
- 추정 파일명 대신 catalog/assets.csv, catalog/gallery.json, catalog/spine.json으로 실제 경로를 찾는다.
- 파일명 뒤 식별자는 충돌 방지용이다. 사람이 읽는 이름은 색인의 name 필드에 있다.
- sources/는 원본이다. 수정하지 않는다. catalog의 object id 및 출처를 잃지 않는다.
- 캐릭터별 spine-manifest.json의 skeleton, atlas, pages가 애니메이션 입력 세트다. parts는 편집용 보조 자료이며, 단일 이미지가 완성된 캐릭터라고 가정하지 않는다.
- 스킨/무기 파츠를 바꾸면 스켈레톤의 attachment 경로와 아틀라스 영역 이름을 유지하거나 재패킹한 아틀라스도 함께 제공한다.
- Unity Sprite와 Spine region은 정확한 메타데이터로 분리된 것이다. 일반 텍스처의 빈 공간을 추측해 자동 분할하지 않는다.
- 이미지 변형 결과는 원본을 보존하고 별도 작업 폴더에 작성한다. 출처와 적용 캐릭터, 변경 내역을 기록한다.
- 게임 반영은 필요한 결과 파일만 main의 실행 경로에 추가한다. 이 전체 아카이브를 public/에 복사하지 않는다.
- 에셋 작업 때문에 홀덤 배팅 로직, 환경변수, Render 설정을 변경하지 않는다.
- 비밀키, 계정 토큰, 플레이어 로그를 에셋 문서나 커밋에 넣지 않는다.
