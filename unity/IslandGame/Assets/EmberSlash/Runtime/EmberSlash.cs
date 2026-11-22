using System.IO;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace EmberSlashFX
{
    [ExecuteAlways, DisallowMultipleComponent]
    [RequireComponent(typeof(MeshFilter), typeof(MeshRenderer))]
    public sealed class EmberSlash : MonoBehaviour
    {
        [SerializeField] TextAsset geometry;
        [SerializeField] Material emberMaterial;
        [Header("Playback")]
        [SerializeField] bool playOnEnable = true;
        [Min(0.05f)] public float duration = 0.82f;
        [Range(0.16f, 0.58f)] public float sweep = 0.36f;
        [Range(0.18f, 0.72f)] public float persistence = 0.61f;
        public bool mirrored;
        [Header("Appearance")]
        [Min(0.05f)] public float size = 1f;
        [Min(0f)] public float intensity = 1f;
        [ColorUsage(false, true)] public Color tint = Color.white;
        [Range(0f, 2f)] public float groundGlow = 1f;
        [Tooltip("Distance from the effect pivot to the floor in local units, before Size.")]
        [Min(0f)] public float floorDistance = 0.64f;
        [Header("Editor preview")]
        [Range(0f, 1f)] public float previewPhase = 0.32f;

        static readonly int Timing = Shader.PropertyToID("_Timing");
        static readonly int Placement = Shader.PropertyToID("_Placement");
        static readonly int Tint = Shader.PropertyToID("_Tint");
        MeshFilter meshFilter;
        MeshRenderer meshRenderer;
        MaterialPropertyBlock properties;
        Mesh mesh;
        float elapsed;
        bool active, reverseThisPlay;

        void OnEnable()
        {
            meshFilter = GetComponent<MeshFilter>();
            meshRenderer = GetComponent<MeshRenderer>();
            if (geometry == null || emberMaterial == null) return;
            if (mesh == null) mesh = ReadMesh(geometry);
            meshFilter.sharedMesh = mesh;
            meshRenderer.sharedMaterial = emberMaterial;
            meshRenderer.shadowCastingMode = ShadowCastingMode.Off;
            meshRenderer.receiveShadows = false;
            properties = properties ?? new MaterialPropertyBlock();
            if (!Application.IsPlaying(gameObject)) { Show(previewPhase); return; }
            if (playOnEnable) Play(); else Stop();
        }

        // Safe to call repeatedly, including from an Animation Event.
        public void Play() { Begin(false); }
        public void PlayMirrored() { Begin(true); }
        void Begin(bool reverse)
        {
            if (!isActiveAndEnabled || mesh == null) return;
            reverseThisPlay = reverse;
            elapsed = 0f;
            active = true;
            Show(0f);
        }

        public void Stop()
        {
            active = false;
            if (meshRenderer != null) meshRenderer.enabled = false;
        }

        void Update()
        {
            if (mesh == null) return;
            if (!Application.IsPlaying(gameObject)) { Show(previewPhase); return; }
            if (!active) return;
            elapsed += Time.deltaTime;
            float phase = elapsed / Mathf.Max(0.05f, duration);
            if (phase >= 1f) Stop(); else Show(phase);
        }

        void Show(float phase)
        {
            float scale = Mathf.Max(0.05f, size);
            float floor = Mathf.Max(0f, floorDistance);
            // Bounds include the rising sparks and the optional pool below the pivot.
            var bounds = new Bounds(new Vector3(0f, -floor*0.5f*scale, 0f),
                new Vector3(10f, 6f+floor, 9f)*scale);
            meshRenderer.localBounds = bounds;
            properties.SetVector(Timing, new Vector4(phase, Mathf.Clamp(sweep,0.16f,0.58f),
                Mathf.Clamp(persistence,0.18f,0.72f), mirrored ^ reverseThisPlay ? -1f : 1f));
            properties.SetVector(Placement, new Vector4(scale, Mathf.Max(0f,intensity), groundGlow, floor));
            properties.SetColor(Tint, tint);
            meshRenderer.SetPropertyBlock(properties);
            meshRenderer.enabled = true;
        }

        void OnDisable() { Stop(); }

        void OnDestroy()
        {
            if (mesh == null) return;
            if (meshFilter != null && meshFilter.sharedMesh == mesh) meshFilter.sharedMesh = null;
            if (Application.isPlaying) Destroy(mesh); else DestroyImmediate(mesh);
        }

        static Mesh ReadMesh(TextAsset source)
        {
            using (var reader = new BinaryReader(new MemoryStream(source.bytes)))
            {
                if (reader.ReadUInt32() != 0x314D5345u) throw new InvalidDataException("Invalid EmberSlash mesh.");
                int vertexCount = reader.ReadInt32(), indexCount = reader.ReadInt32();
                var positions = new Vector3[vertexCount];
                var uv = new Vector2[vertexCount];
                var motion = new List<Vector4>(vertexCount);
                var shape = new List<Vector4>(vertexCount);
                for (int i=0; i<vertexCount; i++)
                {
                    positions[i] = new Vector3(reader.ReadSingle(),reader.ReadSingle(),reader.ReadSingle());
                    uv[i] = new Vector2(reader.ReadSingle(),reader.ReadSingle());
                    motion.Add(ReadVector4(reader));
                    shape.Add(ReadVector4(reader));
                }
                var indices = new int[indexCount];
                for (int i=0; i<indexCount; i++) indices[i]=reader.ReadUInt16();
                var result = new Mesh { name = "Ember Slash", hideFlags = HideFlags.HideAndDontSave };
                result.vertices = positions;
                result.uv = uv;
                result.SetUVs(1,motion);
                result.SetUVs(2,shape);
                result.SetTriangles(indices,0,false);
                result.bounds = new Bounds(Vector3.zero, new Vector3(10f,8f,9f));
                result.UploadMeshData(true);
                return result;
            }
        }

        static Vector4 ReadVector4(BinaryReader reader)
        {
            return new Vector4(reader.ReadSingle(),reader.ReadSingle(),reader.ReadSingle(),reader.ReadSingle());
        }
    }
}
