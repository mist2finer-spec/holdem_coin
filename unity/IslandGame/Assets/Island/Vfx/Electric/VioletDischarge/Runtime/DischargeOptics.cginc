// Gradient fields and all effect textures are synthesized in the fragment shader.
float BHash(float2 p){p=frac(p*float2(.1031,.1099));p+=dot(p,p.yx+33.33);return frac((p.x+p.y)*p.x);}
float BNoise(float2 p){
 float2 q=floor(p),f=frac(p);f=f*f*(3.-2.*f);
 return lerp(lerp(BHash(q),BHash(q+float2(1,0)),f.x),lerp(BHash(q+float2(0,1)),BHash(q+float2(1,1)),f.x),f.y);
}
float2 Basis(float2 p){return float2(1.72*p.x-.97*p.y,.97*p.x+1.72*p.y)+7.317;}
float Fractal(float2 p){float a=.53*BNoise(p);p=Basis(p);a+=.27*BNoise(p);p=Basis(p);a+=.14*BNoise(p);return a+.06*BNoise(Basis(p));}
float Band(float x,float center,float width){float k=(x-center)/width;return exp(-k*k);}
float4 BurstOptics(float2 uv,float4 tint,float kind,float seed){
 float2 p=uv*2.-1.;float rr=dot(p,p),r=sqrt(rr),v=abs(p.y);float3 rgb=tint.rgb;float a=tint.a;
 if(kind<.5){
  float fw=clamp(fwidth(uv.y)*2.85,.015,.66),sigma=.166+fw*.31;
  float core=exp(-v*v/(sigma*sigma))*.20/sigma;float hot=exp(-v*v*7.5);
  rgb=rgb*(.27*exp(-v*v*3.2)+.84*hot)+lerp(rgb,float3(.99,.94,1.),.66)*1.32*core;
  a*=(1.-smoothstep(.73,1.,v));
 }else if(kind<1.5){
  a*=exp(-v*v*4.8)*(1.-smoothstep(.74,1.,v));
 }else if(kind<2.5){
  // Transparent bubble with a soft Fresnel edge and a clear space around the nucleus.
  float z=sqrt(max(0.,1.-rr)),edge=pow(1.-z,1.26);
  float gradual=.008+.019*pow(r,2.)+.63*pow(1.-z,2.10);
  float lip=.052*Band(r,.987,.013);
  a*=(gradual+lip)*(1.-smoothstep(.978,1.,r));rgb*=.96;
 }else if(kind<3.5){
  // Fine parallel growth bands and one moving glint stay within each flat crystal face.
  float stripe=uv.x*.74+uv.y*.21;
  float band=Band(stripe,frac(seed*.31)*1.27-.12,.067);
  float hair=Band(stripe,frac(seed*.31)*1.27-.034,.009);
  float facets=.95+.038*sin(stripe*76.+seed*.69)+.025*sin(stripe*143.+2.*uv.y);
  rgb=rgb*(facets+.40*band)+float3(.31,.15,.41)*hair;
  if(kind>3.1){
   float y=uv.y;
   float vein=.28+.26*y+.084*abs(frac(y*3.7+.12)*2.-1.)-.069*abs(frac(y*2.1)*2.-1.);
   float aa=clamp(fwidth(uv.x)*.52,.002,.025);
   float width=.012+aa;
   float trace=Band(uv.x,vein,width);
   float split=Band(uv.x,vein+.25*(y-.41),width*.71)*smoothstep(.40,.46,y)*(1.-smoothstep(.61,.76,y));
   float pulse=Band(frac(seed*.96+y*.75),.5,.15);
   rgb+=float3(.53,.22,.64)*(trace+.53*split)*(.53+1.48*pulse)*smoothstep(.02,.12,y)*(1.-smoothstep(.89,.99,y));
  }
 }else if(kind<4.5){
  float2 ap=abs(p);float pinpoint=2.*exp(-rr*59.);
  float rays=exp(-ap.y/(.011+.09*exp(-ap.x*8.)))*exp(-ap.x*3.5)+.60*exp(-ap.x/(.016+.065*exp(-ap.y*9.)))*exp(-ap.y*5.);
  a*= (pinpoint+.72*rays+.44*exp(-rr*7.2))*(1.-smoothstep(.78,1.,r));rgb*=1.23;
 }else if(kind<5.5){
  a*=exp(-rr*4.95)*(1.-smoothstep(.64,1.,r));
 }else if(kind<6.5){
  float2 u=p/max(r,.0001);float phase=seed*3.21;
  float flow=Fractal(u*3.6+float2(phase,-phase*.3));float stria=Fractal(p*5.+u*2.+float2(phase,-phase));
  float rrim=.87+.102*(flow-.50)+.055*(stria-.5);
  float ring=Band(r,rrim,.025+.036*flow),lip=Band(r,rrim+.035,.012);
  float interior=Band(r,rrim-.19,.15)*(.30+.70*stria);
  float ribs=pow(.5+.5*sin(dot(u,float2(19.,12.))+18.*flow+10.*stria),3.);
  float fracture=lerp(1.,.055+.945*smoothstep(.29,.71,flow*.56+stria*.44+.15*ribs),smoothstep(.055,.29,seed));
  a*=fracture*(.64*ring+.31*lip+.22*interior+.48*interior*ribs)*(1.-smoothstep(.95,1.,r));
  rgb=lerp(rgb,float3(.90,.61,1.),ring*.58);
 }else if(kind<7.5){
  float n=Fractal(float2(uv.x*3.3+seed,uv.y*4.1+seed*.38));
  float mask=pow(max(0.,sin(uv.x*3.141592)),.61)*(1.-smoothstep(.47,1.,v));
  float rib=Band(v,.49+.21*(n-.5),.20);
  a*=mask*(.14+.53*n+.49*rib)*(.48+.52*uv.x);rgb*=.73+.48*n;
 }else if(kind<8.5){
  float2 pp=abs(p);float taper=pow(max(0.,1.-pp.x),1.8);
  float tight=exp(-pp.y/(.017+.098*taper*taper)),broad=exp(-pp.y/(.071+.25*taper*taper));
  a*=taper*(1.12*tight+.34*broad)*(1.-smoothstep(.82,1.,pp.y));rgb=lerp(rgb,float3(1.,.91,1.),tight*.63);
 }else if(kind<9.5){
  a*=exp(-v*v*4.4)*(1.-smoothstep(.76,1.,v));rgb*=.78+.61*uv.x;
 }else if(kind<10.5){
  float2 dir=p/max(.0001,r);float ph=seed*.64;
  float flow=Fractal(dir*3.+ph);float veins=Fractal(p*3.6+float2(ph,-ph)+dir*flow);
  float spine=.61+.14*(flow-.5);float ridge=Band(r,spine,.114);
  float cuts=1.-smoothstep(.009,.093,abs(veins-.47));
  float stria=pow(.5+.5*sin(dot(dir,float2(5.,13.))+flow*27.+r*11.),3.);
  float shard=Band(r,.65+.13*stria,.30)*smoothstep(.38,.66,flow)*stria;
  a*=(.10*ridge+.89*ridge*cuts+.60*shard)*(1.-smoothstep(.83,1.,r));rgb*=1.19;
 }else{
  float2 b=abs(p);float rhombus=.90*b.x+1.21*b.y;
  a*=(1.-smoothstep(.07,.99,rhombus))*(.57+.43*exp(-rr*13.));rgb*=1.41;
 }
 return float4(rgb,a);
}
