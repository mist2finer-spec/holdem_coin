Shader "Violet Discharge/Arc Discharge" {
Properties {
_Tint ("Tint",Color) = (1,1,1,1)
_Intensity ("Intensity",Float) = 1
_Radius ("Radius",Float) = 1
[HideInInspector] _RadiancePreview ("Radiance",Float) = 0
}
SubShader { Tags {  "RenderPipeline"="UniversalPipeline" "Queue"="Transparent+5" "RenderType"="Transparent" "DisableBatching"="True" }
Pass { Tags { "LightMode"="SRPDefaultUnlit" } Cull Off ZWrite Off ZTest LEqual Blend SrcAlpha One
CGPROGRAM
#pragma target 3.0
#pragma vertex vert
#pragma fragment frag
#include "UnityCG.cginc"
#include "DischargeOptics.cginc"
#include "BurstVertex.cginc"
ENDCG
} }
SubShader { Tags { "Queue"="Transparent+5" "RenderType"="Transparent" "DisableBatching"="True" }
Pass { Cull Off ZWrite Off ZTest LEqual Blend SrcAlpha One
CGPROGRAM
#pragma target 3.0
#pragma vertex vert
#pragma fragment frag
#include "UnityCG.cginc"
#include "DischargeOptics.cginc"
#include "BurstVertex.cginc"
ENDCG
} }
Fallback Off
}
