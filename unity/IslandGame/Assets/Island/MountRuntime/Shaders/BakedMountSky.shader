Shader "Island/Mount/BakedSky" {
 Properties { _Tex("Baked map cubemap",Cube)=""{} }
 SubShader { Tags {"Queue"="Background" "RenderType"="Background" "PreviewType"="Skybox" "RenderPipeline"="UniversalPipeline"} Cull Off ZWrite Off
 Pass { HLSLPROGRAM
 #pragma vertex vert
 #pragma fragment frag
 #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
 TEXTURECUBE(_Tex);SAMPLER(sampler_Tex);
 struct A{float4 p:POSITION;};struct V{float4 p:SV_POSITION;float3 d:TEXCOORD0;};
 V vert(A a){V o;o.p=TransformObjectToHClip(a.p.xyz);o.d=a.p.xyz;return o;}
 // URP 17 DX11 RenderToCubemap readback in this project stores world Y inverted.
 half4 frag(V i):SV_Target{return half4(SAMPLE_TEXTURECUBE(_Tex,sampler_Tex,float3(i.d.x,-i.d.y,i.d.z)).rgb,1);}
 ENDHLSL }
 }
}
