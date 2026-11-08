Shader "MountSunday/Environment"
{
    Properties
    {
        [MainTexture] _BaseMap("Base texture", 2D) = "white" {}
        [MainColor] _BaseColor("Base colour", Color) = (1,1,1,1)
        _VertexColorStrength("Vertex colour", Range(0,1)) = 1
        _Roughness("Roughness", Range(0,1)) = 0.8
        _DetailScale("World detail scale", Float) = 1
        _DetailStrength("World detail strength", Range(0,0.35)) = 0.13
        _WindStrength("Plant wind (metres)", Range(0,0.3)) = 0
        _WaterStrength("Water ripples (metres)", Range(0,0.2)) = 0
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" "Queue"="Geometry" "RenderPipeline"="UniversalPipeline" "DisableBatching"="True" }
        LOD 200
        Cull Off
        HLSLINCLUDE
        #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
        CBUFFER_START(UnityPerMaterial)
            float4 _BaseMap_ST;
            half4 _BaseColor;
            float _VertexColorStrength;
            float _Roughness;
            float _DetailScale;
            float _DetailStrength;
            float _WindStrength;
            float _WaterStrength;
        CBUFFER_END
        TEXTURE2D(_BaseMap); SAMPLER(sampler_BaseMap);
        struct Attributes {
            float4 positionOS : POSITION;
            float3 normalOS : NORMAL;
            float2 uv : TEXCOORD0;
            half4 color : COLOR;
            UNITY_VERTEX_INPUT_INSTANCE_ID
        };
        float3 StageWorldPosition(float3 positionOS) {
            float3 p = TransformObjectToWorld(positionOS);
            float phase = p.x * .19 + p.z * .13 + _Time.y * 1.6;
            float3 anchor = TransformObjectToWorld(float3(0,0,0));
            float bend = saturate((p.y - anchor.y) * .65) * _WindStrength;
            p.x += sin(phase) * bend;
            p.z += cos(phase * .83) * bend * .6;
            p.y += (sin(p.x * .7 + p.z * .25 + _Time.y * 1.2) + cos(p.z * 1.1 - _Time.y * .8)) * _WaterStrength * .5;
            return p;
        }
        float Hash31(float3 p) {
            p = frac(p * .1031);
            p += dot(p, p.yzx + 33.33);
            return frac((p.x + p.y) * p.z);
        }
        float StageNoise(float3 p) {
            float3 i = floor(p), f = frac(p);
            f = f * f * (3.0 - 2.0 * f);
            return lerp(lerp(lerp(Hash31(i), Hash31(i + float3(1,0,0)), f.x),
                             lerp(Hash31(i + float3(0,1,0)), Hash31(i + float3(1,1,0)), f.x), f.y),
                        lerp(lerp(Hash31(i + float3(0,0,1)), Hash31(i + float3(1,0,1)), f.x),
                             lerp(Hash31(i + float3(0,1,1)), Hash31(i + float3(1,1,1)), f.x), f.y), f.z);
        }
        ENDHLSL

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode"="UniversalForwardOnly" }
            HLSLPROGRAM
            #pragma target 3.5
            #pragma vertex Vert
            #pragma fragment Frag
            #pragma multi_compile_instancing
            #pragma multi_compile_fog
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile_fragment _ _SHADOWS_SOFT
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            struct Varyings {
                float4 positionCS : SV_POSITION;
                float3 positionWS : TEXCOORD0;
                half3 normalWS : TEXCOORD1;
                float2 uv : TEXCOORD2;
                half4 color : TEXCOORD3;
                half fog : TEXCOORD4;
                UNITY_VERTEX_INPUT_INSTANCE_ID
                UNITY_VERTEX_OUTPUT_STEREO
            };
            Varyings Vert(Attributes input) {
                Varyings output = (Varyings)0;
                UNITY_SETUP_INSTANCE_ID(input);
                UNITY_TRANSFER_INSTANCE_ID(input, output);
                UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(output);
                output.positionWS = StageWorldPosition(input.positionOS.xyz);
                output.positionCS = TransformWorldToHClip(output.positionWS);
                output.normalWS = TransformObjectToWorldNormal(input.normalOS);
                output.uv = TRANSFORM_TEX(input.uv, _BaseMap);
                output.color = input.color;
                output.fog = ComputeFogFactor(output.positionCS.z);
                return output;
            }
            half4 Frag(Varyings input, FRONT_FACE_TYPE frontFace : FRONT_FACE_SEMANTIC) : SV_Target {
                UNITY_SETUP_INSTANCE_ID(input);
                UNITY_SETUP_STEREO_EYE_INDEX_POST_VERTEX(input);
                half3 normal = normalize(input.normalWS) * IS_FRONT_VFACE(frontFace, 1.0h, -1.0h);
                if (_WaterStrength > 0) {
                    float p = input.positionWS.x * .7 + input.positionWS.z * .25 + _Time.y * 1.2;
                    normal = normalize(normal + half3(-cos(p) * .35, 0, -cos(p) * .125 + sin(input.positionWS.z * 1.1 - _Time.y * .8) * .55) * _WaterStrength);
                }
                half3 vertex = lerp(half3(1,1,1), input.color.rgb, _VertexColorStrength);
                half3 albedo = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, input.uv).rgb * _BaseColor.rgb * vertex;
                float detail = StageNoise(input.positionWS * _DetailScale) * .7 + StageNoise(input.positionWS * _DetailScale * 3.7) * .3;
                albedo *= 1 + (detail - .5) * _DetailStrength * 2;
                Light sun = GetMainLight(TransformWorldToShadowCoord(input.positionWS));
                half diffuse = saturate(dot(normal, sun.direction));
                half3 ambient = max(SampleSH(normal), half3(.025, .025, .025));
                half3 color = albedo * (ambient + sun.color * diffuse * sun.shadowAttenuation * sun.distanceAttenuation);
                half3 viewDirection = SafeNormalize(GetWorldSpaceViewDir(input.positionWS));
                half3 halfway = SafeNormalize(sun.direction + viewDirection);
                half shininess = lerp(96.0h, 4.0h, saturate(_Roughness));
                half specular = pow(saturate(dot(normal, halfway)), shininess) * (1 - _Roughness) * .18h;
                color += sun.color * specular * sun.shadowAttenuation;
                return half4(MixFog(color, input.fog), 1);
            }
            ENDHLSL
        }
        Pass
        {
            Name "ShadowCaster"
            Tags { "LightMode"="ShadowCaster" }
            ZWrite On
            ZTest LEqual
            ColorMask 0
            HLSLPROGRAM
            #pragma target 3.5
            #pragma vertex ShadowVert
            #pragma fragment ShadowFrag
            #pragma multi_compile_instancing
            #pragma multi_compile_vertex _ _CASTING_PUNCTUAL_LIGHT_SHADOW
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Shadows.hlsl"
            float3 _LightDirection;
            float3 _LightPosition;
            struct ShadowVaryings { float4 positionCS : SV_POSITION; };
            ShadowVaryings ShadowVert(Attributes input) {
                UNITY_SETUP_INSTANCE_ID(input);
                ShadowVaryings output;
                float3 positionWS = StageWorldPosition(input.positionOS.xyz);
                float3 normalWS = TransformObjectToWorldNormal(input.normalOS);
                #if defined(_CASTING_PUNCTUAL_LIGHT_SHADOW)
                    float3 lightDirection = normalize(_LightPosition - positionWS);
                #else
                    float3 lightDirection = _LightDirection;
                #endif
                output.positionCS = TransformWorldToHClip(ApplyShadowBias(positionWS, normalWS, lightDirection));
                #if UNITY_REVERSED_Z
                    output.positionCS.z = min(output.positionCS.z, UNITY_NEAR_CLIP_VALUE * output.positionCS.w);
                #else
                    output.positionCS.z = max(output.positionCS.z, UNITY_NEAR_CLIP_VALUE * output.positionCS.w);
                #endif
                return output;
            }
            half4 ShadowFrag(ShadowVaryings input) : SV_Target { return 0; }
            ENDHLSL
        }
        Pass
        {
            Name "DepthOnly"
            Tags { "LightMode"="DepthOnly" }
            ZWrite On
            ColorMask R
            HLSLPROGRAM
            #pragma target 3.5
            #pragma vertex DepthVert
            #pragma fragment DepthFrag
            #pragma multi_compile_instancing
            float4 DepthVert(Attributes input) : SV_POSITION {
                UNITY_SETUP_INSTANCE_ID(input);
                return TransformWorldToHClip(StageWorldPosition(input.positionOS.xyz));
            }
            half4 DepthFrag() : SV_Target { return 0; }
            ENDHLSL
        }
    }
    FallBack Off
}
