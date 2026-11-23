Shader "LocalRev2/Cel" {
 Properties {
 _BaseMap("Base",2D)="white"{} _ILM("ILM",2D)="white"{} _SSS("Shadow",2D)="white"{}
 _Tint("Tint",Color)=(1,1,1,1) _Cel("Cel",Float)=1 _Outline("Outline",Float)=0 _Cutoff("Alpha",Float)=0.01 _Cull("Cull",Float)=0
 }
 SubShader {
 Tags {"RenderPipeline"="UniversalPipeline" "RenderType"="Opaque" "Queue"="Geometry"}
 Pass {
 Tags {"LightMode"="SRPDefaultUnlit"}
 Cull [_Cull] ZWrite On
 HLSLPROGRAM
 #pragma vertex vert
 #pragma fragment frag
 #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
 TEXTURE2D(_BaseMap); SAMPLER(sampler_BaseMap);TEXTURE2D(_ILM);SAMPLER(sampler_ILM);TEXTURE2D(_SSS);SAMPLER(sampler_SSS);
 CBUFFER_START(UnityPerMaterial)
 float4 _Tint;float _Cel;float _Outline;float _Cutoff;
 CBUFFER_END
 struct A{float4 positionOS:POSITION;float3 normalOS:NORMAL;float2 uv:TEXCOORD0;};
 struct V{float4 positionCS:SV_POSITION;float3 normalWS:TEXCOORD1;float2 uv:TEXCOORD0;};
 V vert(A i){V o;float3 p=i.positionOS.xyz+i.normalOS*(_Outline*.0025);o.positionCS=TransformObjectToHClip(p);o.normalWS=TransformObjectToWorldNormal(i.normalOS);o.uv=i.uv;return o;}
 half4 frag(V i):SV_Target{
 half4 c=SAMPLE_TEXTURE2D(_BaseMap,sampler_BaseMap,i.uv);clip(c.a-_Cutoff);
 if(_Outline>.5)return half4(.015,.012,.02,1);
 if(_Cel>.5){half4 ilm=SAMPLE_TEXTURE2D(_ILM,sampler_ILM,i.uv);half3 sss=SAMPLE_TEXTURE2D(_SSS,sampler_SSS,i.uv).rgb;
 half light=saturate(dot(normalize(i.normalWS),normalize(float3(-.5,.8,-.5)))*.5+.5);
 half threshold=1-ilm.g;half shade=step(threshold,light);c.rgb*=lerp(sss,half3(1,1,1),shade);
 c.rgb*=lerp(.15,1,step(.9,ilm.a)); }
 return half4(c.rgb*_Tint.rgb,1);
 }
 ENDHLSL
 }
 }
}
