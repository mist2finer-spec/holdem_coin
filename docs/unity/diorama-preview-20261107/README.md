# Isolated 3D diorama comparison overlay

This look-development result uses the existing 3D characters and animations. It is an **HD-2D-inspired 3D diorama**, not pixelated character rendering. The artistic reference is [FINAL FANTASY RESONANCE](https://www.jp.square-enix.com/FFRS/). No reference-game assets are copied.

Actual preview project: `C:/Users/SHK/island-contact-diorama-20261107/PreviewProject`. Unity 6000.0.62f1 and URP 17.0.4. The operating project was Built-in at the first comparison and was later integrated with URP after explicit modified-Nilo approval. This overlay is for a **separate copy** of the existing project and its licensed assets; it is not a replacement for the minimal Git Unity project or the operating combat delta.

`Assets/DioramaPreview` contains three comparison scenes, persistent lighting and disabled Volume presets, five surface-role materials, separate reviewable surface masks, corrected ground textures and a terrain-data copy with unchanged heights. Original GLBs, animation clips and source textures are preserved. Mask generation reads the five material presets. The color-region masks are an editable starting point, not hand-painted semantic segmentation; inspect seams/armor/skin during the user’s device follow-up.

`PreviewOnlyRuntime` contains the isolated preview's camera/readability and fixed-pose helpers. **Do not overwrite operating combat code with these files.** They are based on the pre-contact preview copy. Any approved integration must merge the helper changes into the current combat implementation.

Use `Island > Diorama > Create or repair comparison scenes`. Repeated setup reuses scene roots, cameras, profiles and assets. Scene/component/material edits use Undo. `Restore previous pipeline` restores saved project and per-quality pipeline assignments. It does not delete authored source assets. `Regenerate separate surface masks` and `Generate separate ground palette` recreate only preview derivatives. No YAML editing is used.

The stage reuses one BattleCameraController and the existing authored environment/lights. It never adds another camera/terrain controller to the operating scene. Camera presets and optional occluder protection are preview-only. Material clones are cached and restored on teardown; original shared materials are not changed. No runtime mesh baking or global timeScale changes are used.

All first comparisons disable outline, Rim, Bloom, DOF, vignette and camera shake. For the first comparison all presets were inactive; the final approved preview enables only Bloom 0.10. The stage exposes individual switches and a low-quality switch that disables background post effects/fog first. Preview controls cycle the three views, Lit/Nilo materials and movement; the base-review menu does not turn on post effects.

The modified Nilo public educational example is pinned to [fbe276e0df1d1f9379e13581c20b6a080a1a6977](https://github.com/ColinLeung-NiloCat/UnityURPToonLitShaderExample/tree/fbe276e0df1d1f9379e13581c20b6a080a1a6977). MIT LICENSE and attribution are preserved under `Shaders/NiloReference`. It is distinct from the separate commercial NiloToonURP product. This implementation adds actual metallic/smoothness specular response, environment reflection, directional ambient and optional directional Rim. Nilo has no normal-map path here; URP Lit was the initial default comparison candidate; modified Nilo is the approved final selection.

Evidence includes same-pose/camera captures for forest side view, boss quarter view and a dark area. Capture videos are low-rate review recordings, not FPS measurements. The user approved modified Nilo; weak Bloom was then measured and integrated in the operating scene. The first-comparison evidence remains unchanged. See the main task report for current approval/deployment status and measured costs.

## Android 미리보기 빌드

`Tools/PreparePreviewBuild.cs`를 `script run`의 `PreparePreviewBuild.Main`으로 실행한다. 세 씬을 다시 확인하고 실제 사용하는 Lit/Nilo/Terrain/Unlit/AlphaClip 변형을 참조하는 템플릿을 저장해 Android shader stripping을 방지한다. `MeasurePreview.cs`는 동일한 세 장면의 이동 비용을 기록한다. 결과는 `Evidence/preview-cost.json`, 중복 생성 및 파이프라인 복원 결과는 `Evidence/preview-setup.json`에 있다.

미리보기 APK 패키지는 `com.mist2finer.islandgame.diorama.preview`로 전투 앱과 함께 설치할 수 있다. 하단 버튼으로 숲/보스/어두운 장면, Lit/Nilo, 이동/정지, Rim을 비교한다. 승인 후 최종 미리보기는 수정 Nilo + 약한 Bloom으로 시작하며 DOF/Vignette는 계속 OFF다.
