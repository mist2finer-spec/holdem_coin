// Original compact URP implementation. Art/features studied from MatrixRex's
// MIT Uber-Stylized-Water: world-space flow, depth tint and intersection foam.
Shader "Island/Reference River" {
 Properties { _Shallow("Shallow",Color)=(.35,.65,.62,1) _Deep("Deep",Color)=(.16,.36,.40,1) }
 SubShader {
  Tags { "RenderPipeline"="UniversalPipeline" "Queue"="Transparent-20" "RenderType"="Transparent" }
  Pass {
   Blend SrcAlpha OneMinusSrcAlpha
   ZWrite Off
   Cull Off
   HLSLPROGRAM
   #pragma vertex vert
   #pragma fragment frag
   #pragma multi_compile_fog
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/DeclareDepthTexture.hlsl"
   CBUFFER_START(UnityPerMaterial)
   half4 _Shallow,_Deep;
   CBUFFER_END
   struct A{float4 positionOS:POSITION;};
   struct V{float4 positionCS:SV_POSITION;float3 world:TEXCOORD0;float4 screen:TEXCOORD1;float fog:TEXCOORD2;};
   V vert(A v){V o;o.world=TransformObjectToWorld(v.positionOS.xyz);o.world.y+=sin(o.world.x*.8+_Time.y*1.4)*.025+sin(o.world.z*.7-_Time.y)*.018;o.positionCS=TransformWorldToHClip(o.world);o.screen=ComputeScreenPos(o.positionCS);o.fog=ComputeFogFactor(o.positionCS.z);return o;}
   half4 frag(V i):SV_Target {
    float2 uv=i.screen.xy/i.screen.w;float scene=LinearEyeDepth(SampleSceneDepth(uv),_ZBufferParams);float water=-TransformWorldToView(i.world).z;float depth=max(0,scene-water);
    float2 p=i.world.xz;float wave=sin(p.x*2.2+sin(p.y*.8-_Time.y*.7))*sin(p.y*3-_Time.y*1.8);
    float ribbons=pow(saturate(sin(p.y*5.5-_Time.y*2.4+sin(p.x*2)*1.4)),18)*.065;
    float edge=(1-smoothstep(.04,.65,depth))*smoothstep(-.3,.55,wave);
    float3 view=normalize(_WorldSpaceCameraPos-i.world);float fresnel=pow(1-saturate(view.y),4);
    half3 color=lerp(_Shallow.rgb,_Deep.rgb,saturate(depth*.22));color=lerp(color,half3(.63,.77,.77),fresnel*.45);color+=ribbons*half3(.58,.83,.80);color=lerp(color,half3(.85,.98,.91),edge*.85);
    float glint=pow(saturate(sin(p.x*8+p.y*4-_Time.y*2.3)),55)*pow(saturate(wave),7);color+=glint*.16;
    float distanceFade=1-smoothstep(14,48,i.world.z);
    return half4(MixFog(color,i.fog),(lerp(.64,.94,saturate(depth*.7))+edge*.05)*distanceFade);
   }
   ENDHLSL
  }
 }
}
