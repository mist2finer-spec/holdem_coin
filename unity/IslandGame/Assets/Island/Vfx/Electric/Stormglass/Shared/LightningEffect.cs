using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
namespace StormglassVfx
{
    [DisallowMultipleComponent, RequireComponent(typeof(MeshFilter),typeof(MeshRenderer))]
    public sealed class LightningEffect : MonoBehaviour
    {
        public LightningPart effect;
        public SlashForm slashForm=SlashForm.ThreeCuts;
        [Tooltip("Controls sword charge and contact-hit color. The three slash passes already have their own colors.")] public HitTone hitTone=HitTone.Violet;
        [Tooltip("Illuminate nearby lit scene geometry during the discharge.")] public bool localLight=true;
        [Range(0,4)] public float lightStrength=1;
        Light accent;
        public FxLayers layers=FxLayers.All;
        public bool playOnEnable=true, loop;
        [Tooltip("Wide additive wire halo, including projects without camera bloom.")] public bool wireHalo=true;
        [Tooltip("Island: remap every color of this effect to the violet family (Cyan/Indigo/Ice -> Violet/Pearl). Off = original palette.")] public bool violetOnly;
        [Tooltip("Island, Sword Charge only: hold the charged state (no fade-out) until Stop(). Duration is ignored while sustaining.")] public bool sustain;
        [Min(.01f)] public float playbackSpeed=1;
        [Min(.01f)] public float size=1;
        [Min(0)] public float intensity=1;
        [ColorUsage(false,true)] public Color tint=Color.white;
        public int seed=117;
        [Tooltip("Optional for Sword Charge. Assign both sockets to fit the guard-to-tip segment each frame.")]
        public Transform bladeBase,bladeTip;
        [SerializeField] Material luminousMaterial=null, residueMaterial=null, coronaMaterial=null;
        readonly LightningScore score=new LightningScore();
        Mesh mesh;
        ArcVertex[] vertices;
        int[] indices;
        int capacityV,capacityI;
        float time;
        bool playing;
        static readonly MeshUpdateFlags Flags=MeshUpdateFlags.DontRecalculateBounds|MeshUpdateFlags.DontValidateIndices;
        // Island: all three sub-meshes are written in one SetSubMeshes call. Writing them one by one let the new range of
        // one sub-mesh overlap the previous frame's range of another and Unity logged "shares part of its index buffer".
        readonly SubMeshDescriptor[] subMeshes=new SubMeshDescriptor[3];
        const float SustainWrap=600f;
        bool Sustaining {get{return sustain&&effect==LightningPart.SwordCharge;}}
        public float Duration {get{return LightningScore.Duration(effect,slashForm);}}
        public float TimeSeconds {get{return time;}}
        public bool IsPlaying {get{return playing;}}
        void Awake(){EnsureMesh();}
        void EnsureMesh(){
            if(mesh)return;
            mesh=new Mesh {name="Stormglass • "+effect};mesh.MarkDynamic();
            GetComponent<MeshFilter>().sharedMesh=mesh;var render=GetComponent<MeshRenderer>();
            render.sharedMaterials=new[]{luminousMaterial,residueMaterial,coronaMaterial};
            render.shadowCastingMode=ShadowCastingMode.Off;render.receiveShadows=false;
            render.lightProbeUsage=LightProbeUsage.Off;render.reflectionProbeUsage=ReflectionProbeUsage.Off;
        }
        void UpdateAccent(){
            if(!localLight||lightStrength<=0){if(accent)accent.enabled=false;return;}
            if(!accent){
                var child=new GameObject("Electric spill");child.transform.SetParent(transform,false);
                accent=child.AddComponent<Light>();accent.type=LightType.Point;accent.shadows=LightShadows.None;accent.renderMode=LightRenderMode.Auto;
            }
            bool blue=!violetOnly&&(effect==LightningPart.Ground||effect==LightningPart.StormSkill||((effect==LightningPart.SwordCharge||effect==LightningPart.Hit)&&hitTone==HitTone.Cyan));
            float level=0;Vector3 pos=Vector3.zero;float reach=2.7f;
            switch(effect){
                case LightningPart.SwordCharge:
                    level=MathFx.Window(Sustaining?Mathf.Min(time,.9f):time,0,.18f,.98f,1.5f)*(.66f+.13f*MathFx.Sin(time*26));pos=Vector3.up*.70f;reach=1.6f;break;
                case LightningPart.Slash:
                    int cut=slashForm==SlashForm.ThreeCuts?(time<.68f?0:time<1.38f?1:2):(int)slashForm-1;
                    float tt=time-(slashForm==SlashForm.ThreeCuts?(cut==0?0:cut==1?.68f:1.38f):0);level=MathFx.Window(tt,0,.095f,.28f,.72f);pos=Vector3.up*1.3f;blue=!violetOnly&&cut==2;break;
                case LightningPart.Hit:level=MathFx.Window(time,0,.04f,.15f,.89f);break;
                case LightningPart.StormSkill:level=.21f*MathFx.Window(time,0,.19f,1.39f,1.59f)+1.6f*MathFx.Window(time,1.42f,1.50f,1.90f,2.81f);pos=Vector3.up*(time<1.46f?2.35f:.82f);reach=4;break;
                case LightningPart.Ground:level=1.55f*MathFx.Window(time,0,.064f,.25f,.88f);pos=Vector3.up*.27f;reach=3.7f;break;
            }
            if(effect==LightningPart.SwordCharge&&bladeBase&&bladeTip)accent.transform.position=Vector3.Lerp(bladeBase.position,bladeTip.position,.55f);
            else accent.transform.localPosition=pos*size;
            float scale=Mathf.Max(Mathf.Abs(transform.lossyScale.x),Mathf.Abs(transform.lossyScale.z));
            accent.range=reach*size*scale;accent.color=(blue?new Color(.1f,.75f,1):new Color(.42f,.14f,1))*tint;
            accent.intensity=Mathf.Max(0,level*intensity*lightStrength)*2;accent.enabled=accent.intensity>.004f;
        }
        void OnEnable(){if(playOnEnable)Play();else if(mesh)Seek(0);}
        public void Play(){playing=true;Seek(0);}
        public void Pause(){playing=false;}
        public void Resume(){if(!Sustaining&&time>=Duration)Seek(0);playing=true;}
        public void Stop(){playing=false;time=Duration;if(mesh)UploadEmpty();}
        public void PlayAt(Vector3 position,Quaternion rotation){transform.SetPositionAndRotation(position,rotation);Play();}
        public void Seek(float seconds){EnsureMesh();time=Sustaining?Mathf.Max(0,seconds):Mathf.Clamp(seconds,0,Duration);Draw();}
        void LateUpdate(){
            if(!playing){if(effect==LightningPart.SwordCharge&&bladeBase&&bladeTip&&time>0&&(Sustaining||time<Duration))Draw();return;}
            float next=time+Time.deltaTime*Mathf.Max(0,playbackSpeed);
            if(Sustaining){if(next>SustainWrap)next-=SustainWrap-1;}
            else if(next>=Duration){if(loop)next=Mathf.Repeat(next,Duration);else{Stop();return;}}
            time=next;Draw();
        }
        void Draw(){
            score.violetOnly=violetOnly;score.sustain=Sustaining;score.layers=layers;score.gain=Mathf.Max(0,intensity);score.tint=new V3(tint.r,tint.g,tint.b);
            score.Sample(effect,time,seed,slashForm,hitTone);
            int nv=score.g.vertices.Count,nSolid=score.g.soot.Count,nAdd=score.g.luminous.Count;
            if(nv==0||nAdd+nSolid==0){UploadEmpty();return;}
            UpdateAccent();Grow(nv,nAdd+nSolid+(wireHalo?nAdd:0));score.g.vertices.CopyTo(vertices,0);
            float s=Mathf.Max(.001f,size);bool fit=effect==LightningPart.SwordCharge&&bladeBase&&bladeTip;
            Matrix4x4 fitMatrix=Matrix4x4.identity;
            if(fit){
                Vector3 start=transform.InverseTransformPoint(bladeBase.position);
                Vector3 end=transform.InverseTransformPoint(bladeTip.position);
                Vector3 delta=end-start;
                if(delta.sqrMagnitude<1e-9f){UploadEmpty();return;}
                fitMatrix=Matrix4x4.TRS(start,Quaternion.FromToRotation(Vector3.up,delta),new Vector3(s,delta.magnitude/1.36f,s));
            }
            if(fit||Mathf.Abs(s-1)>.00001f){
                for(int i=0;i<nv;i++){
                    var v=vertices[i];
                    if(fit){
                        Vector3 pos=fitMatrix.MultiplyPoint3x4(ToUnity(v.position));v.position=FromUnity(pos);
                        if(v.mode==1)v.direction=FromUnity(fitMatrix.MultiplyVector(ToUnity(v.direction)).normalized);
                    }else v.position=v.position*s;
                    v.width*=s;
                    if(v.mode==2){v.direction.x*=s;v.direction.y*=s;}
                    vertices[i]=v;
                }
            }
            score.g.luminous.CopyTo(indices,0);score.g.soot.CopyTo(indices,nAdd);if(wireHalo)score.g.luminous.CopyTo(indices,nAdd+nSolid);
            mesh.SetVertexBufferData(vertices,0,0,nv,0,Flags);
            mesh.SetIndexBufferData(indices,0,0,nAdd+nSolid+(wireHalo?nAdd:0),Flags);
            var bounds=new Bounds(Vector3.zero,Vector3.one*(14*s));
            if(fit){Vector3 a=transform.InverseTransformPoint(bladeBase.position),b=transform.InverseTransformPoint(bladeTip.position);bounds=new Bounds((a+b)*.5f,Vector3.one*(2*s));bounds.Encapsulate(a+Vector3.one*s);bounds.Encapsulate(a-Vector3.one*s);bounds.Encapsulate(b+Vector3.one*s);bounds.Encapsulate(b-Vector3.one*s);}
            mesh.bounds=bounds;
            subMeshes[0]=new SubMeshDescriptor(0,nAdd){bounds=bounds,vertexCount=nv};
            subMeshes[1]=new SubMeshDescriptor(nAdd,nSolid){bounds=bounds,vertexCount=nv};
            subMeshes[2]=new SubMeshDescriptor(nAdd+nSolid,wireHalo?nAdd:0){bounds=bounds,vertexCount=nv};
            mesh.SetSubMeshes(subMeshes,0,3,Flags);
        }
        static Vector3 ToUnity(V3 v){return new Vector3(v.x,v.y,v.z);}
        static V3 FromUnity(Vector3 v){return new V3(v.x,v.y,v.z);}
        void Grow(int nv,int ni){
            if(nv<=capacityV&&ni<=capacityI)return;
            capacityV=Mathf.NextPowerOfTwo(Mathf.Max(nv,capacityV));capacityI=Mathf.NextPowerOfTwo(Mathf.Max(ni,capacityI));
            vertices=new ArcVertex[capacityV];indices=new int[capacityI];
            mesh.SetVertexBufferParams(capacityV,new VertexAttributeDescriptor(VertexAttribute.Position,VertexAttributeFormat.Float32,3),
                new VertexAttributeDescriptor(VertexAttribute.Normal,VertexAttributeFormat.Float32,3),new VertexAttributeDescriptor(VertexAttribute.Color,VertexAttributeFormat.Float32,4),
                new VertexAttributeDescriptor(VertexAttribute.TexCoord0,VertexAttributeFormat.Float32,4),new VertexAttributeDescriptor(VertexAttribute.TexCoord1,VertexAttributeFormat.Float32,2));
            mesh.SetIndexBufferParams(capacityI,IndexFormat.UInt32);mesh.subMeshCount=3;
        }
        void UploadEmpty(){
            if(accent)accent.enabled=false;
            if(capacityV==0)return;
            subMeshes[0]=subMeshes[1]=subMeshes[2]=new SubMeshDescriptor(0,0);
            mesh.SetSubMeshes(subMeshes,0,3,Flags);
        }
        void OnDisable(){playing=false;if(mesh)UploadEmpty();}
        void OnDestroy(){if(mesh)Destroy(mesh);}
    }
}
