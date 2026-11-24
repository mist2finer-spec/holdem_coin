// The same optical model is used by both pipelines. Soft falloff around each wire is part of the material.
float WireHash(float2 p){return frac(sin(dot(p,float2(127.1,311.7)))*43758.5453);}
float WireNoise(float2 p){float2 g=floor(p),f=frac(p);f=f*f*(3.-2.*f);return lerp(lerp(WireHash(g),WireHash(g+float2(1,0)),f.x),lerp(WireHash(g+float2(0,1)),WireHash(g+float2(1,1)),f.x),f.y);}
float4 ArcOptics(float2 uv,float4 color,float kind,float seed){
 float3 c=color.rgb;float a=color.a,v=abs(uv.y*2.-1.);
 if(kind<.5){
  float d=v*3.40;
  float halo=exp(-d*d*.24)*.41+exp(-d*d*1.22)*.69;
  float footprint=clamp(fwidth(uv.y)*5.8,.002,1.05);float sigma=.39+footprint*.52;float core=exp(-d*d/(sigma*sigma))*(.39/sigma);
  c=c*halo*1.37+lerp(c,float3(1,.99,1),.76)*core*1.79;
  a*=1.-smoothstep(.84,1.,v);
 }else if(kind<1.5){
  float u=uv.x,y=uv.y;
  float grain=WireNoise(float2(u*23.+seed,y*3.5))*.6+WireNoise(float2(u*67.-seed,y*8.))*.4;
  float wob=.08*sin(u*23.+seed)+.03*sin(u*59.-seed);
  float edge=smoothstep(.015,.18,y+wob)*(1.-smoothstep(.958,1.,y));
  float stria=.5+.5*sin(y*43.+u*17.+4.0*grain+2.3*sin(u*13.+seed));float ridgeX=(y-.84-.025*sin(22.*u+seed))/.061;float ridge=exp(-ridgeX*ridgeX);
  float inner=WireNoise(float2(u*32.+y*3.,y*2.-seed));float fracture=smoothstep(.30,.80,grain+.30*sin(u*13.+y*7.+seed));
  c=c*(.14+.36*stria+.25*fracture+.23*inner)+lerp(c,float3(1.,1.,1.),.59)*ridge*2.05;
  a*= (.42+.56*smoothstep(.15,.80,u)+.28*fracture)*edge*(.18+.76*smoothstep(.0,.68,y)+.22*fracture)*smoothstep(.0,.06,u)*(1.-smoothstep(.98,1.,u));
 }else if(kind<2.5){
  float energy=exp(-v*v*7.0);c=lerp(c*1.19,float3(.94,.98,1.)*2.25,energy*.85);a*=smoothstep(.0,.72,1.-v);
 }else if(kind<3.5){
  float2 p=uv*2.-1.;float rr=dot(p,p);c*=1.00;a*=exp(-rr*5.5)*(1.-smoothstep(.58,1.,rr))*.66;
 }else if(kind<4.5){
  float2 p=abs(uv*2.-1.);float rr=dot(p,p);
  float x=pow(max(0.,1.-p.x),1.70)*exp(-p.y/(.014+.059*pow(1.-p.x,4.)));
  float y=pow(max(0.,1.-p.y),1.6)*exp(-p.x/(.014+.058*pow(1.-p.y,4.)));
  float star=max(x,y),core=exp(-rr*112.);
  c=c*(exp(-rr*8.)*.40+star*.75)+lerp(c,float3(1.,1.,1.),.79)*max(core,star*.77)*2.47;
  a*=1.-smoothstep(.83,1.,max(p.x,p.y));
 }else if(kind<6.5){
  float2 p=uv*2.-1.;float n=WireNoise(p*4.+seed)*.46+WireNoise(p*11.-seed)*.29+WireNoise(p*28.+seed)*.18;
  float shape=1.-dot(p,p)+n-.85;a*=smoothstep(.03,.52,shape)*(.24+.76*smoothstep(.26,.68,n));c*=.69+n*.58;
 }else if(kind<7.5){
  float2 p=uv*2.-1.;float mask=1.-abs(p.x*.95+p.y*.21)-abs(p.y*1.09);
  c*=.74+.51*step(.02,p.y*.8-p.x*.4);a*=smoothstep(-.035,.07,mask);
 }else if(kind<8.5){
  float2 p=uv*2.-1.;float rr=dot(p,p),grain=WireNoise(p*9.+seed);
  a*=exp(-rr*2.9)*(1.-smoothstep(.65,1.,rr))*(.55+.45*grain);
 }else if(kind>11.5){
  float2 p=uv*2.-1.;float r=dot(p,p);a*=.17*exp(-r*5.2)*(1.-smoothstep(.62,1.,r));c*=1.04;
 }else if(kind>10.5){
  a*=.19*exp(-v*v*4.9)*(1.-smoothstep(.79,1.,v));c*=1.06;
 }else if(kind<9.5){
  float2 p=uv*2.-1.;a*=(1.-smoothstep(.12,1.,dot(p,p)))*WireNoise(p*5.+seed);
 }
 return float4(c,a);
}
