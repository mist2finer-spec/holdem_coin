using UnityEngine;
using UnityEngine.Rendering;
namespace VioletCurrent
{
    [DisallowMultipleComponent,RequireComponent(typeof(MeshFilter),typeof(MeshRenderer))]
    public sealed class LightningBall : MonoBehaviour
    {
        [Min(.01f)] public float flightSeconds=1.36f;
        [Min(0)] public float metresPerSecond=8.9f;
        [Min(.01f)] public float radius=.19f;
        [Range(0,1.15f)] public float wakeLength=1;
        [Min(0)] public float intensity=1;
        [ColorUsage(false,true)] public Color tint=Color.white;
        [Min(0)] public float playbackSpeed=1;
        public BallLayers layers=BallLayers.All;
        internal bool radiancePreview;
        static readonly int previewProperty=Shader.PropertyToID("_RadiancePreview");
        public int seed=171;
        public bool playOnEnable=true, loop;
        [SerializeField] Material plasma=null;
        readonly LightningBallScore score=new LightningBallScore();
        Mesh mesh;
        MeshRenderer draw;
        MaterialPropertyBlock properties;
        int capacityV,capacityI;
        float clock;
        bool playing;
        static readonly MeshUpdateFlags fast=MeshUpdateFlags.DontRecalculateBounds|MeshUpdateFlags.DontValidateIndices;
        static readonly int colorProperty=Shader.PropertyToID("_Tint"),intensityProperty=Shader.PropertyToID("_Intensity");
        public float Duration { get { return Mathf.Max(.01f,flightSeconds)+LightningBallScore.Release; } }
        public float TimeSeconds { get {return clock;} }
        void OnEnable(){if(playOnEnable)Play();else Stop();}
        void EnsureMesh(){
            if(mesh)return;
            mesh=new Mesh {name="Violet Current plasma"};mesh.MarkDynamic();GetComponent<MeshFilter>().sharedMesh=mesh;
            draw=GetComponent<MeshRenderer>();draw.sharedMaterial=plasma;draw.shadowCastingMode=ShadowCastingMode.Off;draw.receiveShadows=false;
            draw.lightProbeUsage=LightProbeUsage.Off;draw.reflectionProbeUsage=ReflectionProbeUsage.Off;properties=new MaterialPropertyBlock();
        }
        public void Play(){playing=true;Seek(0);}
        public void Stop(){playing=false;clock=Duration;if(draw)draw.enabled=false;}
        public void Pause(){playing=false;}
        public void Resume(){if(clock>=Duration)Seek(0);playing=true;}
        public void Launch(Vector3 start,Vector3 end,float seconds){
            Vector3 delta=end-start;transform.position=start;
            if(delta.sqrMagnitude>.000001f)transform.rotation=Quaternion.LookRotation(delta,Mathf.Abs(delta.normalized.y)>.99f?Vector3.forward:Vector3.up);
            flightSeconds=Mathf.Max(.01f,seconds);
            metresPerSecond=delta.magnitude/(flightSeconds*Mathf.Max(.0001f,transform.TransformVector(Vector3.forward).magnitude));Play();
        }
        [Tooltip("Island: flight distance in metres used by Fire(). Flight time = range / Metres Per Second.")] [Min(0)] public float range=12.1f;
        /// Island: fly `range` metres from start along direction at metresPerSecond (local +Z faces the direction).
        public void Fire(Vector3 start,Vector3 direction){if(direction.sqrMagnitude<1e-8f)direction=transform.forward;Launch(start,start+direction.normalized*range,range/Mathf.Max(.01f,metresPerSecond));}
        /// Island: stop the head where it is now (e.g. it hit the first enemy); the wake fades over the usual 0.78 s release.
        public void EndFlight(){if(playing&&clock<flightSeconds){flightSeconds=Mathf.Max(.01f,clock);Seek(clock);}}
        public void Seek(float seconds){
            EnsureMesh();clock=Mathf.Clamp(seconds,0,Duration);
            score.flight=Mathf.Max(.01f,flightSeconds);score.speed=Mathf.Max(0,metresPerSecond);score.radius=Mathf.Max(.01f,radius);score.wake=Mathf.Clamp(wakeLength,0,1.15f);score.layers=layers;score.Sample(clock,seed);
            int nv=score.g.vertices.Count,ni=score.g.luminous.Count;
            draw.enabled=nv>0 && ni>0 && intensity>0;if(!draw.enabled)return;
            if(nv>capacityV||ni>capacityI){
                capacityV=Mathf.NextPowerOfTwo(Mathf.Max(nv,capacityV));capacityI=Mathf.NextPowerOfTwo(Mathf.Max(ni,capacityI));
                mesh.SetVertexBufferParams(capacityV,new VertexAttributeDescriptor(VertexAttribute.Position,VertexAttributeFormat.Float32,3),
                    new VertexAttributeDescriptor(VertexAttribute.Normal,VertexAttributeFormat.Float32,3),new VertexAttributeDescriptor(VertexAttribute.Color,VertexAttributeFormat.Float32,4),
                    new VertexAttributeDescriptor(VertexAttribute.TexCoord0,VertexAttributeFormat.Float32,4),new VertexAttributeDescriptor(VertexAttribute.TexCoord1,VertexAttributeFormat.Float32,2));
                mesh.SetIndexBufferParams(capacityI,IndexFormat.UInt32);mesh.subMeshCount=1;
            }
            mesh.SetVertexBufferData(score.g.vertices,0,0,nv,0,fast);mesh.SetIndexBufferData(score.g.luminous,0,0,ni,fast);
            float reach=score.speed*score.flight,pad=score.radius*13+1;var bounds=new Bounds(new Vector3(0,0,reach*.5f),new Vector3(pad*2,pad*2,reach+pad*2));
            mesh.bounds=bounds;mesh.SetSubMesh(0,new SubMeshDescriptor(0,ni){bounds=bounds,vertexCount=nv},fast);
            properties.SetFloat(previewProperty,radiancePreview?1:0);properties.SetVector(colorProperty,new Vector4(tint.r,tint.g,tint.b,1));properties.SetFloat(intensityProperty,Mathf.Max(0,intensity));draw.SetPropertyBlock(properties);
        }
        void Update(){
            if(!playing)return;float next=clock+Time.deltaTime*Mathf.Max(0,playbackSpeed);
            if(next>=Duration&&!loop){Stop();return;}Seek(loop?Mathf.Repeat(next,Duration):next);
        }
        void OnDisable(){Stop();}
        void OnDestroy(){if(mesh)Destroy(mesh);}
    }
}
