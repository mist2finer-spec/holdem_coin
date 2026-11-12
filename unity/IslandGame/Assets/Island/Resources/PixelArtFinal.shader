Shader "Island/Pixel Art Final" {
 SubShader { Tags {"RenderPipeline"="UniversalPipeline"} ZWrite Off ZTest Always Cull Off
 Pass { Name "EdgesThenPalette"
 HLSLPROGRAM
 #pragma vertex Vert
 #pragma fragment Frag
 #pragma target 3.5
 #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
 #include "Packages/com.unity.render-pipelines.core/Runtime/Utilities/Blit.hlsl"
 #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/DeclareDepthTexture.hlsl"
 float Depth(float2 uv) {
  float d=SampleSceneDepth(saturate(uv));
  if(unity_OrthoParams.w>.5){
   #if UNITY_REVERSED_Z
    d=1-d;
   #endif
   return lerp(_ProjectionParams.y,_ProjectionParams.z,d);
  }
  return LinearEyeDepth(d,_ZBufferParams);
 }
 float3 Position(float2 uv){float d=SampleSceneDepth(saturate(uv));
 #if !UNITY_REVERSED_Z
 d=lerp(UNITY_NEAR_CLIP_VALUE,1,d);
 #endif
 return ComputeWorldSpacePosition(uv,d,UNITY_MATRIX_I_VP);}
 // Reconstruct geometric normals from depth: also works with custom vegetation shaders
 // without a DepthNormals pass, retaining their alpha-cutout depth silhouettes.
 float3 Normal(float2 uv,float2 px){
  float3 c=Position(uv),l=Position(uv-float2(px.x,0)),r=Position(uv+float2(px.x,0));
  float3 d=Position(uv-float2(0,px.y)),u=Position(uv+float2(0,px.y));
  float3 x=abs(Depth(uv-float2(px.x,0))-Depth(uv))<abs(Depth(uv+float2(px.x,0))-Depth(uv))?c-l:r-c;
  float3 y=abs(Depth(uv-float2(0,px.y))-Depth(uv))<abs(Depth(uv+float2(0,px.y))-Depth(uv))?c-d:u-c;
  return SafeNormalize(cross(x,y));
 }
 static const float3 Palette[32]={
 float3(20,24,35),float3(34,38,52),float3(49,55,65),float3(69,77,77),
 float3(93,105,98),float3(128,142,129),float3(176,185,159),float3(222,220,183),
 float3(28,48,43),float3(40,68,49),float3(57,89,52),float3(78,112,57),
 float3(104,136,64),float3(137,160,81),float3(174,185,111),float3(207,207,146),
 float3(54,39,40),float3(80,54,45),float3(111,75,52),float3(145,102,65),
 float3(181,133,87),float3(216,166,116),float3(242,204,155),float3(255,238,208),
 float3(35,52,77),float3(47,79,109),float3(67,116,144),float3(105,162,176),
 float3(156,204,212),float3(243,249,231),float3(152,65,65),float3(212,115,90)};
 static const float Bayer[16]={0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5};
 half4 Frag(Varyings i):SV_Target {
  float2 px=_BlitTexture_TexelSize.xy,uv=i.texcoord;
  float3 c=SAMPLE_TEXTURE2D_X(_BlitTexture,sampler_PointClamp,uv).rgb;
  float z=Depth(uv),edge=0;
  float2 offsets[4]={float2(px.x,0),float2(-px.x,0),float2(0,px.y),float2(0,-px.y)};
  float threshold=max(.09,z*.006);
  [unroll]for(int j=0;j<4;j++)edge=max(edge,step(threshold,Depth(uv+offsets[j])-z));
  float3 n=Normal(uv,px);
  float crease=1-min(dot(n,Normal(uv+float2(px.x,0),px)),dot(n,Normal(uv+float2(0,px.y),px)));
  float highlight=step(.22,crease)*(1-edge)*step(z,_ProjectionParams.z*.98);
  c=lerp(c,c*.48,edge);c+=highlight*.055;
  #if !defined(UNITY_COLORSPACE_GAMMA)
   c=LinearToSRGB(c);
  #endif
  uint2 cell=(uint2)floor(uv*_BlitTexture_TexelSize.zw);
  c=saturate(c+(Bayer[(cell.y%4)*4+cell.x%4]/16.0-.46875)*.045);
  float best=1e9;float3 chosen=0;
  [unroll]for(int k=0;k<32;k++){float3 p=Palette[k]/255.0;float3 delta=c-p;float distance=dot(delta*delta,float3(.30,.59,.11));if(distance<best){best=distance;chosen=p;}}
  #if !defined(UNITY_COLORSPACE_GAMMA)
   chosen=SRGBToLinear(chosen);
  #endif
  return half4(chosen,1);
 }
 ENDHLSL
 }
 }
}
