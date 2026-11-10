Shader "Island/MapReview/RootedGrass" {
 Properties { _BaseColor("Root colour",Color)=(.18,.29,.10,1) _TipColor("Tip colour",Color)=(.48,.59,.22,1) _Wind("Wind metres",Float)=.11 }
 SubShader { Tags {"RenderPipeline"="UniversalPipeline" "RenderType"="Opaque"} Cull Off
 Pass { Tags {"LightMode"="UniversalForward"}
 HLSLPROGRAM
 #pragma vertex vert
 #pragma fragment frag
 #pragma multi_compile_instancing
 #pragma multi_compile_fog
 #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE
 #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
 #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
 CBUFFER_START(UnityPerMaterial) half4 _BaseColor;half4 _TipColor;float _Wind; CBUFFER_END
 float4 _MapReviewHero;
 struct A{float4 p:POSITION;float3 n:NORMAL;float2 uv:TEXCOORD0;UNITY_VERTEX_INPUT_INSTANCE_ID};
 struct V{float4 p:SV_POSITION;float3 w:TEXCOORD0;half3 n:TEXCOORD1;half tip:TEXCOORD2;half fog:TEXCOORD3;UNITY_VERTEX_INPUT_INSTANCE_ID};
 V vert(A a){V o;UNITY_SETUP_INSTANCE_ID(a);UNITY_TRANSFER_INSTANCE_ID(a,o);float3 w=TransformObjectToWorld(a.p.xyz);float weight=a.uv.y*a.uv.y;float phase=w.x*.7+w.z*.45+_Time.y*1.7;float gust=.65+.35*sin(w.x*.06+w.z*.08-_Time.y*.4);w.xz+=float2(sin(phase),cos(phase*.81))*(weight*_Wind*gust);float2 d=w.xz-_MapReviewHero.xz;float dist=length(d);float bend=saturate(1-dist/1.1)*weight*_MapReviewHero.w;w.xz+=d/max(.1,dist)*bend*.5;w.y-=bend*.23;o.w=w;o.p=TransformWorldToHClip(w);o.n=TransformObjectToWorldNormal(a.n);o.tip=a.uv.y;o.fog=ComputeFogFactor(o.p.z);return o;}
 half4 frag(V i):SV_Target{UNITY_SETUP_INSTANCE_ID(i);Light l=GetMainLight(TransformWorldToShadowCoord(i.w));half3 base=lerp(_BaseColor.rgb,_TipColor.rgb,i.tip);half diffuse=.45+.55*abs(dot(normalize(i.n),l.direction));half3 colour=base*(max(SampleSH(float3(0,1,0)),half3(.24,.26,.24))+l.color*diffuse*lerp(.5,1,l.shadowAttenuation));return half4(MixFog(colour,i.fog),1);}
 ENDHLSL
 }
 }
}
