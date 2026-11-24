using UnityEngine;
using UnityEngine.Rendering;
namespace VioletDischarge
{
    [DisallowMultipleComponent,RequireComponent(typeof(MeshFilter),typeof(MeshRenderer))]
    public sealed class ArcDischarge : MonoBehaviour
    {
        [Min(.01f), Tooltip("Radius in metres of the charged outer shell.")] public float radius=1;
        [Min(0)] public float intensity=1;
        [ColorUsage(false,true)] public Color tint=Color.white;
        [Min(0)] public float playbackSpeed=1;
        public DischargeLayers layers=DischargeLayers.All;
        [Tooltip("Play the synchronized electrical sound on this prefab.")] public bool playSound=true;
        [SerializeField] AudioClip dischargeSound=null;
        [Tooltip("Strength of the optional light on nearby lit surfaces.")] [Range(0,4)] public float lightStrength=1;
        AudioSource voice;
        Light pulse;
        internal bool radiancePreview;
        internal bool demoControlled;
        static readonly int previewProperty=Shader.PropertyToID("_RadiancePreview");
        public int seed=427;
        public bool playOnEnable=true, loop;
        [SerializeField] Material plasma=null;
        readonly DischargeScore score=new DischargeScore();
        Mesh mesh;
        MeshRenderer draw;
        MaterialPropertyBlock properties;
        int capacityV,capacityI;
        float clock;
        bool playing;
        static readonly MeshUpdateFlags fast=MeshUpdateFlags.DontRecalculateBounds|MeshUpdateFlags.DontValidateIndices;
        static readonly int colorProperty=Shader.PropertyToID("_Tint"),intensityProperty=Shader.PropertyToID("_Intensity");
        public float Duration { get { return DischargeScore.Duration; } }
        public float TimeSeconds { get {return clock;} }
        void OnEnable(){if(playOnEnable)Play();else Stop();}
        void EnsureMesh(){
            if(mesh)return;
            mesh=new Mesh {name="Violet Discharge"};mesh.MarkDynamic();GetComponent<MeshFilter>().sharedMesh=mesh;
            draw=GetComponent<MeshRenderer>();draw.sharedMaterial=plasma;draw.shadowCastingMode=ShadowCastingMode.Off;draw.receiveShadows=false;
            draw.lightProbeUsage=LightProbeUsage.Off;draw.reflectionProbeUsage=ReflectionProbeUsage.Off;properties=new MaterialPropertyBlock();
        }
        void SyncSound(){
            if(demoControlled)return;
            if(voice)voice.Stop();
            if(!playSound || !playing || !dischargeSound || clock>=Duration || playbackSpeed<=0)return;
            if(!voice){
                var child=new GameObject("Discharge sound");child.transform.SetParent(transform,false);
                voice=child.AddComponent<AudioSource>();voice.playOnAwake=false;voice.spatialBlend=1;voice.dopplerLevel=0;
                voice.minDistance=2;voice.maxDistance=30;
            }
            voice.clip=dischargeSound;voice.pitch=Mathf.Clamp(playbackSpeed,.01f,3f);
            voice.timeSamples=Mathf.Clamp(Mathf.RoundToInt(clock*voice.clip.frequency),0,voice.clip.samples-1);voice.Play();
        }
        void SetLight(float energy){
            if(demoControlled || lightStrength<=0 || energy<=.001f){if(pulse)pulse.enabled=false;return;}
            if(!pulse){
                var child=new GameObject("Violet spill");child.transform.SetParent(transform,false);
                pulse=child.AddComponent<Light>();pulse.type=LightType.Point;pulse.shadows=LightShadows.None;
            }
            pulse.color=new Color(.59f,.21f,1f)*tint;
            pulse.range=radius*Mathf.Max(.001f,transform.lossyScale.magnitude*.57735f)*(2.6f+.65f*energy);
            pulse.intensity=Mathf.Max(0,intensity*lightStrength*energy)*2.1f;pulse.enabled=true;
        }
        public void Play(){playing=true;Seek(0);}
        public void Stop(){playing=false;clock=Duration;if(draw)draw.enabled=false;if(voice)voice.Stop();if(pulse)pulse.enabled=false;}
        public void Pause(){playing=false;if(voice)voice.Pause();}
        public void Resume(){if(clock>=Duration)clock=0;playing=true;Seek(clock);}
        public void PlayAt(Vector3 position){transform.position=position;Play();}
        public void Detonate(){
            playing=true;Seek(DischargeScore.BurstTime);
        }
        public void Seek(float seconds){SampleFrame(seconds);SyncSound();}
        void SampleFrame(float seconds){
            EnsureMesh();clock=Mathf.Clamp(seconds,0,Duration);
            score.layers=layers;score.Sample(clock,seed);
            int nv=score.g.vertices.Count,ni=score.g.luminous.Count;
            draw.enabled=nv>0 && ni>0 && intensity>0;SetLight(draw.enabled?DischargeScore.LightAt(clock):0);if(!draw.enabled)return;
            if(nv>capacityV||ni>capacityI){
                capacityV=Mathf.NextPowerOfTwo(Mathf.Max(nv,capacityV));capacityI=Mathf.NextPowerOfTwo(Mathf.Max(ni,capacityI));
                mesh.SetVertexBufferParams(capacityV,new VertexAttributeDescriptor(VertexAttribute.Position,VertexAttributeFormat.Float32,3),
                    new VertexAttributeDescriptor(VertexAttribute.Normal,VertexAttributeFormat.Float32,3),new VertexAttributeDescriptor(VertexAttribute.Color,VertexAttributeFormat.Float32,4),
                    new VertexAttributeDescriptor(VertexAttribute.TexCoord0,VertexAttributeFormat.Float32,4),new VertexAttributeDescriptor(VertexAttribute.TexCoord1,VertexAttributeFormat.Float32,2));
                mesh.SetIndexBufferParams(capacityI,IndexFormat.UInt32);mesh.subMeshCount=1;
            }
            mesh.SetVertexBufferData(score.g.vertices,0,0,nv,0,fast);mesh.SetIndexBufferData(score.g.luminous,0,0,ni,fast);
            var bounds=new Bounds(Vector3.zero,Vector3.one*(Mathf.Max(.01f,radius)*15f));
            mesh.bounds=bounds;mesh.SetSubMesh(0,new SubMeshDescriptor(0,ni){bounds=bounds,vertexCount=nv},fast);
            properties.SetFloat("_Radius",Mathf.Max(.01f,radius));properties.SetFloat(previewProperty,radiancePreview?1:0);properties.SetVector(colorProperty,new Vector4(tint.r,tint.g,tint.b,1));properties.SetFloat(intensityProperty,Mathf.Max(0,intensity));draw.SetPropertyBlock(properties);
        }
        void Update(){
            if(!playing)return;float next=clock+Time.deltaTime*Mathf.Max(0,playbackSpeed);
            if(next>=Duration){if(!loop){Stop();return;}Seek(Mathf.Repeat(next,Duration));return;}
            SampleFrame(next);
            if(voice){voice.mute=!playSound;float pitch=Mathf.Clamp(playbackSpeed,0,3);if(!Mathf.Approximately(voice.pitch,pitch))voice.pitch=pitch;}
        }
        void OnDisable(){Stop();}
        void OnDestroy(){if(mesh)Destroy(mesh);if(voice)Destroy(voice.gameObject);if(pulse)Destroy(pulse.gameObject);}
    }
}
