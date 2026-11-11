Shader "Island/Lightning Ground Arc" {
 SubShader {Tags {"RenderPipeline"="UniversalPipeline" "Queue"="Transparent+2" "RenderType"="Transparent"}
  Pass {Blend SrcAlpha One ZWrite Off ZTest Always Cull Off
   HLSLPROGRAM
   #pragma vertex vert
   #pragma fragment frag
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
   #include "LightningSurface.hlsl"
   struct A {float4 positionOS:POSITION;float4 color:COLOR;};
   struct V {float4 positionCS:SV_POSITION;float3 world:TEXCOORD0;float4 screen:TEXCOORD1;half4 color:COLOR;};
   V vert(A v){V o;o.world=TransformObjectToWorld(v.positionOS.xyz);o.positionCS=TransformWorldToHClip(o.world);o.screen=ComputeScreenPos(o.positionCS);o.color=v.color;return o;}
   half4 frag(V i):SV_Target {LightningSurfaceOcclusion(i.world,i.screen.xy/i.screen.w);return i.color;}
   ENDHLSL
  }
 }
}
