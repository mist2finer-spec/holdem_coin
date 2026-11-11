Shader "Island/Elemental Distortion" {
 SubShader { Tags { "RenderPipeline"="UniversalPipeline" "Queue"="Transparent-10" "RenderType"="Transparent" }
  Pass { Blend SrcAlpha OneMinusSrcAlpha ZWrite Off Cull Off
   HLSLPROGRAM
   #pragma vertex vert
   #pragma fragment frag
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/DeclareOpaqueTexture.hlsl"
   struct A{float4 positionOS:POSITION;float4 color:COLOR;float2 uv:TEXCOORD0;};
   struct V{float4 positionCS:SV_POSITION;half4 color:COLOR;float2 uv:TEXCOORD0;};
   V vert(A v){V o;o.positionCS=TransformObjectToHClip(v.positionOS.xyz);o.color=v.color;o.uv=v.uv;return o;}
   half4 frag(V i):SV_Target {float edge=sin(saturate(i.uv.y)*3.14159);float2 uv=i.positionCS.xy/_ScaledScreenParams.xy;float2 offset=float2(sin(i.uv.x*19),cos(i.uv.x*13))*.002*edge;return half4(SampleSceneColor(uv+offset),i.color.a*.22*edge);}
   ENDHLSL
  }
 }
}
