Shader "Island/BossTrialRecoveredMap" {
 Properties {
  _MainTex ("Original diffuse / native UV", 2D) = "white" {}
  _Color ("Original material color", Color) = (1,1,1,1)
  _Cutoff ("Original alpha cutoff", Range(0,1)) = 0.5
 }
 SubShader {
  Tags { "Queue"="AlphaTest" "RenderType"="TransparentCutout" }
  Cull Off ZWrite On
  Pass {
   CGPROGRAM
   #pragma vertex vert
   #pragma fragment frag
   #include "UnityCG.cginc"
   struct appdata { float4 vertex : POSITION; float2 uv : TEXCOORD0; float3 normal : NORMAL; };
   struct v2f { float4 pos : SV_POSITION; float2 uv : TEXCOORD0; float shade : TEXCOORD1; };
   sampler2D _MainTex; float4 _MainTex_ST; fixed4 _Color; float _Cutoff;
   v2f vert(appdata v) {
    v2f o; o.pos=UnityObjectToClipPos(v.vertex);o.uv=TRANSFORM_TEX(v.uv,_MainTex);
    o.shade=.65+.35*saturate(dot(UnityObjectToWorldNormal(v.normal),normalize(float3(.65,.9,-.25))));return o;
   }
   fixed4 frag(v2f i) : SV_Target { fixed4 c=tex2D(_MainTex,i.uv)*_Color;clip(c.a-_Cutoff);c.rgb*=i.shade;return c; }
   ENDCG
  }
 }
}
