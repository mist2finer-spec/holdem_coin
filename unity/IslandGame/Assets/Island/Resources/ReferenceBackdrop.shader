Shader "Island/Reference Backdrop" {
 Properties { _MainTex("Panorama",2D)="white"{} }
 SubShader {
  Tags { "RenderPipeline"="UniversalPipeline" "Queue"="Geometry+10" "RenderType"="Opaque" }
  Pass {
   Cull Off
   HLSLPROGRAM
   #pragma vertex vert
   #pragma fragment frag
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
   TEXTURE2D(_MainTex);SAMPLER(sampler_MainTex);
   struct A{float4 positionOS:POSITION;float2 uv:TEXCOORD0;};
   struct V{float4 positionCS:SV_POSITION;float2 uv:TEXCOORD0;};
   V vert(A v){V o;o.positionCS=TransformObjectToHClip(v.positionOS.xyz);o.uv=v.uv;return o;}
   half4 frag(V i):SV_Target{return half4(SAMPLE_TEXTURE2D(_MainTex,sampler_MainTex,float2(i.uv.x,i.uv.y*.9-.06)).rgb,1);}
   ENDHLSL
  }
 }
}
