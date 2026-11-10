Shader "Island/Combat Occluded Hero" {
 Properties { _Tint ("Occluded silhouette", Color) = (1,0.72,0.28,0.65) }
 SubShader {
  Tags { "RenderPipeline"="UniversalPipeline" "Queue"="Transparent+10" "RenderType"="Transparent" }
  Pass {
   Name "OccludedHero"
   Tags { "LightMode"="SRPDefaultUnlit" }
   Blend SrcAlpha OneMinusSrcAlpha
   ZWrite Off ZTest Greater Cull Back
   Offset -1, -1
   HLSLPROGRAM
   #pragma vertex Vert
   #pragma fragment Frag
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
   CBUFFER_START(UnityPerMaterial)
    half4 _Tint;
   CBUFFER_END
   struct Attributes { float4 positionOS : POSITION; };
   struct Varyings { float4 positionCS : SV_POSITION; };
   Varyings Vert(Attributes i) { Varyings o; o.positionCS=TransformObjectToHClip(i.positionOS.xyz); return o; }
   half4 Frag(Varyings i) : SV_Target { return _Tint; }
   ENDHLSL
  }
 }
}
