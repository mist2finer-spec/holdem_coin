float4 _Tint;float _Intensity,_RadiancePreview;
struct BallIn { float4 pos:POSITION; float3 axis:NORMAL; float4 col:COLOR; float4 uv:TEXCOORD0; float2 params:TEXCOORD1; };
struct BallOut {float4 pos:SV_POSITION;float4 col:TEXCOORD0;float4 uv:TEXCOORD1;};
BallOut vert(BallIn i){
 BallOut o;
 float3 right=mul((float3x3)unity_CameraToWorld,float3(1,0,0));
 float3 up=mul((float3x3)unity_CameraToWorld,float3(0,1,0));float3 p=mul(unity_ObjectToWorld,i.pos).xyz;float sc=length(mul((float3x3)unity_ObjectToWorld,float3(1,0,0)));
 if(i.params.y>.5 && i.params.y<1.5){
  float3 axis=mul((float3x3)unity_ObjectToWorld,i.axis);
  float3 view=lerp(_WorldSpaceCameraPos-p,mul((float3x3)unity_CameraToWorld,float3(0,0,1)),unity_OrthoParams.w);
  float3 side=cross(axis,view);p+=side/max(.00001,length(side))*i.params.x*sc;
 }else if(i.params.y>1.5){
  float2 q=(i.uv.xy*2.-1.)*i.axis.xy;float angle=i.axis.z;
  if(i.params.y>2.5){float3 heading=mul((float3x3)unity_ObjectToWorld,float3(0,0,1));float2 h=float2(dot(heading,right),dot(heading,up));if(dot(h,h)>.000001)angle+=atan2(h.y,h.x);}
  float c=cos(angle),s=sin(angle);
  p+=(right*(q.x*c-q.y*s)+up*(q.x*s+q.y*c))*sc;
 }
 o.pos=mul(UNITY_MATRIX_VP,float4(p,1));o.col=i.col;o.uv=i.uv;return o;
}
float4 frag(BallOut i):SV_Target{
 float4 c=PlasmaOptics(i.uv.xy,i.col,i.uv.z,i.uv.w);c.rgb*= _Tint.rgb;c.a*= _Intensity;
 clip(c.a-.0005);
 #ifndef UNITY_COLORSPACE_GAMMA
 c.rgb=pow(max(c.rgb,0.),2.2);
 #else
 if(_RadiancePreview>.5)c.rgb=pow(max(c.rgb,0.),2.2);
 #endif
 return c;
}
