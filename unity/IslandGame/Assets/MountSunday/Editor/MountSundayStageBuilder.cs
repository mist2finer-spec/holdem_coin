using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.SceneManagement;

namespace MountSunday.Editor {
    public static class MountSundayStageBuilder {
        const string ManifestPath = "Assets/MountSunday/Data/stage.json";
        const string Generated = "Assets/MountSunday/Generated";
        const string ShaderName = "MountSunday/Environment";

        [MenuItem("Tools/Mount Sunday/Build Exploration Scene")]
        public static void BuildExplorationScene() {
            BuildPackage(true);
        }

        [MenuItem("Tools/Mount Sunday/Build Asset Prefabs Only")]
        public static void BuildAssetPrefabsOnly() {
            BuildPackage(false);
        }

        static void BuildPackage(bool createExplorationScene) {
            StageManifest manifest = ReadManifest();
            EnsureCollisionImportSettings(manifest);
            List<string> errors = ValidateManifest(manifest, createExplorationScene);
            if (errors.Count > 0) throw new InvalidOperationException("Mount Sunday preflight failed:\n" + string.Join("\n", errors));
            EnsureFolder(Generated + "/Materials");
            EnsureFolder(Generated + "/Prefabs");
            if (createExplorationScene) EnsureFolder(Generated + "/Scenes");
            var materials = BuildMaterials(manifest);
            var axisCorrection = MountSundayAxisCalibration.Read();
            var prefabs = new Dictionary<string, GameObject>(StringComparer.Ordinal);
            try {
                for (int i = 0; i < manifest.assets.Length; i++) {
                    var asset = manifest.assets[i];
                    EditorUtility.DisplayProgressBar("Mount Sunday", "Preparing " + asset.id, (float)i / manifest.assets.Length * .55f);
                    prefabs.Add(asset.id, BuildPrefab(asset, materials, axisCorrection));
                }
                string scenePath = createExplorationScene ? BuildScene(manifest, prefabs) : null;
                AssetDatabase.SaveAssets();
                AssetDatabase.Refresh();
                if (createExplorationScene) {
                    EditorGUIUtility.PingObject(AssetDatabase.LoadAssetAtPath<SceneAsset>(scenePath));
                    Debug.Log("Mount Sunday scene saved: " + scenePath + ". Double-click it to open. Existing scenes and project settings were not replaced.");
                } else {
                    EditorGUIUtility.PingObject(AssetDatabase.LoadAssetAtPath<UnityEngine.Object>(Generated + "/Prefabs"));
                    Debug.Log("Mount Sunday asset prefabs saved: " + Generated + "/Prefabs. No scene was created and no game integration was performed.");
                }
            } finally { EditorUtility.ClearProgressBar(); }
        }

        [MenuItem("Tools/Mount Sunday/Validate Package")]
        public static void ValidatePackage() {
            StageManifest manifest = ReadManifest();
            List<string> errors = ValidateManifest(manifest, false);
            int renderers = 0, colliders = 0, prefabs = 0;
            long triangles = 0;
            foreach (var asset in manifest.assets ?? Array.Empty<StageAsset>()) {
                if (asset == null || string.IsNullOrWhiteSpace(asset.id)) continue;
                var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(Generated + "/Prefabs/" + SafeName(asset.id) + ".prefab");
                if (!prefab) continue;
                prefabs++;
                renderers += prefab.GetComponentsInChildren<Renderer>(true).Length;
                var shapes = prefab.GetComponentsInChildren<Collider>(true);
                colliders += shapes.Length;
                if (asset.colliderMode != "none" && shapes.Length == 0) errors.Add(asset.id + ": requested collider is missing.");
                if (asset.colliderMode == "none" && shapes.Length > 0) errors.Add(asset.id + ": unexpected collider.");
                foreach (var filter in prefab.GetComponentsInChildren<MeshFilter>(true)) if (filter.sharedMesh) {
                    for (int sub = 0; sub < filter.sharedMesh.subMeshCount; sub++) triangles += (long)filter.sharedMesh.GetIndexCount(sub) / 3;
                }
                foreach (var renderer in prefab.GetComponentsInChildren<Renderer>(true)) foreach (var material in renderer.sharedMaterials)
                    if (!material || !material.shader || ShaderUtil.ShaderHasError(material.shader)) errors.Add(asset.id + ": missing material or shader compilation error.");
                foreach (var collider in shapes.OfType<MeshCollider>()) {
                    if (!collider.sharedMesh) errors.Add(asset.id + ": empty MeshCollider.");
                    else if (!collider.sharedMesh.isReadable) errors.Add(asset.id + ": MeshCollider mesh needs Read/Write for reliable Player cooking.");
                }
            }
            var report = new ValidationReport {
                stageId = manifest.stageId,
                assetDefinitions = manifest.assets?.Length ?? 0,
                instanceCount = manifest.instances?.Length ?? 0,
                routePoints = manifest.route?.Length ?? 0,
                builtPrefabs = prefabs,
                prefabRendererCount = renderers,
                prefabColliderCount = colliders,
                allLodPrefabTriangles = triangles,
                errors = errors.ToArray(),
                editorVersion = Application.unityVersion,
                utc = DateTime.UtcNow.ToString("o")
            };
            try { report.axisCalibration = MountSundayAxisCalibration.Read(); }
            catch (Exception exception) { errors.Add(exception.Message); report.errors = errors.ToArray(); }
            if (prefabs != (manifest.assets?.Length ?? 0)) {
                errors.Add("Generated prefabs are incomplete. Run Build Asset Prefabs Only or Build Exploration Scene first.");
                report.errors = errors.ToArray();
            }
            EnsureFolder(Generated);
            File.WriteAllText(Generated + "/Validation.json", JsonUtility.ToJson(report, true));
            AssetDatabase.Refresh();
            if (errors.Count > 0) Debug.LogError("Mount Sunday validation: " + string.Join("\n", errors));
            else Debug.Log("Mount Sunday manifest/assets PASS. " + prefabs + " built prefabs, " + report.instanceCount + " placements; " + triangles + " triangles across all prefab LODs. This is an asset audit, not a runtime FPS measurement.");
        }

        [Serializable] sealed class ValidationReport {
            public string stageId, editorVersion, utc;
            public int assetDefinitions, instanceCount, routePoints, builtPrefabs, prefabRendererCount, prefabColliderCount;
            public long allLodPrefabTriangles;
            public string[] errors;
            public MountSundayAxisCalibration.Result axisCalibration;
        }

        static StageManifest ReadManifest() {
            var file = AssetDatabase.LoadAssetAtPath<TextAsset>(ManifestPath);
            if (!file) throw new FileNotFoundException("Copy the complete Assets/MountSunday folder into the project. Manifest is missing: " + ManifestPath);
            StageManifest manifest = JsonUtility.FromJson<StageManifest>(file.text);
            if (manifest == null) throw new InvalidDataException("Mount Sunday JSON could not be read.");
            return manifest;
        }

        static List<string> ValidateManifest(StageManifest manifest, bool requireActivePipeline) {
            var errors = new List<string>();
            if (manifest.schemaVersion != 1) errors.Add("Unsupported manifest schema: " + manifest.schemaVersion);
            try { MountSundayAxisCalibration.Read(); }
            catch (Exception exception) { errors.Add(exception.Message); }
            var shader = Shader.Find(ShaderName);
            if (!shader) errors.Add("Missing shader " + ShaderName + ". Unity 6 / URP 17 is required.");
            else if (ShaderUtil.ShaderHasError(shader)) errors.Add("Environment shader has compilation errors. Check Console.");
            if (requireActivePipeline && !(GraphicsSettings.currentRenderPipeline is UniversalRenderPipelineAsset))
                errors.Add("The active quality/project render pipeline is not URP. Select an existing URP 17 pipeline before building. This tool never changes pipeline settings.");
            var ids = new HashSet<string>(StringComparer.Ordinal);
            var materialNames = new HashSet<string>((manifest.materialColors ?? Array.Empty<StageMaterial>()).Where(m => m != null && !string.IsNullOrEmpty(m.name)).Select(m => m.name), StringComparer.Ordinal);
            foreach (var asset in manifest.assets ?? Array.Empty<StageAsset>()) {
                if (asset == null || string.IsNullOrWhiteSpace(asset.id)) { errors.Add("Asset without an id."); continue; }
                if (!ids.Add(asset.id)) errors.Add("Duplicate asset id: " + asset.id);
                if (string.IsNullOrEmpty(asset.modelPath) || !asset.modelPath.StartsWith("Assets/MountSunday/Models/", StringComparison.Ordinal) || asset.modelPath.Contains("..")) errors.Add(asset.id + ": unexpected model path.");
                else {
                    var model = AssetDatabase.LoadAssetAtPath<GameObject>(asset.modelPath);
                    if (!model) errors.Add(asset.id + ": missing/import-failed model " + asset.modelPath);
                    else foreach (var renderer in model.GetComponentsInChildren<Renderer>(true)) foreach (var material in renderer.sharedMaterials)
                        if (!material || !materialNames.Contains(material.name.Replace(" (Instance)", ""))) errors.Add(asset.id + ": material is not declared in materialColors: " + (material ? material.name : "null"));
                    var importer = AssetImporter.GetAtPath(asset.modelPath) as ModelImporter;
                    if (asset.colliderMode == "mesh" && importer != null && !importer.isReadable) errors.Add(asset.id + ": collision model needs Read/Write. Run either Build menu to synchronize import settings.");
                }
                if (asset.colliderMode != "none" && asset.colliderMode != "mesh" && asset.colliderMode != "box") errors.Add(asset.id + ": colliderMode must be none, mesh, or box.");
            }
            if (ids.Count == 0) errors.Add("No model assets.");
            foreach (var instance in manifest.instances ?? Array.Empty<StageInstance>()) {
                if (instance == null) { errors.Add("Null placement."); continue; }
                if (instance.assetId == null || !ids.Contains(instance.assetId)) errors.Add("Unknown placement asset: " + instance.assetId);
                if (!StageVectors.Finite(instance.position) || !StageVectors.Finite(instance.rotation) || !StageVectors.Finite(instance.scale)) errors.Add(instance.name + ": invalid transform.");
                else if (instance.scale.Any(v => v <= 0)) errors.Add(instance.name + ": scale must be positive.");
            }
            foreach (var point in manifest.route ?? Array.Empty<StageWaypoint>()) if (point == null || !StageVectors.Finite(point.position)) errors.Add("Invalid route point.");
            return errors;
        }

        static void EnsureCollisionImportSettings(StageManifest manifest) {
            foreach (var asset in manifest.assets ?? Array.Empty<StageAsset>()) {
                if (asset == null || string.IsNullOrEmpty(asset.modelPath) || !asset.modelPath.StartsWith("Assets/MountSunday/Models/", StringComparison.Ordinal) || asset.modelPath.Contains("..")) continue;
                var importer = AssetImporter.GetAtPath(asset.modelPath) as ModelImporter;
                if (!importer) continue;
                bool readable = asset.colliderMode == "mesh";
                if (importer.isReadable == readable) continue;
                importer.isReadable = readable;
                importer.SaveAndReimport();
            }
        }

        static Dictionary<string, Material> BuildMaterials(StageManifest manifest) {
            var result = new Dictionary<string, Material>(StringComparer.Ordinal);
            Shader shader = Shader.Find(ShaderName);
            foreach (var definition in manifest.materialColors ?? Array.Empty<StageMaterial>()) {
                if (definition == null || string.IsNullOrWhiteSpace(definition.name)) continue;
                string path = Generated + "/Materials/" + SafeName(definition.name) + ".mat";
                var material = AssetDatabase.LoadAssetAtPath<Material>(path);
                if (!material) { material = new Material(shader); AssetDatabase.CreateAsset(material, path); }
                material.shader = shader;
                material.name = definition.name;
                var c = definition.color;
                material.SetColor("_BaseColor", c != null && c.Length >= 3 ? new Color(c[0], c[1], c[2], c.Length > 3 ? c[3] : 1f) : Color.white);
                material.SetFloat("_Roughness", Mathf.Clamp01(definition.roughness));
                material.SetFloat("_VertexColorStrength", 1f);
                string lower = definition.name.ToLowerInvariant();
                bool plant = lower.Contains("grass") || lower.Contains("leaf") || lower.Contains("leaves") || lower.Contains("flower") || lower.Contains("foliage") || lower.Contains("tussock") || lower.Contains("vegetation");
                material.SetFloat("_WindStrength", plant ? .06f : 0f);
                material.SetFloat("_WaterStrength", lower.Contains("water") ? .08f : 0f);
                material.SetFloat("_DetailStrength", lower.Contains("water") ? .03f : .13f);
                material.SetFloat("_DetailScale", lower.Contains("terrain") ? .18f : 2f);
                material.enableInstancing = true;
                if (!string.IsNullOrEmpty(definition.baseColorTexture)) {
                    var texture = AssetDatabase.LoadAssetAtPath<Texture2D>(definition.baseColorTexture);
                    if (texture) material.SetTexture("_BaseMap", texture);
                }
                EditorUtility.SetDirty(material);
                result[definition.name] = material;
            }
            return result;
        }

        static GameObject BuildPrefab(StageAsset asset, Dictionary<string, Material> materials, MountSundayAxisCalibration.Result axisCorrection) {
            var model = AssetDatabase.LoadAssetAtPath<GameObject>(asset.modelPath);
            Scene preview = EditorSceneManager.NewPreviewScene();
            var root = new GameObject(asset.id);
            SceneManager.MoveGameObjectToScene(root, preview);
            try {
                var axes = new GameObject("Imported FBX coordinate correction").transform;
                axes.SetParent(root.transform, false);
                axisCorrection.Apply(axes);
                var geometry = UnityEngine.Object.Instantiate(model, axes, false);
                geometry.name = "Geometry";
                foreach (var collider in root.GetComponentsInChildren<Collider>(true)) UnityEngine.Object.DestroyImmediate(collider);
                foreach (var old in root.GetComponentsInChildren<LODGroup>(true)) UnityEngine.Object.DestroyImmediate(old);
                var renderers = root.GetComponentsInChildren<Renderer>(true);
                foreach (var renderer in renderers) {
                    var assigned = renderer.sharedMaterials;
                    for (int i = 0; i < assigned.Length; i++) if (assigned[i]) {
                        string name = assigned[i].name.Replace(" (Instance)", "");
                        if (materials.TryGetValue(name, out var replacement)) assigned[i] = replacement;
                    }
                    renderer.sharedMaterials = assigned;
                    if (assigned.Any(m => m && ((m.HasProperty("_WindStrength") && m.GetFloat("_WindStrength") > 0) || (m.HasProperty("_WaterStrength") && m.GetFloat("_WaterStrength") > 0)))) {
                        Bounds bounds = renderer.localBounds;
                        bounds.Expand(.3f);
                        renderer.localBounds = bounds;
                        // Static batching rewrites vertices into world space and breaks
                        // the shader's local-height wind anchoring.
                        for (Transform t = renderer.transform; t; t = t.parent) {
                            var flags = GameObjectUtility.GetStaticEditorFlags(t.gameObject);
                            GameObjectUtility.SetStaticEditorFlags(t.gameObject, flags & ~StaticEditorFlags.BatchingStatic);
                            if (t == root.transform) break;
                        }
                    }
                    renderer.shadowCastingMode = asset.category == "distant" || asset.category == "grass" || asset.category == "flower" ? ShadowCastingMode.Off : ShadowCastingMode.On;
                    renderer.receiveShadows = true;
                }
                var levels = new List<Renderer>[] { new List<Renderer>(), new List<Renderer>(), new List<Renderer>() };
                foreach (var renderer in renderers) levels[LodIndex(renderer.transform, root.transform)].Add(renderer);
                if (levels[0].Count == 0) throw new InvalidDataException(asset.id + " has no LOD0 geometry.");
                bool hasLod = levels[1].Count > 0 || levels[2].Count > 0;
                if (hasLod) {
                    var list = new List<LOD>();
                    for (int i = 0; i < 3; i++) if (levels[i].Count > 0) list.Add(new LOD(i == 0 ? .12f : i == 1 ? .045f : .008f, levels[i].ToArray()));
                    var group = root.AddComponent<LODGroup>();
                    group.fadeMode = LODFadeMode.None;
                    group.SetLODs(list.ToArray());
                    group.RecalculateBounds();
                }
                if (asset.colliderMode == "mesh") foreach (var renderer in levels[0]) {
                    var filter = renderer.GetComponent<MeshFilter>();
                    if (filter && filter.sharedMesh) {
                        var collider = renderer.gameObject.AddComponent<MeshCollider>();
                        collider.sharedMesh = filter.sharedMesh;
                        collider.convex = false;
                    }
                }
                else if (asset.colliderMode == "box") {
                    Bounds bounds = LocalBounds(root.transform, levels[0]);
                    if (string.Equals(asset.category, "tree", StringComparison.OrdinalIgnoreCase)) {
                        // The exported tree combines trunk and canopy into one mesh.
                        // Root X/Z is the trunk base; canopy bounds must not block walking.
                        var collider = root.AddComponent<CapsuleCollider>();
                        collider.direction = 1;
                        collider.radius = Mathf.Clamp(bounds.size.y * .035f, .12f, .5f);
                        collider.height = Mathf.Max(collider.radius * 2, Mathf.Min(bounds.size.y * .6f, 6f));
                        collider.center = new Vector3(0, bounds.min.y + collider.height * .5f, 0);
                    } else {
                        var collider = root.AddComponent<BoxCollider>();
                        collider.center = bounds.center;
                        collider.size = bounds.size;
                    }
                }
                return PrefabUtility.SaveAsPrefabAsset(root, Generated + "/Prefabs/" + SafeName(asset.id) + ".prefab");
            } finally {
                UnityEngine.Object.DestroyImmediate(root);
                EditorSceneManager.ClosePreviewScene(preview);
            }
        }

        static int LodIndex(Transform current, Transform root) {
            while (current && current != root) {
                if (current.name.IndexOf("LOD2", StringComparison.OrdinalIgnoreCase) >= 0) return 2;
                if (current.name.IndexOf("LOD1", StringComparison.OrdinalIgnoreCase) >= 0) return 1;
                if (current.name.IndexOf("LOD0", StringComparison.OrdinalIgnoreCase) >= 0) return 0;
                current = current.parent;
            }
            return 0;
        }

        static Bounds LocalBounds(Transform root, IList<Renderer> renderers) {
            var bounds = new Bounds(); bool first = true;
            foreach (var renderer in renderers) {
                Bounds world = renderer.bounds;
                for (int i = 0; i < 8; i++) {
                    Vector3 point = root.InverseTransformPoint(world.center + Vector3.Scale(world.extents, new Vector3((i & 1) == 0 ? -1 : 1, (i & 2) == 0 ? -1 : 1, (i & 4) == 0 ? -1 : 1)));
                    if (first) { bounds = new Bounds(point, Vector3.zero); first = false; } else bounds.Encapsulate(point);
                }
            }
            return bounds;
        }

        static string BuildScene(StageManifest manifest, Dictionary<string, GameObject> prefabs) {
            Scene previous = SceneManager.GetActiveScene();
            Scene scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Additive);
            SceneManager.SetActiveScene(scene);
            try {
                var root = new GameObject("Mount Sunday · exploration stage");
                var groups = new Dictionary<string, Transform>();
                var definitions = manifest.assets.ToDictionary(a => a.id, a => a, StringComparer.Ordinal);
                for (int i = 0; i < manifest.instances.Length; i++) {
                    var placement = manifest.instances[i];
                    string category = definitions[placement.assetId].category ?? "Scenery";
                    if (!groups.TryGetValue(category, out var group)) { group = new GameObject(category).transform; group.SetParent(root.transform, false); groups.Add(category, group); }
                    var instance = (GameObject)PrefabUtility.InstantiatePrefab(prefabs[placement.assetId], scene);
                    instance.name = string.IsNullOrEmpty(placement.name) ? placement.assetId : placement.name;
                    instance.transform.SetParent(group, false);
                    instance.transform.localPosition = StageVectors.Read(placement.position, Vector3.zero);
                    instance.transform.localRotation = Quaternion.Euler(StageVectors.Read(placement.rotation, Vector3.zero));
                    instance.transform.localScale = StageVectors.Read(placement.scale, Vector3.one);
                    if (i % 100 == 0) EditorUtility.DisplayProgressBar("Mount Sunday", "Placing environment", .55f + .4f * i / Mathf.Max(1, manifest.instances.Length));
                }
                var routeObject = new GameObject("Route · designer navigation");
                routeObject.transform.SetParent(root.transform, false);
                var route = routeObject.AddComponent<MountSundayRoute>();
                route.origin = manifest.origin; route.sourceManifest = ManifestPath;
                route.waypoints = new Transform[manifest.route?.Length ?? 0];
                for (int i = 0; i < route.waypoints.Length; i++) {
                    var waypoint = new GameObject((i + 1).ToString("00") + " · " + manifest.route[i].name).transform;
                    waypoint.SetParent(routeObject.transform, false);
                    waypoint.position = StageVectors.Read(manifest.route[i].position, Vector3.zero);
                    route.waypoints[i] = waypoint;
                }
                var sun = new GameObject("Daylight").AddComponent<Light>();
                sun.type = LightType.Directional; sun.color = new Color(1f, .93f, .82f); sun.intensity = 1.35f;
                sun.shadows = LightShadows.Soft; sun.shadowBias = .04f; sun.shadowNormalBias = .3f;
                sun.transform.rotation = Quaternion.Euler(32f, -32f, 0f);
                RenderSettings.sun = sun;
                RenderSettings.ambientMode = AmbientMode.Trilight;
                RenderSettings.ambientSkyColor = new Color(.49f, .60f, .72f);
                RenderSettings.ambientEquatorColor = new Color(.42f, .43f, .35f);
                RenderSettings.ambientGroundColor = new Color(.20f, .20f, .17f);
                RenderSettings.fog = true; RenderSettings.fogMode = FogMode.ExponentialSquared;
                RenderSettings.fogDensity = .00007f; RenderSettings.fogColor = new Color(.63f, .72f, .78f);
                var skyShader = Shader.Find("Skybox/Procedural");
                if (skyShader) {
                    string skyPath = Generated + "/Materials/MS_Sky.mat";
                    var sky = AssetDatabase.LoadAssetAtPath<Material>(skyPath);
                    if (!sky) { sky = new Material(skyShader); AssetDatabase.CreateAsset(sky, skyPath); }
                    sky.SetFloat("_SunSize", .025f); sky.SetFloat("_AtmosphereThickness", .9f); sky.SetFloat("_Exposure", 1.1f);
                    RenderSettings.skybox = sky;
                }
                var explorer = new GameObject("Explorer · Tab toggles walk and flight");
                var controller = explorer.AddComponent<CharacterController>();
                controller.height = 1.8f; controller.radius = .32f; controller.center = new Vector3(0, .9f, 0);
                controller.slopeLimit = 45f; controller.stepOffset = .35f; controller.skinWidth = .03f;
                var cameraObject = new GameObject("Exploration camera");
                cameraObject.transform.SetParent(explorer.transform, false);
                cameraObject.transform.localPosition = new Vector3(0, 1.65f, 0);
                cameraObject.tag = "MainCamera";
                var camera = cameraObject.AddComponent<Camera>();
                camera.nearClipPlane = .2f; camera.farClipPlane = 16000f; camera.fieldOfView = 57f;
                camera.clearFlags = CameraClearFlags.Skybox; camera.allowHDR = true;
                camera.GetUniversalAdditionalCameraData().renderPostProcessing = true;
                cameraObject.AddComponent<AudioListener>();
                var flight = explorer.AddComponent<MountSundayFreeFlight>(); flight.route = route; flight.viewTransform = cameraObject.transform;
                Vector3 start = route.waypoints.Length > 0 ? route.waypoints[0].position : Vector3.zero;
                Vector3 target = route.waypoints.Length > 1 ? route.waypoints[route.waypoints.Length - 1].position : start + Vector3.forward * 300;
                explorer.transform.position = start + Vector3.up * .5f;
                Vector3 facing = target - start; facing.y = 0;
                if (facing.sqrMagnitude > .01f) explorer.transform.rotation = Quaternion.LookRotation(facing);
                var volume = new GameObject("Subtle daylight grading").AddComponent<Volume>(); volume.isGlobal = true;
                string profilePath = Generated + "/DaylightVolume.asset";
                var profile = AssetDatabase.LoadAssetAtPath<VolumeProfile>(profilePath);
                if (!profile) { profile = ScriptableObject.CreateInstance<VolumeProfile>(); AssetDatabase.CreateAsset(profile, profilePath); }
                if (!profile.TryGet<Bloom>(out var bloom)) { bloom = profile.Add<Bloom>(true); AssetDatabase.AddObjectToAsset(bloom, profile); }
                bloom.intensity.Override(.1f); bloom.threshold.Override(1.15f);
                if (!profile.TryGet<Tonemapping>(out var tone)) { tone = profile.Add<Tonemapping>(true); AssetDatabase.AddObjectToAsset(tone, profile); }
                tone.mode.Override(TonemappingMode.ACES);
                EditorUtility.SetDirty(profile); volume.sharedProfile = profile;
                string path = Generated + "/Scenes/MountSunday_Exploration.unity";
                if (!EditorSceneManager.SaveScene(scene, path)) throw new IOException("Could not save generated exploration scene.");
                return path;
            } finally {
                if (previous.IsValid() && previous.isLoaded) SceneManager.SetActiveScene(previous);
                EditorSceneManager.CloseScene(scene, true);
            }
        }

        static string SafeName(string value) {
            return string.Concat(value.Select(c => char.IsLetterOrDigit(c) || c == '_' || c == '-' ? c : '_'));
        }
        static void EnsureFolder(string path) {
            if (AssetDatabase.IsValidFolder(path)) return;
            string parent = Path.GetDirectoryName(path)?.Replace('\\', '/');
            if (string.IsNullOrEmpty(parent)) throw new IOException("Invalid asset directory " + path);
            EnsureFolder(parent);
            AssetDatabase.CreateFolder(parent, Path.GetFileName(path));
        }
    }
}
