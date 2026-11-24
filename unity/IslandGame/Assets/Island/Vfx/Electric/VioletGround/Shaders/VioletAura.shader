Shader "Violet Ground FX/Aura"
{
    Properties
    {
        _Flow ("Ground flow atlas", 2D) = "black" {}
        [HideInInspector] _Mode ("Layer", Float) = 0
        [PerRendererData] _Clock ("Loop time", Float) = 0
        [PerRendererData] _GroundGain ("Ground strength", Float) = 1
        [PerRendererData] _GroundFill ("Ground fill", Float) = 1
        [PerRendererData] _AirGain ("Accent strength", Float) = 1
        _Absorb ("Island: dim what is behind the glow (0 = pure additive)", Range(0,1)) = 0
    }
    SubShader
    {
        Tags { "Queue"="Transparent" "RenderType"="Transparent" "IgnoreProjector"="True" "DisableBatching"="True" }
        Pass
        {
            Cull Off
            ZWrite Off
            ZTest LEqual
            // Island: One/OneMinusSrcAlpha with alpha = _Absorb * glow. _Absorb 0 gives exactly the original One/One.
            Blend One OneMinusSrcAlpha
            ColorMask RGB
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma target 3.0
            #include "UnityCG.cginc"
            sampler2D _Flow;
            float4 _Flow_TexelSize;
            float _Mode, _Clock, _GroundGain, _GroundFill, _AirGain, _Absorb;
            struct appdata
            {
                float4 vertex : POSITION;
                float4 tangent : TANGENT;
                float2 uv : TEXCOORD0;
                float4 motion : TEXCOORD1;
                float4 style : TEXCOORD2;
            };
            struct v2f
            {
                float4 pos : SV_POSITION;
                float2 uv : TEXCOORD0;
                float amp : TEXCOORD1;
            };
            v2f vert(appdata v)
            {
                v2f o;
                o.uv = v.uv;
                o.amp = 1;
                float3 p = v.vertex.xyz;
                float scale = length(mul((float3x3)unity_ObjectToWorld, float3(1,0,0)));
                if (_Mode > .5 && _Mode < 1.5)
                {
                    float life = frac(_Clock * v.motion.y / 8 + v.motion.x);
                    float ang = v.style.y + life * 3.1;
                    p.xz += v.style.x * life * float2(sin(ang), cos(ang));
                    p.y += v.motion.z * life;
                    float fade = smoothstep(0,.15,life) * (1-smoothstep(.58,1,life));
                    o.amp = fade * v.style.z;
                    float4 view = mul(UNITY_MATRIX_MV, float4(p,1));
                    view.xy += v.uv * (v.motion.w * scale * (.74 + .26*fade) * 2.3);
                    o.pos = mul(UNITY_MATRIX_P, view);
                }
                else if (_Mode >= 1.5)
                {
                    float life = (_Clock - v.motion.x) / v.motion.y;
                    o.amp = 0;
                    if (life >= 0 && life < 1)
                    {
                        float first = exp(-6*max(0,life-.11)) * smoothstep(0,.055,life);
                        float second = .82 * exp(-7.5*max(0,life-.48)) * smoothstep(.35,.43,life);
                        float draw = smoothstep(-.18,.02,life*11 - v.uv.y);
                        o.amp = (first + second) * (1-smoothstep(.78,1,life)) * v.motion.z * draw;
                    }
                    float4 view = mul(UNITY_MATRIX_MV, float4(p,1));
                    float2 d = mul((float3x3)UNITY_MATRIX_MV, v.tangent.xyz).xy;
                    float2 side = float2(-d.y,d.x) * rsqrt(max(dot(d,d),.000001));
                    float taper = .36 + .64*sin(UNITY_PI * saturate(v.uv.y));
                    view.xy += side * (v.uv.x * v.motion.w * taper * scale);
                    o.pos = mul(UNITY_MATRIX_P, view);
                }
                else o.pos = UnityObjectToClipPos(v.vertex);
                return o;
            }
            float3 frameMask(float frame, float2 uv)
            {
                float2 tile = float2(fmod(frame,8), 7-floor(frame/8));
                float2 inset = .5 * _Flow_TexelSize.xy * 8;
                return tex2D(_Flow, (tile + clamp(uv,inset,1-inset))/8).rgb;
            }
            float4 frag(v2f i) : SV_Target
            {
                float3 rgb;
                if (_Mode < .5)
                {
                    float f = frac(_Clock/4) * 64;
                    float3 m = lerp(frameMask(floor(f),i.uv),frameMask(fmod(floor(f)+1,64),i.uv),frac(f));
                    rgb = (m.r*float3(.43,.13,.59) + m.g*float3(.64,.55,.52) + (m.b*_GroundFill)*float3(.33,.095,.65)) * _GroundGain;
                }
                else if (_Mode < 1.5)
                {
                    float d2 = dot(i.uv,i.uv);
                    float halo = exp(-4.4*d2) * (1-smoothstep(.65,1,d2));
                    float core = exp(-23*d2);
                    rgb = (halo*float3(.50,.18,.91) + core*float3(.56,.49,.51)) * i.amp * _AirGain;
                }
                else
                {
                    float d=abs(i.uv.x);
                    float halo = exp(-3*d*d) * (1-smoothstep(.74,1,d));
                    float core = exp(-17*d*d);
                    rgb = (halo*float3(.31,.15,.83) + core*float3(.69,.76,.55)) * i.amp * _AirGain;
                }
                rgb = saturate(rgb);
                float absorb = _Absorb * saturate(max(rgb.r, max(rgb.g, rgb.b)) * 2.2);
                #ifndef UNITY_COLORSPACE_GAMMA
                rgb = GammaToLinearSpace(rgb);
                #endif
                return float4(rgb,absorb);
            }
            ENDCG
        }
    }
    Fallback Off
}

