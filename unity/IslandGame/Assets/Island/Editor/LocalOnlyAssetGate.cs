using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace IslandGame.Editor {
 // Local-only asset gate: assets under the git-excluded folder (extracted-reference derived material)
 // may go into a Development test build only. A release build (not Development, or ISLAND_RELEASE defined)
 // that would carry any of them fails before anything is built.
 // This tracked file knows the folder by its path string only (no GUID, no type from that folder).
 public sealed class LocalOnlyAssetGate : IPreprocessBuildWithReport, IPostprocessBuildWithReport {
  public const string Prefix = "Assets/LocalRev2Reconstruction/";
  public const string ReleaseDefine = "ISLAND_RELEASE";
  static string Root => Path.GetFullPath(Path.Combine(Application.dataPath, "../../../../../"));
  static string BuildDir => Path.Combine(Root, "maintenance/rev2-android-port-20261119/build");
  // Where a real build writes its list. A build script may point this elsewhere.
  public static string OutputPath = Path.Combine(BuildDir, "local-only-assets.json");

  public int callbackOrder => -1000;

  public sealed class Item { public string path, kind, type, via; public long bytes; }
  public sealed class Verdict {
   public string utc, mode, result; public bool development, releaseDefine; public string[] defines, reasons, scenes;
   public int localOnlyCount; public long localOnlyBytes; public Dictionary<string, object> byKind; public Item[] items;
   public int localScriptsCompiledIntoPlayer; public int rootsChecked;
  }

  // ---- evaluation (pure: collects and judges, writes nothing) ----
  public static bool IsLocalOnly(string path) => !string.IsNullOrEmpty(path) && path.Replace('\\', '/').StartsWith(Prefix, StringComparison.OrdinalIgnoreCase);
  static bool InResources(string p) => ("/" + p).IndexOf("/Resources/", StringComparison.OrdinalIgnoreCase) >= 0;

  static string Kind(string path, string type = null) {
   if (type == "AnimationClip") return "clip"; if (type == "Mesh") return "mesh"; if (type == "Texture2D") return "texture";
   switch (Path.GetExtension(path).ToLowerInvariant()) {
    case ".anim": return "clip"; case ".fbx": case ".obj": case ".blend": case ".mesh": case ".glb": case ".gltf": return "mesh";
    case ".png": case ".jpg": case ".jpeg": case ".tga": case ".psd": case ".exr": case ".tif": return "texture";
    case ".mat": return "material"; case ".prefab": return "prefab"; case ".unity": return "scene";
    case ".shader": case ".shadergraph": case ".hlsl": case ".cginc": return "shader";
    case ".cs": return "script"; case ".controller": case ".overridecontroller": case ".mask": return "animator";
    case ".asset": return "asset"; default: return "other";
   }
  }

  public static Verdict Evaluate(string[] scenes, bool development, IEnumerable<string> defines, string mode) {
   var defs = (defines ?? Enumerable.Empty<string>()).Where(d => !string.IsNullOrWhiteSpace(d)).Select(d => d.Trim()).Distinct().ToArray();
   bool releaseDefine = defs.Contains(ReleaseDefine);
#if ISLAND_RELEASE
   releaseDefine = true;
#endif
   // Roots: each build scene, and the contents of every Resources folder grouped by folder.
   var groups = new List<KeyValuePair<string, string[]>>();
   foreach (var s in scenes) groups.Add(new KeyValuePair<string, string[]>("scene:" + s, new[] { s }));
   var resources = AssetDatabase.GetAllAssetPaths().Where(p => p.StartsWith("Assets/", StringComparison.Ordinal) && InResources(p) && !AssetDatabase.IsValidFolder(p)).ToArray();
   foreach (var g in resources.GroupBy(p => p.Substring(0, p.IndexOf("/Resources/", StringComparison.OrdinalIgnoreCase) + "/Resources".Length)))
    groups.Add(new KeyValuePair<string, string[]>("resources:" + g.Key, g.ToArray()));
   var found = new Dictionary<string, Item>(StringComparer.OrdinalIgnoreCase);
   foreach (var g in groups)
    foreach (var d in AssetDatabase.GetDependencies(g.Value, true)) {
     if (!IsLocalOnly(d)) continue;
     if (found.TryGetValue(d, out var known)) { if (!known.via.Split('|').Contains(g.Key)) known.via += "|" + g.Key; continue; }
     var full = Path.Combine(Path.GetDirectoryName(Application.dataPath), d);
     var type = AssetDatabase.GetMainAssetTypeAtPath(d)?.Name ?? "?";
     found[d] = new Item { path = d, kind = Kind(d, type), type = type, via = g.Key, bytes = File.Exists(full) ? new FileInfo(full).Length : 0 };
    }
   var items = found.Values.OrderBy(i => i.kind).ThenBy(i => i.path, StringComparer.Ordinal).ToArray();
   // Code in the folder outside Editor folders compiles into the player (no asmdef). Reported, not judged:
   // it is project-written code, not extracted material. A scene that references it shows up above as a dependency.
   int scripts = AssetDatabase.GetAllAssetPaths().Count(p => IsLocalOnly(p) && p.EndsWith(".cs", StringComparison.OrdinalIgnoreCase) && ("/" + p).IndexOf("/Editor/", StringComparison.OrdinalIgnoreCase) < 0);
   bool release = !development || releaseDefine;
   var reasons = new List<string>();
   if (!development) reasons.Add("not a Development build");
   if (releaseDefine) reasons.Add(ReleaseDefine + " is defined");
   string result;
   if (release && items.Length > 0) { result = "FAIL"; reasons.Add($"release build would carry {items.Length} local-only asset(s) under {Prefix}"); }
   else if (items.Length > 0) { result = "PASS"; reasons.Add($"test build: {items.Length} local-only asset(s) allowed (Development, no {ReleaseDefine}); do not distribute this build"); }
   else { result = "PASS"; reasons.Add("no local-only assets reached"); }
   return new Verdict {
    utc = DateTime.UtcNow.ToString("o"), mode = mode, result = result, development = development, releaseDefine = releaseDefine, defines = defs,
    reasons = reasons.ToArray(), scenes = scenes, localOnlyCount = items.Length, localOnlyBytes = items.Sum(i => i.bytes), items = items,
    byKind = items.GroupBy(i => i.kind).OrderBy(g => g.Key).ToDictionary(g => g.Key, g => (object)new { count = g.Count(), bytes = g.Sum(i => i.bytes) }),
    localScriptsCompiledIntoPlayer = scripts, rootsChecked = scenes.Length + resources.Length,
   };
  }

  static string[] EnabledScenes() => EditorBuildSettings.scenes.Where(s => s.enabled).Select(s => s.path).ToArray();
  static string[] Defines(NamedBuildTarget t) => PlayerSettings.GetScriptingDefineSymbols(t).Split(new[] { ';', ',' }, StringSplitOptions.RemoveEmptyEntries);

  static void Write(string path, JObject o) { Directory.CreateDirectory(Path.GetDirectoryName(path)); File.WriteAllText(path, o.ToString(Formatting.Indented)); }
  static JObject Read(string path) { try { return File.Exists(path) ? JObject.Parse(File.ReadAllText(path)) : new JObject(); } catch (Exception) { return new JObject(); } }

  // ---- check-only paths (no build): judge the current build scenes as if releasing / as a test build ----
  public static string CheckAssumingRelease() => Check(false, "check-assume-release");
  public static string CheckAssumingTest() => Check(true, "check-assume-test");
  static string Check(bool development, string mode) {
   var v = Evaluate(EnabledScenes(), development, Defines(NamedBuildTarget.Android), mode);
   var path = Path.Combine(BuildDir, $"gate-{mode}.json");
   Write(path, JObject.FromObject(v));
   var line = $"[LocalOnlyAssetGate] {mode}: {v.result} — {string.Join("; ", v.reasons)} (count {v.localOnlyCount}, {v.localOnlyBytes} bytes) -> {path}";
   if (v.result == "FAIL") Debug.LogWarning(line); else Debug.Log(line);
   return line;
  }
  [MenuItem("Island/Local-Only Gate/Check (assume release build)")] static void MenuRelease() => CheckAssumingRelease();
  [MenuItem("Island/Local-Only Gate/Check (assume test build)")] static void MenuTest() => CheckAssumingTest();

  // ---- build callbacks ----
  public void OnPreprocessBuild(BuildReport report) {
   var s = report.summary;
   bool development = (s.options & BuildOptions.Development) != 0;
   var scenes = EditorBuildSettings.scenes.Where(e => e.enabled).Select(e => e.path).ToArray();
   var v = Evaluate(scenes, development, Defines(NamedBuildTarget.FromBuildTargetGroup(s.platformGroup)), "build");
   var o = JObject.FromObject(v); o["output"] = s.outputPath; o["platform"] = s.platform.ToString();
   Write(OutputPath, o);
   var line = $"[LocalOnlyAssetGate] build: {v.result} — {string.Join("; ", v.reasons)} -> {OutputPath}";
   if (v.result == "FAIL") throw new BuildFailedException(line);
   Debug.Log(line);
  }

  public void OnPostprocessBuild(BuildReport report) { try { RecordPacked(report, "postprocess"); } catch (Exception ex) { Debug.LogWarning("[LocalOnlyAssetGate] packed record skipped: " + ex.Message); } }

  // Counts what the build really packed (BuildReport.packedAssets) and adds it to the same file.
  public static JObject RecordPacked(BuildReport report, string stage) {
   var packed = report.packedAssets ?? new PackedAssets[0];
   ulong total = 0; var local = new List<(string path, string type, ulong size, string file)>();
   foreach (var pa in packed) foreach (var c in pa.contents) { total += c.packedSize; if (IsLocalOnly(c.sourceAssetPath)) local.Add((c.sourceAssetPath, c.type != null ? c.type.Name : "?", c.packedSize, pa.shortPath)); }
   var o = new JObject {
    ["stage"] = stage, ["utc"] = DateTime.UtcNow.ToString("o"), ["packedFiles"] = packed.Length, ["packedBytesAll"] = (long)total,
    ["localOnlyObjects"] = local.Count, ["localOnlyBytes"] = (long)local.Aggregate(0UL, (a, x) => a + x.size),
    ["localOnlySourceAssets"] = local.Select(x => x.path).Distinct().Count(),
    ["byType"] = JObject.FromObject(local.GroupBy(x => x.type).OrderByDescending(g => g.Aggregate(0UL, (a, x) => a + x.size)).ToDictionary(g => g.Key, g => new { count = g.Count(), bytes = (long)g.Aggregate(0UL, (a, x) => a + x.size) })),
    ["byKind"] = JObject.FromObject(local.GroupBy(x => Kind(x.path, x.type)).OrderBy(g => g.Key).ToDictionary(g => g.Key, g => new { objects = g.Count(), bytes = (long)g.Aggregate(0UL, (a, x) => a + x.size) })),
    ["bySourceAsset"] = JArray.FromObject(local.GroupBy(x => x.path).Select(g => new { path = g.Key, objects = g.Count(), bytes = (long)g.Aggregate(0UL, (a, x) => a + x.size), types = string.Join(",", g.Select(x => x.type).Distinct()) }).OrderByDescending(x => x.bytes)),
   };
   if (packed.Length == 0) o["note"] = "packedAssets empty at this stage";
   var file = Read(OutputPath); file["packed"] = o; Write(OutputPath, file);
   return o;
  }
 }
}
