Shader "Island/Lightning Ground" {
 Properties { _Age("Age",Float)=0 _Strength("Strength",Float)=1 }
 SubShader {Tags {"RenderPipeline"="UniversalPipeline" "Queue"="Transparent+1" "RenderType"="Transparent"}
  Pass {Blend SrcAlpha One ZWrite Off ZTest Always Cull Off
   HLSLPROGRAM
   #pragma vertex vert
   #pragma fragment frag
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
   #include "LightningSurface.hlsl"
   struct A {float4 positionOS:POSITION;float2 uv:TEXCOORD0;};
   struct V {float4 positionCS:SV_POSITION;float2 uv:TEXCOORD0;float3 world:TEXCOORD1;float4 screen:TEXCOORD2;};
   CBUFFER_START(UnityPerMaterial)
   float _Age,_Strength;
   CBUFFER_END
   V vert(A v){V o;o.world=TransformObjectToWorld(v.positionOS.xyz);o.positionCS=TransformWorldToHClip(o.world);o.screen=ComputeScreenPos(o.positionCS);o.uv=v.uv;return o;}
   half4 frag(V i):SV_Target {
    LightningSurfaceOcclusion(i.world,i.screen.xy/i.screen.w);
    float r=length(i.uv*2-1),progress=saturate(_Age/.22),radius=lerp(.08,.97,sqrt(progress));
    float ring=saturate(1-abs(r-radius)/.035)*pow(1-saturate(_Age/.32),1.5);
    float disk=pow(saturate(1-r),2)*pow(1-saturate(_Age/.085),2)*1.2;
    float rays=pow(abs(sin(atan2(i.uv.y-.5,i.uv.x-.5)*12)),18)*saturate(1-r)*saturate(1-_Age/.12)*.3;
    return half4(1.35,1.7,2.6,saturate((ring+disk+rays)*_Strength));
   }
   ENDHLSL
  }
 }
}
