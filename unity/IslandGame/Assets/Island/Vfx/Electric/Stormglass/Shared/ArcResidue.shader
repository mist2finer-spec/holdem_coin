Shader "Stormglass/ArcResidue" {
Properties { _Corona("Wire corona", Float) = 0 }
SubShader { Tags {  "RenderPipeline"="UniversalPipeline"  "Queue"="Transparent-10" "RenderType"="Transparent" "DisableBatching"="True" } Pass { Tags { "LightMode"="SRPDefaultUnlit" } Cull Off ZWrite Off ZTest LEqual Blend SrcAlpha OneMinusSrcAlpha
CGPROGRAM
#pragma target 3.0
#pragma vertex vert
#pragma fragment frag
#include "UnityCG.cginc"
#include "ArcOptics.cginc"
#include "ArcVertex.cginc"
ENDCG
} }
SubShader { Tags {  "Queue"="Transparent-10" "RenderType"="Transparent" "DisableBatching"="True" } Pass { Cull Off ZWrite Off ZTest LEqual Blend SrcAlpha OneMinusSrcAlpha
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
