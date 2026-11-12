Shader "Island/Source/Leaf" {
 Properties { _MainTex("Source LSAB",2D)="white"{} _LeafColor("Leaf",Color)=(.15,.28,.07,1) _LeafColor2("Leaf 2",Color)=(.3,.43,.1,1) _BranchColor("Branch",Color)=(.45,.35,.2,1) _AOColor("AO",Color)=(.07,.13,.04,1) _CutOff("Cutoff",Float)=.3 }
 SubShader{Tags{"RenderPipeline"="UniversalPipeline" "RenderType"="TransparentCutout" "Queue"="AlphaTest"} Cull Off
 HLSLINCLUDE
 #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
 #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
 #include "Assets/Island/Shaders/PixelLighting.hlsl"
 TEXTURE2D(_MainTex);SAMPLER(sampler_MainTex);
 CBUFFER_START(UnityPerMaterial)
 float4 _MainTex_ST,_LeafColor,_LeafColor2,_BranchColor,_AOColor;float _CutOff;
 CBUFFER_END
 struct A{float4 p:POSITION;float3 n:NORMAL;float2 uv:TEXCOORD0;float4 c:COLOR;UNITY_VERTEX_INPUT_INSTANCE_ID};
 struct V{float4 p:SV_POSITION;float3 w:TEXCOORD0;half3 n:TEXCOORD1;float2 uv:TEXCOORD2;half ao:TEXCOORD3;half fog:TEXCOORD4;};
 float3 World(A a){float3 w=TransformObjectToWorld(a.p.xyz);float3 pivot=TransformObjectToWorld(float3(0,0,0));float weight=saturate((w.y-pivot.y)*.16);w.xz+=float2(1,.35)*sin(_Time.y*1.4+w.x*.63+w.z*.49)*weight*.045;return w;}
 V Vert(A a){UNITY_SETUP_INSTANCE_ID(a);V o;o.w=World(a);o.p=TransformWorldToHClip(o.w);o.n=TransformObjectToWorldNormal(a.n);o.uv=TRANSFORM_TEX(a.uv,_MainTex);o.ao=a.c.a;o.fog=ComputeFogFactor(o.p.z);return o;}
 half4 Frag(V i):SV_Target{half4 t=SAMPLE_TEXTURE2D(_MainTex,sampler_MainTex,i.uv);clip(t.b-_CutOff);half3 c=lerp(_BranchColor.rgb,lerp(_LeafColor.rgb,_LeafColor2.rgb,t.r),t.a);c=lerp(_AOColor.rgb,c,lerp(.45,1,i.ao));Light l=GetMainLight(TransformWorldToShadowCoord(i.w));half ndl=saturate(dot(normalize(i.n),l.direction)*.5+.5);half band=smoothstep(.35,.65,ndl);band=IslandPixelDiffuse(band);c*=SampleSH(half3(0,1,0))+l.color*lerp(.45,.85,band)*lerp(.35,1,l.shadowAttenuation);return half4(MixFog(c,i.fog),1);}
 float3 _LightDirection,_LightPosition;
 V ShadowVert(A a){UNITY_SETUP_INSTANCE_ID(a);V o=Vert(a);float3 light=_LightDirection;
 #if defined(_CASTING_PUNCTUAL_LIGHT_SHADOW)
 light=normalize(_LightPosition-o.w);
 #endif
 o.p=TransformWorldToHClip(ApplyShadowBias(o.w,o.n,light));
 #if UNITY_REVERSED_Z
 o.p.z=min(o.p.z,UNITY_NEAR_CLIP_VALUE);
 #else
 o.p.z=max(o.p.z,UNITY_NEAR_CLIP_VALUE);
 #endif
 return o;}
 half4 ShadowFrag(V i):SV_Target{clip(SAMPLE_TEXTURE2D(_MainTex,sampler_MainTex,i.uv).b-_CutOff);return 0;}
 ENDHLSL
 Pass{ Name "Forward" Tags{"LightMode"="UniversalForward"}
 HLSLPROGRAM
 #pragma vertex Vert
 #pragma fragment Frag
 #pragma multi_compile_instancing
 #pragma multi_compile_fog
 #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE
 #pragma multi_compile_fragment _ _SHADOWS_SOFT _SHADOWS_SOFT_LOW _SHADOWS_SOFT_MEDIUM
 ENDHLSL }
 Pass{Name "ShadowCaster" Tags{"LightMode"="ShadowCaster"} ZWrite On ZTest LEqual ColorMask 0
 HLSLPROGRAM
 #pragma vertex ShadowVert
 #pragma fragment ShadowFrag
 #pragma multi_compile_instancing
 #pragma multi_compile_vertex _ _CASTING_PUNCTUAL_LIGHT_SHADOW
 ENDHLSL}
 }
}
