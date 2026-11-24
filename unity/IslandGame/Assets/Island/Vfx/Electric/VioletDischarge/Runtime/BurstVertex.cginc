float4 _Tint;float _Intensity,_RadiancePreview,_Radius;
struct BurstInput { float4 pos:POSITION; float3 axis:NORMAL; float4 col:COLOR; float4 uv:TEXCOORD0; float2 params:TEXCOORD1; };
struct BurstOutput {float4 pos:SV_POSITION;float4 col:TEXCOORD0;float4 uv:TEXCOORD1;};
BurstOutput vert(BurstInput i){
 BurstOutput o;
 float3 right=mul((float3x3)unity_CameraToWorld,float3(1,0,0));
 float3 up=mul((float3x3)unity_CameraToWorld,float3(0,1,0));float3 p=mul(unity_ObjectToWorld,float4(i.pos.xyz*_Radius,1)).xyz;float sc=length(mul((float3x3)unity_ObjectToWorld,float3(1,0,0)));
 if(i.params.y>.5 && i.params.y<1.5){
  float3 axis=mul((float3x3)unity_ObjectToWorld,i.axis);
  float3 view=lerp(_WorldSpaceCameraPos-p,mul((float3x3)unity_CameraToWorld,float3(0,0,1)),unity_OrthoParams.w);
  float3 side=cross(axis,view);p+=side/max(.00001,length(side))*i.params.x*sc*_Radius;
 }else if(i.params.y>2.5){
  float3 n=normalize(mul(i.axis,(float3x3)unity_WorldToObject));
  float3 view=normalize(lerp(_WorldSpaceCameraPos-p,mul((float3x3)unity_CameraToWorld,float3(0,0,1)),unity_OrthoParams.w));
  float front=dot(n,view);if(front<=0.)i.col.a=0.;
  float key=max(0.,dot(n,normalize(float3(-.62,.73,-.39))));
  float fill=max(0.,dot(n,normalize(float3(.68,-.35,-.65))));
  i.col.rgb=i.col.rgb*(.29+.78*key+.21*fill)+float3(.23,.17,.29)*pow(key,4.);
 }else if(i.params.y>1.5){
  float2 q=(i.uv.xy*2.-1.)*i.axis.xy;float angle=i.axis.z;
  float c=cos(angle),s=sin(angle);
  p+=(right*(q.x*c-q.y*s)+up*(q.x*s+q.y*c))*sc*_Radius;
 }
 o.pos=mul(UNITY_MATRIX_VP,float4(p,1));o.col=i.col;o.uv=i.uv;return o;
}
float4 frag(BurstOutput i):SV_Target{
 float4 c=BurstOptics(i.uv.xy,i.col,i.uv.z,i.uv.w);c.rgb*= _Tint.rgb;c.a*= _Intensity;
 clip(c.a-.0005);
 #ifndef UNITY_COLORSPACE_GAMMA
 c.rgb=pow(max(c.rgb,0.),2.2);
 #else
 if(_RadiancePreview>.5)c.rgb=pow(max(c.rgb,0.),2.2);
 #endif
 return c;
}
