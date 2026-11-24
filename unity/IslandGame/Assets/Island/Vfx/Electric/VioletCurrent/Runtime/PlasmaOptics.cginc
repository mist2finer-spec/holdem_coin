// Procedural rolling nucleus and translucent folds. No source-video textures.
float Grain(float2 a){ a=frac(a*float2(.1031,.1030)); a+=dot(a,a.yx+33.33); return frac((a.x+a.y)*a.x); }
float Field(float2 p){
 float2 a=floor(p),b=frac(p);b=b*b*(3.-2.*b);
 return lerp(lerp(Grain(a),Grain(a+float2(1,0)),b.x),lerp(Grain(a+float2(0,1)),Grain(a+float2(1,1)),b.x),b.y);
}
float Fractal(float2 p){
 float v=Field(p)*.53; p=float2(p.x*1.78-p.y*.91,p.x*.91+p.y*1.78)+9.7;
 v+=Field(p)*.27;p=float2(p.x*1.82-p.y*.86,p.x*.86+p.y*1.82)+4.3;
 return v+Field(p)*.14+Field(p*2.13)*.06;
}
float4 PlasmaOptics(float2 uv,float4 tone,float kind,float seed){
 float2 p=uv*2.-1.;float rr=dot(p,p),v=abs(p.y);float3 color=tone.rgb;float a=tone.a;
 if(kind<.5){
   float foot=clamp(fwidth(uv.y)*2.8,.035,.75),s=.18+foot*.39;
   float ion=exp(-v*v/(s*s))*.23/s;
   color=color*(.58*exp(-v*v*4.)+.23*exp(-v*v*13.))+lerp(color,float3(1.,.97,1.),.54)*ion*1.39;
   a*=1.-smoothstep(.73,1.,v);
 }else if(kind<1.5){
   float ridge=exp(-v*v*4.7);a*=ridge*ridge*(1.-smoothstep(.56,1.,v));color*=.9;
 }else if(kind<2.5){
   float2 q=p*2.45+float2(seed*.73,-seed*.29);
   float2 flow=float2(Fractal(q+1.89),Fractal(q+13.78))-.5;
   float2 curl=float2(flow.y,-flow.x);
   float n=Fractal(q*1.18+curl*3.6);float m=Fractal(q*2.45+flow*4.8);
   float r=sqrt(rr);float edge=1.-smoothstep(.54,1.,r+(.47-n)*.61);
   float ridge=1.-smoothstep(.02,.137,abs(n-.49+.10*(m-.5)));
   float sparse=smoothstep(.24,.70,m*.55+n*.45);
   a*=edge*(.064+.54*ridge+.48*sparse*sparse)*(.53+.65*sparse);
   color*=.85+.23*ridge+.18*m;
 }else if(kind<3.5){
   float r=sqrt(rr);float z=sqrt(max(.00001,1.-rr));float phase=seed;
   float2 flow=p*2.4+float2(phase*.82,-phase*.43)+float2(z*.62,z*.37);
   float f=Fractal(flow*1.13);float h=Fractal(flow*2.74+float2(f,-f)*2.7);
   float boundary=.928+.043*(f-.5)+.032*(h-.5);
   float inside=(1.-smoothstep(boundary-.028,boundary+.035,r));
   float nc=(length(p+float2(.24,-.14))-.73-.24*(f-.5))/.16;float crescent=exp(-nc*nc);
   float vein=1.-smoothstep(.027,.17,abs(sin((p.y*.98+p.x*.56+z*.32+f*.77)*8.5+phase*.32)));
   float rc=(r-.84-.12*(h-.5))/.093;float rim=exp(-rc*rc);
   float gleam=pow(max(0.,dot(normalize(float3(p,z)),normalize(float3(.64,-.59,.49)))),3.1);
   float shell=smoothstep(-.35,.65,p.x+.31*(h-.43))*(.62+.38*z);
   float e=.22+.53*shell+.86*crescent+.83*gleam+.58*vein+.28*rim+.18*h;
   color=lerp(float3(.64,.18,1.),color,smoothstep(.2,1.35,e))*e*1.12;
   a*=inside;
 }else if(kind<4.5){
   float spark=exp(-rr*11.4)+.45*exp(-abs(p.x)*12.-abs(p.y)*2.6)+.28*exp(-abs(p.y)*14.-abs(p.x)*3.7);
   a*=spark*(1.-smoothstep(.55,1.,rr));color*=1.65;
 }else if(kind>6.5){
   float x=uv.x,y=uv.y;float n=Field(float2(x*6.+seed,y*2.8-seed));
   float fold=.61+.13*sin(x*8.+seed)+.08*(n-.5);
   float dr=(y-fold)/.13;float lip=exp(-dr*dr);
   float striation=pow(.5+.5*sin(y*15.+n*4.+x*7.),2.);
   a*=pow(max(0.,sin(x*3.141593)),.64)*smoothstep(.02,.19,y)*(1.-smoothstep(.80,1.,y))*(.04+.80*lip+.20*striation)*(.48+.52*n);
   color*=.83+.45*lip;
 }else if(kind>5.5){
   float2 hq=p*2.6+float2(seed*.37,-seed*.53);
   float n=Fractal(hq);float fil=Fractal(hq*1.9+float2(n,-n)*3.);
   float dis=sqrt(rr)+(.45-fil)*1.16;
   float island=(1.-smoothstep(.24,.90,dis))*smoothstep(.16,.66,n);
   float cut=1.-smoothstep(.015,.14,abs(fil-.5));a*=island*(.18+.82*cut);
   color*=.83+1.11*cut+.42*n;
 }else{
   a*=exp(-rr*5.5)*(1.-smoothstep(.57,1.,rr));color*=.95;
 }
 return float4(color,a);
}
