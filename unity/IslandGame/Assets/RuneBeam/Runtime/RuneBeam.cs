using System.IO;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace RuneBeamFX
{
    [ExecuteAlways, DisallowMultipleComponent]
    [RequireComponent(typeof(MeshFilter), typeof(MeshRenderer))]
    public sealed class RuneBeam : MonoBehaviour
    {
        [SerializeField] TextAsset geometry;
        [SerializeField] Material runeMaterial;
        [Header("Playback")]
        [SerializeField] bool playOnEnable = true;
        [Min(0.05f)] public float duration = 3.6f;
        [Range(0.16f, 0.58f)] public float charge = 0.36f;
        [Min(0.1f)] public float beamLength = 7.5f;
        [Range(0.25f, 2f)] public float beamWidth = 1f;
        [Header("Appearance")]
        [Min(0.05f)] public float size = 1f;
        [Min(0f)] public float intensity = 1f;
        [ColorUsage(false, true)] public Color tint = Color.white;
        [Range(0f, 2f)] public float groundGlow = 1f;
        [Tooltip("Distance from the effect pivot to the floor in local units, before Size.")]
        [Min(0f)] public float floorDistance = 1.41f;
        [Header("Editor preview")]
        [Range(0f, 1f)] public float previewPhase = 0.55f;

        static readonly int Timing = Shader.PropertyToID("_Timing");
        static readonly int Placement = Shader.PropertyToID("_Placement");
        static readonly int Tint = Shader.PropertyToID("_Tint");
        MeshFilter meshFilter;
        MeshRenderer meshRenderer;
        MaterialPropertyBlock properties;
        Mesh mesh;
        float elapsed;
        bool active;

        void OnEnable()
        {
            meshFilter = GetComponent<MeshFilter>();
            meshRenderer = GetComponent<MeshRenderer>();
            if (geometry == null || runeMaterial == null) return;
            if (mesh == null) mesh = ReadMesh(geometry);
            meshFilter.sharedMesh = mesh;
            meshRenderer.sharedMaterial = runeMaterial;
            meshRenderer.shadowCastingMode = ShadowCastingMode.Off;
            meshRenderer.receiveShadows = false;
            properties = properties ?? new MaterialPropertyBlock();
            if (!Application.IsPlaying(gameObject)) { Show(previewPhase); return; }
            if (playOnEnable) Play(); else Stop();
        }

        // Safe to call repeatedly, including from an Animation Event.
        public void Play()
        {
            if (!isActiveAndEnabled || mesh == null) return;
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
            float length = Mathf.Max(0.1f,beamLength);
            float width = Mathf.Clamp(beamWidth,0.25f,2f);
            // Includes both seals, the end of the beam and the projected ground light.
            meshRenderer.localBounds = new Bounds(new Vector3(0f,-floor*0.5f,(length-0.3f)*0.5f)*scale,
                new Vector3(6f+width,6f+floor+width,length+5f)*scale);
            properties.SetVector(Timing, new Vector4(phase, Mathf.Clamp(charge,0.16f,0.58f),length,width));
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
                if (reader.ReadUInt32() != 0x314d4252u) throw new InvalidDataException("Invalid RuneBeam mesh.");
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
                var result = new Mesh { name = "Rune Beam", hideFlags = HideFlags.HideAndDontSave };
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
