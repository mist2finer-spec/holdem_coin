# RPG 오디오 연결 — 2026-11-11

- 사용자 제공 bgm 폴더의 네 mp3 원본을 Resources/RpgAudio로 복사했다. Stage_1_bgm은 일반 미궁 반복 BGM이며 보스 구역에서 정지한다. 기존 로비/포커 음악은 RPG 진입 시 일시정지하고 이탈 시 복구한다.
- lightning_1_bgm / waterball_1_bgm은 VFX와 같은 presentation clock의 motion.start+hitAt에서 1회 재생한다. 입력 거절/취소/시전 대기 중에는 재생하지 않는다. 시전 duration 변경 시 기본 duration 대비 pitch를 조정하고 늦은 프레임은 오디오 위치도 보정한다. 음원의 자연스러운 잔향은 유지한다.
- RPG uGUI 입력 및 메뉴, 기존 RPG IMGUI 버튼은 button_2_bgm을 사용한다. 같은 프레임의 중복 이벤트는 한 번만 재생한다. 기존 음소거와 일시정지를 따른다.
- BGM Streaming, 효과음 CompressedInMemory / Vorbis 0.75. 새 오디오 믹서는 만들지 않았다.
- Unity 컴파일 PASS. Editor 일반 BGM playing=true 및 버튼 AudioSource 재생 확인. 물/번개 선택, hitAt 이전 무음, 중복 방지, 2배 시전 pitch2 및 idle null 처리 검사 PASS. 백그라운드 Editor 프레임 정지로 실제 스킬 검증은 최종 Android9 BlueStacks 설치본에서 수행했다: 기존 AUTO/HUD 8/8 PASS, 오류0, 스킬 오디오 이벤트2, 마지막 음원 lightning_1_bgm.
- 버전0.1.0-test.20261111.7 / 2026111107, ARM64 개발 APK. ZIP/서명/16KB 정렬 PASS. SHA256 4d493d067484e7781760df1e7edf06c6181f93c7e11ddc417f6e5ec50d8fd32a. 빌드 G:\holdem_coin-workspace\island\builds\IslandGame-RpgAudio-20261111.apk.
- 실제 스피커 청음·실물 휴대폰 음량 밸런스는 미검증. AudioSource 실행/클립/시전 이벤트 연결을 검증했다.
