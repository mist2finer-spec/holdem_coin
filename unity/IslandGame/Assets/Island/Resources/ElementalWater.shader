Shader "Island/Elemental Water" {
 Properties { _Tint("Water tint",Color)=(0.08,0.65,1,0.2) }
 SubShader { Tags { "RenderPipeline"="UniversalPipeline" "Queue"="Transparent" "RenderType"="Transparent" }
  Pass { Blend SrcAlpha OneMinusSrcAlpha ZWrite Off Cull Back
   HLSLPROGRAM
   #pragma vertex vert
   #pragma fragment frag
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
   struct A{float4 positionOS:POSITION;float3 normalOS:NORMAL;};
   struct V{float4 positionCS:SV_POSITION;float3 normalWS:TEXCOORD0;float3 positionWS:TEXCOORD1;};
   CBUFFER_START(UnityPerMaterial)
   half4 _Tint;
   CBUFFER_END
   V vert(A v){V o;o.positionWS=TransformObjectToWorld(v.positionOS.xyz);o.positionCS=TransformWorldToHClip(o.positionWS);o.normalWS=TransformObjectToWorldNormal(v.normalOS);return o;}
   half4 frag(V i):SV_Target {
    float3 n=normalize(i.normalWS),v=normalize(GetWorldSpaceViewDir(i.positionWS));float rim=pow(1-saturate(dot(n,v)),2.8);
    float highlight=pow(saturate(dot(n,normalize(float3(-.5,.9,-.8)+v))),48);
    float bands=pow(saturate(sin(n.y*17+n.x*5)),14)*.14;
    half3 color=lerp(_Tint.rgb*.28,half3(.42,1.0,1.5),rim)+highlight*half3(2,2.2,2.3)+bands;
    return half4(color,saturate(.17+rim*.72+highlight*.8));
   }
   ENDHLSL
  }
 }
}
