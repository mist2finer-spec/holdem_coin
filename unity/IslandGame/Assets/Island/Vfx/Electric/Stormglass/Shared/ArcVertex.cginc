float _Corona;
struct ArcInput {
 float4 vertex:POSITION; float3 direction:NORMAL; float4 color:COLOR; float4 uv:TEXCOORD0; float2 prop:TEXCOORD1;
};
struct ArcVarying {float4 pos:SV_POSITION;float4 color:TEXCOORD0;float4 uv:TEXCOORD1;};
ArcVarying vert(ArcInput i){
 ArcVarying o;
 if(_Corona>.5){
  if(i.prop.y==1 && (i.uv.z==0 || i.uv.z==2)){i.prop.x*=4.65;i.uv.z=11;}
  else if(i.prop.y==2 && i.uv.z==4){i.direction.xy*=1.66;i.uv.z=12;}
  else i.color.a=0;
 }
 float3 world=mul(unity_ObjectToWorld,i.vertex).xyz;
 float sc=length(mul((float3x3)unity_ObjectToWorld,float3(1,0,0)));
 float3 right=unity_CameraToWorld._m00_m10_m20,up=unity_CameraToWorld._m01_m11_m21;
 if(i.prop.y>.5 && i.prop.y<1.5){
  float3 tangent=mul((float3x3)unity_ObjectToWorld,i.direction);
  float3 toEye=lerp(_WorldSpaceCameraPos-world,unity_CameraToWorld._m02_m12_m22,unity_OrthoParams.w);
  float3 side=cross(tangent,toEye);world+=side/max(.00001,length(side))*i.prop.x*sc;
 }else if(i.prop.y>1.5){
  float2 q=(i.uv.xy*2.-1.)*i.direction.xy;float sn=sin(i.direction.z),cs=cos(i.direction.z);
  world+=(right*(q.x*cs-q.y*sn)+up*(q.x*sn+q.y*cs))*sc;
 }
 o.pos=mul(UNITY_MATRIX_VP,float4(world,1));o.uv=i.uv;o.color=i.color;return o;
}
float4 frag(ArcVarying i):SV_Target{
 float4 c=ArcOptics(i.uv.xy,i.color,i.uv.z,i.uv.w);clip(c.a-.001);
 // Procedural colors are authored in display values. Preserve HDR headroom for optional pipeline bloom.
 #ifndef UNITY_COLORSPACE_GAMMA
 c.rgb=pow(max(c.rgb,0.),2.2);
 #endif
 return c;
}
