Shader "RuneBeam/Rune Additive"
{
    Properties
    {
        [NoScaleOffset] _Brush ("Rune seal and beam masks", 2D) = "black" {}
        [HideInInspector] _Timing ("Phase / charge / length / width", Vector) = (0.55,0.36,7.5,1)
        [HideInInspector] _Placement ("Scale / intensity / ground / floor distance", Vector) = (1,1,1,1.41)
        [HDR] _Tint ("Emission tint", Color) = (1,1,1,1)
    }
    SubShader
    {
        Tags { "Queue"="Transparent+20" "RenderType"="Transparent" "IgnoreProjector"="True" "DisableBatching"="True" }
        Pass
        {
            Name "Rune"
            Cull Off ZWrite Off ZTest LEqual
            Blend One One
            ColorMask RGB
            CGPROGRAM
            #pragma target 3.0
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_instancing
            #include "UnityCG.cginc"
            #include "RuneCommon.cginc"
            #include "RuneGeometry.cginc"
            sampler2D _Brush;
            float4 _Timing, _Placement, _Tint;
            struct Attributes
            {
                float4 vertex : POSITION;
                float2 uv : TEXCOORD0;
                float4 motion : TEXCOORD1;
                float4 shape : TEXCOORD2;
                UNITY_VERTEX_INPUT_INSTANCE_ID
            };
            struct Varyings
            {
                float4 position : SV_POSITION;
                float4 coord : TEXCOORD0;
                float4 motion : TEXCOORD1;
                float4 shape : TEXCOORD2;
                UNITY_VERTEX_OUTPUT_STEREO
            };
            Varyings vert(Attributes v)
            {
                Varyings o;
                UNITY_SETUP_INSTANCE_ID(v);
                UNITY_INITIALIZE_OUTPUT(Varyings,o);
                UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(o);
                float3 right = normalize(mul((float3x3)unity_WorldToObject, UNITY_MATRIX_V[0].xyz));
                float3 up = normalize(mul((float3x3)unity_WorldToObject, UNITY_MATRIX_V[1].xyz));
                float3 p = runeVertex(v.vertex.xy,v.uv,v.motion,v.shape,_Timing,_Placement,right,up);
                o.position = UnityObjectToClipPos(float4(p,1.0));
                o.coord = float4(v.uv,v.vertex.xy);
                o.motion = v.motion;
                o.shape = v.shape;
                return o;
            }
            float4 frag(Varyings i) : SV_Target
            {
                float4 brush = tex2D(_Brush,runeBrushUV(i.coord.w,i.coord.xy,_Timing.x));
                float3 c = runeShade(i.coord.zw,i.coord.xy,i.motion,i.shape,_Timing,_Placement,brush);
                return float4(c*_Tint.rgb,0.0);
            }
            ENDCG
        }
    }
    Fallback Off
}
