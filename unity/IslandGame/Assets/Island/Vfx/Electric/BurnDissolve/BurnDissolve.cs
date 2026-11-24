using System;
using System.Collections.Generic;
using UnityEngine;

namespace IslandVfx
{
    // Electric "burning death" for monsters and bosses (technical-artist, 2026-11-23). Presentation only.
    //
    //   var run = BurnDissolve.Play(monsterVisualRoot, 1.2f);            // all renderers under the root
    //   var run = BurnDissolve.Play(renderers, 1.2f, null, () => Destroy(monsterVisualRoot));
    //
    // While running, every material slot of each renderer is swapped for an "Island/Vfx/Burn Dissolve" instance that copies the
    // original _BaseMap (or _MainTex/_BaseTexture) and _BaseColor (or _Color). At the end the renderers are disabled and their
    // original materials put back (style flags), then onComplete runs. Keep the GameObjects alive for `seconds`.
    // Works with URP/Lit (slime), Island/Diorama Soft Nilo (boss) and LocalRev2/Cel; their outline passes are not drawn while burning.
    [Serializable]
    public sealed class BurnStyle
    {
        [Range(0, 1)] public float heightWeight = .6f;       // 0 = random patches, 1 = strictly bottom -> top
        public float noiseCellsPerHeight = 7f;               // noise grain relative to the target height (clamped 2.5..12 cells per metre)
        [Range(.01f, .5f)] public float edgeWidth = .11f;
        [ColorUsage(false, true)] public Color edge = new Color(1.3f, .35f, 3.6f);
        [ColorUsage(false, true)] public Color hot = new Color(2.2f, 1.2f, 4.0f);
        public Color charColor = new Color(.07f, .03f, .11f);
        public bool disableRenderersAtEnd = true;
        public bool restoreMaterialsAtEnd = true;
        public bool clearPropertyBlocks = true;              // hit-flash property blocks would tint the burn material
        public bool unscaledTime;
        public static readonly BurnStyle Default = new BurnStyle();
    }

    public sealed class BurnDissolveRun
    {
        internal readonly List<Renderer> renderers = new List<Renderer>();
        internal readonly List<Material[]> originals = new List<Material[]>();
        internal readonly List<Material> owned = new List<Material>();
        internal BurnStyle style;
        internal float seconds, elapsed;
        internal Action onComplete;
        public float Progress { get; private set; }
        public bool Finished { get; private set; }
        public int RendererCount => renderers.Count;

        static readonly int ProgressId = Shader.PropertyToID("_Progress"), HeightId = Shader.PropertyToID("_HeightRange"), NoiseId = Shader.PropertyToID("_NoiseScale");

        /// Sets the burn amount directly (0 intact .. 1 gone). Used by Play's driver; also usable for captures and tests.
        public void SetProgress(float value)
        {
            if (Finished) return;
            Progress = Mathf.Clamp01(value);
            bool any = false; float minY = float.PositiveInfinity, maxY = float.NegativeInfinity;
            foreach (var r in renderers) { if (!r) continue; var b = r.bounds; minY = Mathf.Min(minY, b.min.y); maxY = Mathf.Max(maxY, b.max.y); any = true; }
            if (!any) return;
            float height = Mathf.Max(.05f, maxY - minY);
            float noise = Mathf.Clamp(style.noiseCellsPerHeight / height, 2.5f, 12f);
            var range = new Vector4(minY, maxY, 0, 0);
            foreach (var m in owned) { m.SetFloat(ProgressId, Progress); m.SetVector(HeightId, range); m.SetFloat(NoiseId, noise); }
        }

        /// Ends now: restores materials / disables renderers per style, then runs onComplete once.
        public void Complete()
        {
            if (Finished) return;
            for (int i = 0; i < renderers.Count; i++)
            {
                var r = renderers[i]; if (!r) continue;
                if (style.restoreMaterialsAtEnd) r.sharedMaterials = originals[i];
                if (style.disableRenderersAtEnd) r.enabled = false;
            }
            Release(); var cb = onComplete; onComplete = null; cb?.Invoke();
        }

        /// Stops without hiding: original materials back, renderers left as they are, no callback.
        public void Cancel()
        {
            if (Finished) return;
            for (int i = 0; i < renderers.Count; i++) if (renderers[i]) renderers[i].sharedMaterials = originals[i];
            onComplete = null; Release();
        }

        void Release()
        {
            Finished = true; BurnDissolve.Forget(this);
            foreach (var m in owned) if (m) { if (Application.isPlaying) UnityEngine.Object.Destroy(m); else UnityEngine.Object.DestroyImmediate(m); }
            owned.Clear();
        }

        internal void Tick(float dt)
        {
            elapsed += dt; SetProgress(seconds <= 0 ? 1 : elapsed / seconds);
            if (elapsed >= seconds) Complete();
        }
    }

    public static class BurnDissolve
    {
        public const string TemplateResource = "ElectricVfx/BurnDissolve";
        static Material template;
        static readonly List<BurnDissolveRun> active = new List<BurnDissolveRun>();
        static BurnDissolveDriver driver;
        static readonly int BaseMapId = Shader.PropertyToID("_BaseMap"), BaseColorId = Shader.PropertyToID("_BaseColor"), CullId = Shader.PropertyToID("_Cull");
        static readonly int EdgeWidthId = Shader.PropertyToID("_EdgeWidth"), EdgeId = Shader.PropertyToID("_EdgeColor"), HotId = Shader.PropertyToID("_EdgeHot"), CharId = Shader.PropertyToID("_CharColor"), HeightWeightId = Shader.PropertyToID("_HeightWeight");

        public static int ActiveCount => active.Count;

        /// Burns every MeshRenderer/SkinnedMeshRenderer under root (enabled ones only).
        public static BurnDissolveRun Play(GameObject root, float seconds = 1.2f, BurnStyle style = null, Action onComplete = null)
        {
            var list = new List<Renderer>();
            if (root) foreach (var r in root.GetComponentsInChildren<Renderer>(false)) if ((r is MeshRenderer || r is SkinnedMeshRenderer) && r.enabled) list.Add(r);
            return Play(list, seconds, style, onComplete);
        }

        public static BurnDissolveRun Play(IList<Renderer> renderers, float seconds = 1.2f, BurnStyle style = null, Action onComplete = null)
        {
            var run = Prepare(renderers, style); run.seconds = Mathf.Max(0, seconds); run.onComplete = onComplete;
            if (run.RendererCount == 0) { run.Complete(); return run; }
            active.Add(run); EnsureDriver(); return run;
        }

        /// Swaps materials and returns a run at progress 0 that only moves when SetProgress is called (no driver).
        public static BurnDissolveRun Prepare(IList<Renderer> renderers, BurnStyle style = null)
        {
            var run = new BurnDissolveRun { style = style ?? BurnStyle.Default };
            var tpl = Template();
            if (renderers == null || !tpl) return run;
            var seen = new HashSet<Renderer>();
            foreach (var r in renderers)
            {
                if (!r || !seen.Add(r)) continue;
                // A renderer already burning in another run keeps that run.
                if (IsBurning(r)) continue;
                var source = r.sharedMaterials; int slots = source.Length;
                Mesh mesh = r is SkinnedMeshRenderer smr ? smr.sharedMesh : r.TryGetComponent<MeshFilter>(out var mf) ? mf.sharedMesh : null;
                if (mesh) slots = Mathf.Min(slots, Mathf.Max(1, mesh.subMeshCount)); // extra slots (outline shells) are dropped while burning
                var mats = new Material[slots];
                for (int i = 0; i < slots; i++) { mats[i] = Make(tpl, source[i], run.style); run.owned.Add(mats[i]); }
                run.renderers.Add(r); run.originals.Add(source);
                if (run.style.clearPropertyBlocks) r.SetPropertyBlock(null);
                r.sharedMaterials = mats;
            }
            run.SetProgress(0);
            return run;
        }

        public static bool IsBurning(Renderer r) { foreach (var run in active) if (run.renderers.Contains(r)) return true; return false; }

        static Material Template()
        {
            if (!template) template = Resources.Load<Material>(TemplateResource);
            return template;
        }

        static Material Make(Material tpl, Material source, BurnStyle s)
        {
            var m = new Material(tpl) { name = (source ? source.name : "none") + " · burn" };
            if (source)
            {
                Texture tex = null; Vector2 scale = Vector2.one, offset = Vector2.zero;
                foreach (var n in new[] { "_BaseMap", "_MainTex", "_BaseTexture" })
                    if (source.HasProperty(n) && source.GetTexture(n)) { tex = source.GetTexture(n); scale = source.GetTextureScale(n); offset = source.GetTextureOffset(n); break; }
                if (tex) { m.SetTexture(BaseMapId, tex); m.SetTextureScale(BaseMapId, scale); m.SetTextureOffset(BaseMapId, offset); }
                Color c = source.HasProperty("_BaseColor") ? source.GetColor("_BaseColor") : source.HasProperty("_Color") ? source.GetColor("_Color") : Color.white;
                c.a = 1; m.SetColor(BaseColorId, c);
                m.SetFloat(CullId, source.HasProperty("_Cull") ? source.GetFloat("_Cull") : 2);
            }
            m.SetFloat(EdgeWidthId, s.edgeWidth); m.SetColor(EdgeId, s.edge); m.SetColor(HotId, s.hot); m.SetColor(CharId, s.charColor); m.SetFloat(HeightWeightId, s.heightWeight);
            return m;
        }

        internal static void Forget(BurnDissolveRun run) { active.Remove(run); }

        static void EnsureDriver()
        {
            if (driver || !Application.isPlaying) return;
            var go = new GameObject("Burn dissolve driver") { hideFlags = HideFlags.HideInHierarchy };
            UnityEngine.Object.DontDestroyOnLoad(go); driver = go.AddComponent<BurnDissolveDriver>();
        }

        internal static void TickAll()
        {
            for (int i = active.Count - 1; i >= 0; i--)
            {
                if (i >= active.Count) continue;
                var run = active[i]; run.Tick(run.style.unscaledTime ? Time.unscaledDeltaTime : Time.deltaTime);
            }
        }
    }
}
