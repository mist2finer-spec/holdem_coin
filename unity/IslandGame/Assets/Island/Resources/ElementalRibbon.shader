Shader "Island/Elemental Ribbon" {
 Properties { _Soft("Soft particle",Float)=0 }
 SubShader { Tags { "RenderPipeline"="UniversalPipeline" "Queue"="Transparent" "RenderType"="Transparent" }
  Pass { Blend SrcAlpha One ZWrite Off Cull Off
   HLSLPROGRAM
   #pragma vertex vert
   #pragma fragment frag
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
   struct A {float4 positionOS:POSITION;float4 color:COLOR;float2 uv:TEXCOORD0;};
   struct V {float4 positionCS:SV_POSITION;half4 color:COLOR;float2 uv:TEXCOORD0;};
   CBUFFER_START(UnityPerMaterial)
   float _Soft;
   CBUFFER_END
   V vert(A v){V o;o.positionCS=TransformObjectToHClip(v.positionOS.xyz);o.color=v.color;o.uv=v.uv;return o;}
   half4 frag(V i):SV_Target {float soft=saturate(1-length(i.uv*2-1));i.color.a*=lerp(1,soft*soft,_Soft);return i.color;}
   ENDHLSL
  }
 }
}
