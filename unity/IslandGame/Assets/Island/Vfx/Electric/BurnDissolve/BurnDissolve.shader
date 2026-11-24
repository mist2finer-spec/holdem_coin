// Island electric "burning death" dissolve (technical-artist, 2026-11-23).
// One parameter drives it: _Progress 0 (intact) -> 1 (gone). The cut follows a world-height gradient (bottom -> top) mixed with
// 3D value noise measured in metres from the object origin, so slimes and the giant boss burn at the same grain.
// The burnt band darkens (_CharColor) and the cut edge glows violet in HDR (bloom threshold 1.15 in game).
// Used by BurnDissolve.cs, which swaps it onto a renderer's material slots and copies _BaseMap/_BaseColor from the original.
Shader "Island/Vfx/Burn Dissolve"
{
    Properties
    {
        _BaseMap ("Base Map", 2D) = "white" {}
        _BaseColor ("Base Color", Color) = (1,1,1,1)
        _Progress ("Progress", Range(0,1)) = 0
        _EdgeWidth ("Edge Width", Range(0.01,0.5)) = 0.11
        [HDR] _EdgeColor ("Edge Color", Color) = (1.3,0.35,3.6,1)
        [HDR] _EdgeHot ("Edge Hot Core", Color) = (2.2,1.2,4.0,1)
        _CharColor ("Char Color", Color) = (0.07,0.03,0.11,1)
        _NoiseScale ("Noise cells per metre", Float) = 9
        _HeightWeight ("Height weight (0 random, 1 bottom-up)", Range(0,1)) = 0.6
        _HeightRange ("World Y min (x), max (y)", Vector) = (0,2,0,0)
        _Cull ("Cull", Float) = 2
    }
    SubShader
    {
        Tags { "RenderPipeline"="UniversalPipeline" "RenderType"="TransparentCutout" "Queue"="AlphaTest" }

        HLSLINCLUDE
        #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
        CBUFFER_START(UnityPerMaterial)
            float4 _BaseMap_ST;
            half4 _BaseColor;
            half _Progress;
            half _EdgeWidth;
            half4 _EdgeColor;
            half4 _EdgeHot;
            half4 _CharColor;
            float _NoiseScale;
            half _HeightWeight;
            float4 _HeightRange;
            half _Cull;
        CBUFFER_END
        TEXTURE2D(_BaseMap); SAMPLER(sampler_BaseMap);

        float BurnHash(float3 p) { p = frac(p * 0.3183099 + 0.1); p *= 17.0; return frac(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float BurnNoise(float3 x)
        {
            float3 i = floor(x); float3 f = frac(x); f = f * f * (3.0 - 2.0 * f);
            return lerp(lerp(lerp(BurnHash(i), BurnHash(i + float3(1,0,0)), f.x), lerp(BurnHash(i + float3(0,1,0)), BurnHash(i + float3(1,1,0)), f.x), f.y),
                        lerp(lerp(BurnHash(i + float3(0,0,1)), BurnHash(i + float3(1,0,1)), f.x), lerp(BurnHash(i + float3(0,1,1)), BurnHash(i + float3(1,1,1)), f.x), f.y), f.z);
        }
        // 0..1 burn order of a surface point; lower burns first.
        float BurnField(float3 positionWS)
        {
            float3 p = (positionWS - UNITY_MATRIX_M._m03_m13_m23) * _NoiseScale;
            float n = BurnNoise(p) * 0.62 + BurnNoise(p * 2.31 + 7.13) * 0.38;
            float h = saturate((positionWS.y - _HeightRange.x) / max(1e-4, _HeightRange.y - _HeightRange.x));
            return lerp(n, h * 0.8 + n * 0.2, _HeightWeight);
        }
        float BurnThreshold() { return lerp(-_EdgeWidth - 0.02, 1.02, _Progress); }
        ENDHLSL

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode"="UniversalForward" }
            Cull [_Cull]
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile_fragment _ _SHADOWS_SOFT
            #pragma multi_compile_fog
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; float2 uv : TEXCOORD0; };
            struct Varyings { float4 positionCS : SV_POSITION; float2 uv : TEXCOORD0; float3 positionWS : TEXCOORD1; float3 normalWS : TEXCOORD2; float fog : TEXCOORD3; };
            Varyings vert(Attributes i)
            {
                Varyings o; VertexPositionInputs p = GetVertexPositionInputs(i.positionOS.xyz);
                o.positionCS = p.positionCS; o.positionWS = p.positionWS; o.normalWS = TransformObjectToWorldNormal(i.normalOS);
                o.uv = TRANSFORM_TEX(i.uv, _BaseMap); o.fog = ComputeFogFactor(p.positionCS.z); return o;
            }
            half4 frag(Varyings i, bool front : SV_IsFrontFace) : SV_Target
            {
                float f = BurnField(i.positionWS); float T = BurnThreshold();
                clip(f - T);
                half started = saturate(_Progress * 25.0);
                half edge = 1.0 - saturate((f - T) / _EdgeWidth);
                half charBand = (1.0 - saturate((f - T) / (_EdgeWidth * 1.8))) * started;
                half4 base = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, i.uv) * _BaseColor;
                float3 n = normalize(i.normalWS) * (front ? 1.0 : -1.0);
                Light l = GetMainLight(TransformWorldToShadowCoord(i.positionWS));
                half wrap = saturate(dot(n, l.direction) * 0.5 + 0.5);
                half3 lit = base.rgb * (l.color * wrap * l.shadowAttenuation * 0.85 + SampleSH(n));
                half3 col = lerp(lit, _CharColor.rgb, charBand * 0.88);
                col += (_EdgeColor.rgb * edge * edge + _EdgeHot.rgb * pow(edge, 6.0)) * started;
                col = MixFog(col, i.fog);
                return half4(col, 1);
            }
            ENDHLSL
        }

        Pass
        {
            Name "ShadowCaster"
            Tags { "LightMode"="ShadowCaster" }
            ZWrite On ZTest LEqual ColorMask 0 Cull [_Cull]
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_vertex _ _CASTING_PUNCTUAL_LIGHT_SHADOW
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            float3 _LightDirection;
            float3 _LightPosition;
            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; };
            struct Varyings { float4 positionCS : SV_POSITION; float3 positionWS : TEXCOORD0; };
            Varyings vert(Attributes i)
            {
                Varyings o; float3 ws = TransformObjectToWorld(i.positionOS.xyz); float3 nws = TransformObjectToWorldNormal(i.normalOS);
                #if _CASTING_PUNCTUAL_LIGHT_SHADOW
                    float3 ld = normalize(_LightPosition - ws);
                #else
                    float3 ld = _LightDirection;
                #endif
                float4 c = TransformWorldToHClip(ApplyShadowBias(ws, nws, ld));
                #if UNITY_REVERSED_Z
                    c.z = min(c.z, UNITY_NEAR_CLIP_VALUE);
                #else
                    c.z = max(c.z, UNITY_NEAR_CLIP_VALUE);
                #endif
                o.positionCS = c; o.positionWS = ws; return o;
            }
            half4 frag(Varyings i) : SV_Target { clip(BurnField(i.positionWS) - BurnThreshold()); return 0; }
            ENDHLSL
        }

        Pass
        {
            Name "DepthOnly"
            Tags { "LightMode"="DepthOnly" }
            ZWrite On ColorMask R Cull [_Cull]
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            struct Attributes { float4 positionOS : POSITION; };
            struct Varyings { float4 positionCS : SV_POSITION; float3 positionWS : TEXCOORD0; };
            Varyings vert(Attributes i) { Varyings o; o.positionWS = TransformObjectToWorld(i.positionOS.xyz); o.positionCS = TransformWorldToHClip(o.positionWS); return o; }
            half4 frag(Varyings i) : SV_Target { clip(BurnField(i.positionWS) - BurnThreshold()); return 0; }
            ENDHLSL
        }
    }
    Fallback Off
}
