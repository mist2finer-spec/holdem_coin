Shader "Island/Source/Grass" {
Properties { _Noisemap("Source vegetation noise",2D)="gray" {} _NoiseScale("Source noise scale",Float)=30 _VegetationSoftness("Source softness",Float)=1 _VegetationBend("Source bend",Float)=0 _PetalFlat("Source petal flattening",Float)=0 _VegetationMoveScale("Source local wind scale",Float)=2  _ScaleUnit("Source blade scale",Float)=.3333 _ScaleRandom("Source random scale",Float)=1 _ScaleShift("Source shift",Float)=0 _UseVertexColor("Source petal colors",Float)=0 _RootTint("Root",Color)=(.08,.2,.04,1) _TipTint("Tip",Color)=(.1,.25,.05,1) _Seed("Seed",Float)=0 }
SubShader { Tags {"RenderPipeline"="UniversalPipeline" "RenderType"="Opaque"} Cull Off
Pass { Tags {"LightMode"="UniversalForward"}
HLSLPROGRAM
#pragma target 3.5
#pragma vertex vert
#pragma fragment frag
#pragma multi_compile_instancing
#pragma multi_compile_fog
#pragma multi_compile_fragment _ _SHADOWS_SOFT _SHADOWS_SOFT_LOW _SHADOWS_SOFT_MEDIUM
#pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE
#include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
#include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
CBUFFER_START(UnityPerMaterial)
float _ScaleUnit,_ScaleRandom,_ScaleShift,_UseVertexColor;
float _NoiseScale,_VegetationSoftness,_VegetationBend,_PetalFlat,_VegetationMoveScale;
CBUFFER_END
TEXTURE2D(_Noisemap); SAMPLER(sampler_Noisemap);
float4 _StudyWind; // direction xz, amplitude, explicitly provisional clock
float4 _StudyInteractor[4]; // authored local-field producer; original native producer unknown
float _StudyInteractionRadius;
UNITY_INSTANCING_BUFFER_START(BladeProps)
UNITY_DEFINE_INSTANCED_PROP(float4,_RootTint)
UNITY_DEFINE_INSTANCED_PROP(float4,_TipTint)
UNITY_DEFINE_INSTANCED_PROP(float,_Seed)
UNITY_INSTANCING_BUFFER_END(BladeProps)
struct A {float4 vertex:POSITION;float3 normal:NORMAL;float2 anchor:TEXCOORD0;float2 height:TEXCOORD1;float4 color:COLOR;UNITY_VERTEX_INPUT_INSTANCE_ID};
struct V {float4 pos:SV_POSITION;float3 world:TEXCOORD0;float3 normal:TEXCOORD1;float height:TEXCOORD2;float fog:TEXCOORD3;float4 color:COLOR;UNITY_VERTEX_INPUT_INSTANCE_ID};
V vert(A i){
 V o;UNITY_SETUP_INSTANCE_ID(i);UNITY_TRANSFER_INSTANCE_ID(i,o);
 float random=frac(UNITY_ACCESS_INSTANCED_PROP(BladeProps,_Seed)-i.height.x)-.5;
 float scale=_ScaleUnit*(1+random*_ScaleRandom)+_ScaleShift;
 float3 anchor=float3(i.anchor.x,0,i.anchor.y),offset=i.vertex.xyz-anchor;
 float3 root=TransformObjectToWorld(anchor);
 float2 direction=_StudyWind.xy/max(length(_StudyWind.xy),.001);
 float3 noise=SAMPLE_TEXTURE2D_LOD(_Noisemap,sampler_Noisemap,root.xz/max(_NoiseScale,.001)-direction*_StudyWind.w,0).xyz-.5;
 float height=scale*saturate(i.height.y);
 float2 wind=(noise.xy+direction*(noise.z+_VegetationBend))*height*_StudyWind.z*_VegetationSoftness;
 // Native source samples a local wind render target. This small local producer
 // approximates player contact, with an explicit radius and recovery time.
 float2 local=0;
 [unroll] for(int n=0;n<4;n++){
  float2 delta=root.xz-_StudyInteractor[n].xz;float distance=length(delta);
  float falloff=saturate(1-distance/max(_StudyInteractionRadius,.01));
  float heightGate=saturate(1-abs(root.y-_StudyInteractor[n].y)/2);
  float2 push=delta/max(distance,.1)*falloff*falloff*_StudyInteractor[n].w*heightGate;
  if(dot(push,push)>dot(local,local))local=push;
 }
 wind+=local*_VegetationMoveScale*saturate(i.height.y);
 float3 flat=offset*float3(1-_PetalFlat,1,1-_PetalFlat);
 float3 bent=flat+float3(wind.x,0,wind.y);
 bent*=length(offset)*rsqrt(max(dot(bent,bent),.001));
 // Source GLSL: independent XZ shrink 1-(scale-1)^2 and Y scale.
 float shrink=min((scale-1)*(scale-1),1);
 float3 p=anchor+offset+bent-flat+offset*float3(-shrink,scale-1,-shrink);
 o.world=TransformObjectToWorld(p);o.pos=TransformWorldToHClip(o.world);
 o.normal=TransformObjectToWorldNormal(normalize(i.normal+float3(-wind.x,0,-wind.y)));
 o.height=i.height.y;o.fog=ComputeFogFactor(o.pos.z);o.color=i.color;return o;
}
half4 frag(V i):SV_Target {UNITY_SETUP_INSTANCE_ID(i);float3 root=UNITY_ACCESS_INSTANCED_PROP(BladeProps,_RootTint).rgb;float3 tip=UNITY_ACCESS_INSTANCED_PROP(BladeProps,_TipTint).rgb;float k=saturate(i.height/.2-.519);float3 c=lerp(root,tip,k)*(1+1.18*saturate(i.height-.6));if(_UseVertexColor>.5)c=i.color.rgb;Light sun=GetMainLight(TransformWorldToShadowCoord(i.world));float ndl=saturate(dot(normalize(i.normal),sun.direction)*.5+.5);float3 light=SampleSH(float3(0,1,0))+sun.color*ndl*sun.shadowAttenuation*.6;c*=light;
#if defined(UNITY_COLORSPACE_GAMMA)
c=LinearToSRGB(c);
#endif
return half4(MixFog(c,i.fog),1);}
ENDHLSL
}}}
