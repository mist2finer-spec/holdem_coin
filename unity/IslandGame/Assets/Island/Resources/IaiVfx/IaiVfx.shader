// V2 kit basic attack VFX (pink-iai). One shader, four looks picked by a material keyword.
// Premultiplied alpha: the dark rim really darkens what is behind, the white core stays the brightest point,
// no additive glow. Colour always comes from the R0 ramp row in vertex colour R (V 0.875 / 0.625 / 0.375 / 0.125).
// Vertex colour: R = ramp row V, G = opacity, B = arc break-up (0 whole .. 1 gone).
// _IAI_FLIP (DBFZ-style arc life, IaiSlashProfile.json): _MainTex is a cols x rows flipbook (R10, same channels as R1);
// _Cell picks the cell (set per arc renderer), _LifeColor multiplies the colour (HDR, colour over life).
// _IAI_CFLIP (C "백광 플립북", art_helper export/C): _MainTex is the 2 x 4 colour flipbook (sRGB colour + straight alpha, cell 0 top
// left, reading order); the fixed arc mesh UV is U tail 0 -> head 1, V inner 0 -> outer 1. _Head remaps U (u' = u / head, the
// grow), _Alpha is the renderer opacity. The cells carry the white mix, thinning, erosion and tail cut already (spec.json).
// _IAI_PREMUL (C hit flash): straight-alpha colour texture, vertex colour G = opacity.
Shader "Island/Iai Vfx" {
 Properties {
  _MainTex("Mask",2D)="black"{}
  _Grain("Flow grain (R2)",2D)="black"{}
  _Ramp("Ramp (R0)",2D)="white"{}
  _DustLo("Dust shadow",Color)=(0.176,0.169,0.208,1)
  _DustHi("Dust light",Color)=(0.514,0.486,0.525,1)
  [Enum(UnityEngine.Rendering.CompareFunction)] _ZTest("ZTest",Float)=4
  _FlipGrid("Flipbook cols, rows, inset u, inset v",Vector)=(4,2,0.0078125,0.03125)
  _Cell("Flipbook cell",Float)=0
  [HDR] _LifeColor("Colour over life",Color)=(1,1,1,1)
  _Head("C grow head (U remap)",Float)=1
  _Alpha("C opacity",Float)=1
 }
 SubShader {
  Tags { "RenderPipeline"="UniversalPipeline" "Queue"="Transparent" "RenderType"="Transparent" "IgnoreProjector"="True" }
  Pass {
   // Arc, dust and ground glow test depth (the sweep passes behind the body); stars, embers, line and glint draw on top.
   Blend One OneMinusSrcAlpha ZWrite Off Cull Off ZTest [_ZTest]
   HLSLPROGRAM
   #pragma vertex vert
   #pragma fragment frag
   #pragma multi_compile_local _IAI_ARC _IAI_INK _IAI_TINT _IAI_DUST _IAI_FLIP _IAI_CFLIP _IAI_PREMUL
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
   TEXTURE2D(_MainTex);SAMPLER(sampler_MainTex);
   TEXTURE2D(_Grain);SAMPLER(sampler_Grain);
   TEXTURE2D(_Ramp);SAMPLER(sampler_Ramp);
   CBUFFER_START(UnityPerMaterial)
   float4 _MainTex_ST;float4 _MainTex_TexelSize;float4 _Grain_ST;float4 _Ramp_ST;half4 _DustLo;half4 _DustHi;float4 _FlipGrid;float _Cell;float4 _LifeColor;float _Head;float _Alpha;
   CBUFFER_END
   struct A {float4 positionOS:POSITION;float4 color:COLOR;float2 uv:TEXCOORD0;};
   struct V {float4 positionCS:SV_POSITION;half4 color:COLOR;float2 uv:TEXCOORD0;};
   V vert(A v){V o;o.positionCS=TransformObjectToHClip(v.positionOS.xyz);o.color=v.color;o.uv=v.uv;return o;}
   half3 Ramp(float u,float row){return SAMPLE_TEXTURE2D(_Ramp,sampler_Ramp,float2(u,row)).rgb;}
   // One-pixel edge from the mask's own gradient: crisp at any size, no soft halo.
   float Crisp(float m){float w=max(fwidth(m),1e-4);return saturate((m-.5)/w+.5);}
   half4 frag(V i):SV_Target {
    float row=i.color.r,opacity=i.color.g;
   #if defined(_IAI_CFLIP)
    float cell=floor(_Cell+.5),col=fmod(cell,_FlipGrid.x),cellRow=floor(cell/_FlipGrid.x);
    float up=i.uv.x/max(_Head,1e-3);
    float2 inCell=_FlipGrid.zw+saturate(float2(up,i.uv.y))*(1-2*_FlipGrid.zw);
    half4 c=SAMPLE_TEXTURE2D(_MainTex,sampler_MainTex,float2((col+inCell.x)/_FlipGrid.x,1-(cellRow+1-inCell.y)/_FlipGrid.y));
    float a=c.a*_Alpha*step(up,1);
    return half4(c.rgb*a,a);
   #elif defined(_IAI_PREMUL)
    half4 c=SAMPLE_TEXTURE2D(_MainTex,sampler_MainTex,i.uv);
    float a=c.a*opacity;
    return half4(c.rgb*a,a);
   #elif defined(_IAI_FLIP)
    // Same shelves as _IAI_ARC; the break-up is drawn in the cells instead of the grain erosion.
    float cell=floor(_Cell+.5),col=fmod(cell,_FlipGrid.x),cellRow=floor(cell/_FlipGrid.x);
    float2 inCell=_FlipGrid.zw+saturate(i.uv)*(1-2*_FlipGrid.zw);
    float4 m=SAMPLE_TEXTURE2D(_MainTex,sampler_MainTex,float2((col+inCell.x)/_FlipGrid.x,1-(cellRow+1-inCell.y)/_FlipGrid.y));
    float a=Crisp(m.r);
    float g=SAMPLE_TEXTURE2D(_Grain,sampler_Grain,float2(i.uv.x*2.2,i.uv.y)).r;
    float u=g>.6?.72:.39;
    if(m.b>.5)u=.10;
    if(m.g>.5)u=.94;
    a*=opacity;
    return half4(Ramp(u,row)*_LifeColor.rgb*a,a);
   #else
    float4 m=SAMPLE_TEXTURE2D(_MainTex,sampler_MainTex,i.uv);
   #endif
   #if defined(_IAI_FLIP) || defined(_IAI_CFLIP) || defined(_IAI_PREMUL)
   #elif defined(_IAI_ARC)
    // R1: R shape, G white core, B dark rim. U tail -> head, V blade base -> tip.
    float a=Crisp(m.r);
    float g=SAMPLE_TEXTURE2D(_Grain,sampler_Grain,float2(i.uv.x*2.2,i.uv.y)).r;
    float u=g>.6?.72:.39;            // R2 streaks lift the body into the light shelf
    if(m.b>.5)u=.10;                 // rim -> dark edge shelf
    if(m.g>.5)u=.94;                 // core -> white shelf
    // Break-up after the peak: the grain decides which slivers go first, the tail before the head.
    float keep=SAMPLE_TEXTURE2D(_Grain,sampler_Grain,float2(i.uv.x*1.3+.37,i.uv.y*.9+.21)).r*.6+i.uv.x*.4;
    a*=step(i.color.b,keep-.001)*opacity;
    return half4(Ramp(u,row)*a,a);
   #elif defined(_IAI_INK)
    // R3 / R4 / R7: R shape, G core. Same shelf rule as the art preview (sprite_ink): an inward dark edge,
    // light body, core rising to white. The edge is the shape minus its 2-3 px erosion.
    float2 d=_MainTex_TexelSize.xy*2.5;
    float inside=min(min(SAMPLE_TEXTURE2D(_MainTex,sampler_MainTex,i.uv+float2(d.x,0)).r,SAMPLE_TEXTURE2D(_MainTex,sampler_MainTex,i.uv-float2(d.x,0)).r),
                     min(SAMPLE_TEXTURE2D(_MainTex,sampler_MainTex,i.uv+float2(0,d.y)).r,SAMPLE_TEXTURE2D(_MainTex,sampler_MainTex,i.uv-float2(0,d.y)).r));
    float u=max(inside>.5?163./255:26./255,m.g>.02?(157+98*m.g)/255:0);
    float a=Crisp(m.r)*opacity;
    return half4(Ramp(u,row)*a,a);
   #elif defined(_IAI_TINT)
    // R6 / R8 / R9 (L): the value picks the ramp shelf and is the alpha (plain_tint).
    float a=m.r*opacity;
    return half4(Ramp(m.r,row)*a,a);
   #else
    // R5 dust: R light face, G shadow, A shape. Colour = R/A between the two greys; A applied once.
    float a=m.a*opacity;
    half3 c=lerp(_DustLo.rgb,_DustHi.rgb,saturate(m.r/max(m.a,.001)));
    return half4(c*a,a);
   #endif
   }
   ENDHLSL
  }
 }
}
