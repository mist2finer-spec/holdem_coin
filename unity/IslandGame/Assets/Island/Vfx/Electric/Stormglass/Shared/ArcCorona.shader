Shader "Stormglass/ArcCorona" {
Properties { _Corona("Wire corona", Float) = 1 }
SubShader { Tags {  "RenderPipeline"="UniversalPipeline"  "Queue"="Transparent+9" "RenderType"="Transparent" "DisableBatching"="True" } Pass { Tags { "LightMode"="SRPDefaultUnlit" } Cull Off ZWrite Off ZTest LEqual Blend SrcAlpha One
CGPROGRAM
#pragma target 3.0
#pragma vertex vert
#pragma fragment frag
#include "UnityCG.cginc"
#include "ArcOptics.cginc"
#include "ArcVertex.cginc"
ENDCG
} }
SubShader { Tags {  "Queue"="Transparent+9" "RenderType"="Transparent" "DisableBatching"="True" } Pass { Cull Off ZWrite Off ZTest LEqual Blend SrcAlpha One
CGPROGRAM
#pragma target 3.0
#pragma vertex vert
#pragma fragment frag
#include "UnityCG.cginc"
#include "ArcOptics.cginc"
#include "ArcVertex.cginc"
ENDCG
} }
Fallback Off
}
