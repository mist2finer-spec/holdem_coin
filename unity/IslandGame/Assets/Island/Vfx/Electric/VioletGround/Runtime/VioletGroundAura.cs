using System;
using System.Collections.Generic;
using UnityEngine;
#if UNITY_EDITOR
using UnityEditor;
#endif

namespace VioletGroundFX
{
    [ExecuteAlways, DisallowMultipleComponent, RequireComponent(typeof(MeshFilter), typeof(MeshRenderer))]
    public sealed class VioletGroundAura : MonoBehaviour
    {
        public enum Accent { RisingDots, QuietLightning }
        [SerializeField] private Accent accent;
        [SerializeField] private TextAsset airMotion;
        [SerializeField] private Material groundMaterial, dotsMaterial, lightningMaterial;
        [Range(0f, 2f)] public float groundStrength = 1f;
        [Tooltip("Brightness of the continuous violet ground layer.")]
        [Range(0f, 1.6f)] public float groundFill = 1f;
        [Range(0f, 2f)] public float accentStrength = 1f;
        [Range(0f, 3f)] public float speed = 1f;
        [Range(0f, 8f)] public float startOffset;

        [Serializable] private sealed class Dot
        {
            public float x, z, phase, repeats, height, radius, drift, angle, gain;
        }
        [Serializable] private sealed class BoltPath
        {
            public float width, power;
            public Vector3[] points;
        }
        [Serializable] private sealed class BoltEvent
        {
            public float start, duration;
            public BoltPath[] paths;
        }
        [Serializable] private sealed class Motion
        {
            public Dot[] dots;
            public BoltEvent[] events;
        }
        private Mesh mesh;
        private MaterialPropertyBlock block;
        private MeshRenderer target;
        private float clock;
        private bool rebuild;
        private static readonly int Clock = Shader.PropertyToID("_Clock");
        private static readonly int GroundGain = Shader.PropertyToID("_GroundGain");
        private static readonly int GroundFill = Shader.PropertyToID("_GroundFill");
        private static readonly int AirGain = Shader.PropertyToID("_AirGain");

        private void OnEnable()
        {
            clock = startOffset;
            target = GetComponent<MeshRenderer>();
            block = new MaterialPropertyBlock();
            BuildMesh();
            Apply();
            #if UNITY_EDITOR
            lastEditorTime = EditorApplication.timeSinceStartup;
            EditorApplication.update += EditorTick;
            #endif
        }
        private void OnValidate() { rebuild = true; }
        private void OnDisable()
        {
            #if UNITY_EDITOR
            EditorApplication.update -= EditorTick;
            #endif
            ReleaseMesh();
        }
        private void ReleaseMesh()
        {
            if (!mesh) return;
            var filter = GetComponent<MeshFilter>();
            if (filter && filter.sharedMesh == mesh) filter.sharedMesh = null;
            if (Application.isPlaying) Destroy(mesh); else DestroyImmediate(mesh);
            mesh = null;
        }
        private void Update()
        {
            if (rebuild) { BuildMesh(); Apply(); }
            if (!Application.IsPlaying(gameObject)) return;
            clock = Mathf.Repeat(clock + Time.deltaTime * speed, 8f);
            Apply();
        }
        #if UNITY_EDITOR
        private double lastEditorTime;
        private void EditorTick()
        {
            double now = EditorApplication.timeSinceStartup;
            float delta = (float)(now - lastEditorTime);
            lastEditorTime = now;
            if (EditorApplication.isPlayingOrWillChangePlaymode || !gameObject.scene.IsValid()) return;
            if (rebuild) BuildMesh();
            clock = Mathf.Repeat(clock + delta * speed, 8f);
            Apply();
            if (speed > 0) SceneView.RepaintAll();
        }
        #endif
        private void Apply()
        {
            if (!target || block == null) return;
            target.GetPropertyBlock(block);
            block.SetFloat(Clock, clock);
            block.SetFloat(GroundGain, groundStrength);
            block.SetFloat(GroundFill, groundFill);
            block.SetFloat(AirGain, accentStrength);
            target.SetPropertyBlock(block);
        }
        private void BuildMesh()
        {
            rebuild = false;
            if (!airMotion || !groundMaterial || !dotsMaterial || !lightningMaterial) return;
            ReleaseMesh();
            Motion data = JsonUtility.FromJson<Motion>(airMotion.text);
            var pos = new List<Vector3>();
            var uv = new List<Vector2>();
            var motion = new List<Vector4>();
            var style = new List<Vector4>();
            var tangent = new List<Vector4>();
            var tris = new List<int>();
            void Add(Vector3 p, Vector2 coord, Vector4 timing, Vector4 look, Vector3 dir)
            {
                pos.Add(p); uv.Add(coord); motion.Add(timing); style.Add(look);
                tangent.Add(new Vector4(dir.x, dir.y, dir.z, 1));
            }
            void Quad(int a)
            {
                tris.Add(a); tris.Add(a+1); tris.Add(a+2);
                tris.Add(a+2); tris.Add(a+1); tris.Add(a+3);
            }
            Vector2[] corners = { new Vector2(-1,-1), new Vector2(1,-1), new Vector2(-1,1), new Vector2(1,1) };
            foreach (var c in corners)
                Add(new Vector3(1.5f*c.x, .016f, 1.5f*c.y), .5f*(c+Vector2.one), Vector4.zero, Vector4.zero, Vector3.right);
            int[] ground = { 0, 2, 1, 1, 2, 3 };
            if (accent == Accent.RisingDots)
            {
                foreach (var dot in data.dots)
                {
                    int first = pos.Count;
                    foreach (var c in corners)
                        Add(new Vector3(dot.x,.035f,dot.z), c, new Vector4(dot.phase,dot.repeats,dot.height,dot.radius),
                            new Vector4(dot.drift,dot.angle,dot.gain,0), Vector3.right);
                    Quad(first);
                }
            }
            else
            {
                foreach (var bolt in data.events)
                foreach (var path in bolt.paths)
                {
                    int count = path.points.Length;
                    for (int j = 0; j < count; j++)
                    {
                        int first = pos.Count;
                        Vector3 d = (path.points[Math.Min(j+1,count-1)]-path.points[Math.Max(j-1,0)]).normalized;
                        Vector4 timing = new Vector4(bolt.start,bolt.duration,path.power,path.width);
                        float along = (float)j/(count-1);
                        Add(path.points[j], new Vector2(-1,along), timing, Vector4.zero, d);
                        Add(path.points[j], new Vector2(1,along), timing, Vector4.zero, d);
                        if (j < count-1) Quad(first);
                    }
                }
            }
            mesh = new Mesh { name = "Violet aura " + accent, hideFlags = HideFlags.DontSave };
            mesh.SetVertices(pos); mesh.SetUVs(0,uv); mesh.SetUVs(1,motion); mesh.SetUVs(2,style); mesh.SetTangents(tangent);
            mesh.subMeshCount = 2;
            mesh.SetTriangles(ground,0,false); mesh.SetTriangles(tris,1,false);
            mesh.bounds = new Bounds(new Vector3(0,.48f,0),new Vector3(3.25f,1.25f,3.25f));
            GetComponent<MeshFilter>().sharedMesh = mesh;
            target.sharedMaterials = new[] {groundMaterial, accent == Accent.RisingDots ? dotsMaterial : lightningMaterial};
        }
    }
}

