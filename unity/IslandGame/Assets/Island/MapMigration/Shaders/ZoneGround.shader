Shader "Island/MapReview/WorldGround" {
 Properties { _Grass("Existing forest grass",2D)="white"{} _Earth("Existing forest earth",2D)="white"{} _Tint("Tint",Color)=(.72,.80,.64,1) _TextureWeight("Texture weight",Range(0,1))=.68 _UseHole("Remove near overlap",Float)=0 _NearHole("Near terrain bounds",Vector)=(0,0,0,0) }
 SubShader { Tags {"RenderPipeline"="UniversalPipeline" "RenderType"="Opaque"} Cull Back

 HLSLINCLUDE
 #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
 float4 _MountOcclusionHero;
 void ClipForeground(float3 world,float2 pixel){
  if(_MountOcclusionHero.w<.5||world.y<_MountOcclusionHero.y-.50)return;
  float3 heroVS=TransformWorldToView(_MountOcclusionHero.xyz);
  float3 pointVS=TransformWorldToView(world);
  float depth=-pointVS.z,heroDepth=-heroVS.z;
  if(depth<=0||heroDepth<=0||depth>=heroDepth-.65)return;
  float2 offset=pointVS.xy*(heroDepth/depth)-heroVS.xy;
  float mask=1-smoothstep(.55,1.0,length(offset/float2(2.2,1.55)));
  float noise=frac(52.9829189*frac(dot(floor(pixel),float2(.06711056,.00583715))));
  clip(noise-mask*.98);
 }
 ENDHLSL
 Pass { Name "Forward" Tags {"LightMode"="UniversalForward"}
 HLSLPROGRAM
 #pragma vertex vert
 #pragma fragment frag
 #pragma multi_compile_fog
 #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE
 #pragma multi_compile_fragment _ _SHADOWS_SOFT
 #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
 #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
 TEXTURE2D(_Grass); SAMPLER(sampler_Grass); TEXTURE2D(_Earth); SAMPLER(sampler_Earth);
 CBUFFER_START(UnityPerMaterial) half4 _Tint;float _TextureWeight;float _UseHole;float4 _NearHole; CBUFFER_END
 struct A {float4 p:POSITION;float3 n:NORMAL;float2 uv:TEXCOORD0;half4 c:COLOR;};
 struct V {float4 p:SV_POSITION;float3 w:TEXCOORD0;half3 n:TEXCOORD1;float2 uv:TEXCOORD2;half4 c:COLOR;half fog:TEXCOORD3;};
 V vert(A a){V o;o.w=TransformObjectToWorld(a.p.xyz);o.p=TransformWorldToHClip(o.w);o.n=TransformObjectToWorldNormal(a.n);o.uv=a.uv;o.c=a.c;o.fog=ComputeFogFactor(o.p.z);return o;}
 half4 frag(V i):SV_Target{ClipForeground(i.w,i.p.xy);if(_UseHole>.5 && i.uv.x>_NearHole.x && i.uv.y>_NearHole.y && i.uv.x<_NearHole.z && i.uv.y<_NearHole.w)discard;half3 n=normalize(i.n);half road=saturate(i.c.a);half3 grass=SAMPLE_TEXTURE2D(_Grass,sampler_Grass,i.uv*.2).rgb;half3 earth=SAMPLE_TEXTURE2D(_Earth,sampler_Earth,i.uv*.2).rgb;half3 tex=lerp(grass,earth,road);half3 base=lerp(i.c.rgb,tex,_TextureWeight)*_Tint.rgb;half slope=saturate((.88-n.y)*3);base=lerp(base,half3(.32,.32,.27),slope*.6);Light l=GetMainLight(TransformWorldToShadowCoord(i.w));half3 lit=base*(max(SampleSH(n),half3(.24,.26,.24))+l.color*saturate(dot(n,l.direction))*lerp(.45,1,l.shadowAttenuation));return half4(MixFog(lit,i.fog),1);}
 ENDHLSL
 }
 Pass { Name "DepthOnly" Tags {"LightMode"="DepthOnly"} ZWrite On ColorMask R
 HLSLPROGRAM
 #pragma vertex dv
 #pragma fragment df
 #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
 CBUFFER_START(UnityPerMaterial) half4 _Tint;float _TextureWeight;float _UseHole;float4 _NearHole; CBUFFER_END
 struct DA{float4 p:POSITION;float2 uv:TEXCOORD0;};struct DV{float4 p:SV_POSITION;float2 uv:TEXCOORD0;float3 w:TEXCOORD1;};
 DV dv(DA a){DV o;o.w=TransformObjectToWorld(a.p.xyz);o.p=TransformObjectToHClip(a.p.xyz);o.uv=a.uv;return o;}
 half4 df(DV i):SV_Target{ClipForeground(i.w,i.p.xy);if(_UseHole>.5 && i.uv.x>_NearHole.x && i.uv.y>_NearHole.y && i.uv.x<_NearHole.z && i.uv.y<_NearHole.w)discard;return 0;}
 ENDHLSL
 }
 Pass { Name "ShadowCaster" Tags {"LightMode"="ShadowCaster"} ZWrite On ZTest LEqual ColorMask 0 Cull Back
 HLSLPROGRAM
 #pragma vertex ShadowPassVertex
 #pragma fragment ShadowPassFragment
 #pragma multi_compile_instancing
 #pragma multi_compile_vertex _ _CASTING_PUNCTUAL_LIGHT_SHADOW
 #include "Packages/com.unity.render-pipelines.universal/Shaders/ShadowCasterPass.hlsl"
 ENDHLSL
 }
 }
}
