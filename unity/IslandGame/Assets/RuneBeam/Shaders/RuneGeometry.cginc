#ifndef RUNE_BEAM_GEOMETRY
#define RUNE_BEAM_GEOMETRY
// Geometry codes correspond to the authored strips and quads in RuneGeometry.bytes.
float3 runeVertex(float2 data,float2 uv,float4 motion,float4 shape,
                  float4 settings,float4 placement,float3 right,float3 up)
{
    float id=data.x, k=data.y, t=settings.x, charge=settings.y;
    float len=settings.z, width=settings.w;
    float2 c=uv*2.0-1.0;
    float fire=runeFire(t,charge), pulse=runePulse(t,charge);
    float3 p=float3(0.0,0.0,0.0);
    if (k<.5) // Two separately rotating rune seals.
    {
        float grow=runeOpen(t,charge,id);
        float size=lerp(1.24,.80,id)*(.24+.76*grow)*(1.0+.032*pulse);
        float2 xy=runeRotate(c*size,t*lerp(1.53,-2.12,id)+id*.29);
        p=float3(xy,id*(.19+.43*grow)+.03*sin(t*7.0)*id);
    }
    else if (k<2.5 || k>8.5) // Wide painted core, fine helical strands and a soft sheath.
    {
        float f=runeFront(t,charge), s=uv.x;
        float z=-.24+s*(len+.24)*f;
        float spread=(.044+.225*smoothstep(.0,.33,s)+.27*s)*width;
        spread*=.88+.12*sin(s*14.0-t*36.0);
        float3 side=runeBeamSide(right,up);
        if(k>1.5 && k<2.5)
        {
            float a=motion.x+s*motion.y*6.283-t*motion.w*4.1;
            float radius=motion.z*width*(.17+.83*smoothstep(0.0,.22,s));
            float2 xy=float2(cos(a),sin(a))*radius;
            p=float3(xy,z)+side*(c.y*shape.x*width*(.34+.66*sin(3.14159*s)));
        }
        else
        {
            float envelope=spread*(k>8.5?2.8:1.0);
            float drift=(sin(s*14.3-t*17.2)*.028+sin(s*32.0-t*24.0)*.012)*s;
            p=float3(0.0,drift,z)+side*c.y*envelope;
        }
    }
    else if (k<3.5) // Orb visible during charge and sustained emission.
    {
        float grow=smoothstep(0.0,charge,t);
        float size=(.31+.39*grow+.42*pulse)*(1.0-.20*smoothstep(.81,.99,t));
        p=float3(0.0,0.0,-.25)+(right*c.x+up*c.y)*size;
    }
    else if(k<4.5) // Four-point motes move independently of the beam shell.
    {
        float along=frac(motion.x+(t-charge)*motion.w*.70);
        float a=motion.y+t*(shape.y-.5)*1.85;
        float radius=motion.z*(.4+.6*smoothstep(0.0,.23,along))*width;
        float2 xy=float2(cos(a),sin(a))*radius;
        float z=along*len*runeFront(t,charge);
        p=float3(xy,z)+(right*c.x+up*c.y)*shape.x*(.76+.42*shape.z);
    }
    else if(k<5.5) // Optional ground illumination, aligned to local XZ.
    {
        if(id<.5) p=float3(c.x*1.68,-placement.w,c.y*1.82);
        else p=float3(c.x*(1.1+.42*width),-placement.w-.001,(uv.y*len)*runeFront(t,charge));
    }
    else if(k<6.5) // Inward sparks around the charging orb.
    {
        float cycle=frac(t*3.65+motion.w);
        float radius=(1.0-cycle)*motion.z+.02;
        float2 d=float2(cos(motion.x),sin(motion.x));
        float2 s=float2(-d.y,d.x);
        float2 xy=d*(radius+c.x*shape.y*(.45+.55*cycle))+s*shape.x*c.y;
        p=float3(xy,-.25-motion.y*(1.0-cycle));
    }
    else // Tapered fragments rotate around the outside of the emitter at ignition.
    {
        float a=motion.x+uv.x*motion.y+t*2.4;
        float taper=sin(3.14159265*uv.x);
        float r=motion.z+.13*sin(uv.x*3.14159)+c.y*shape.x*taper;
        p=float3(r*cos(a),r*sin(a),motion.w-.12*taper);
    }
    return p*placement.x;
}
float3 runeShade(float2 data,float2 uv,float4 motion,float4 shape,
                 float4 settings,float4 placement,float4 brush)
{
    float k=data.y,id=data.x,t=settings.x,charge=settings.y;
    float2 c=uv*2.0-1.0;
    float fire=runeFire(t,charge),pulse=runePulse(t,charge);
    float3 rgb=float3(0.0,0.0,0.0);
    if(k<.5)
    {
        float open=runeOpen(t,charge,id);
        float wave=.9+.10*sin(t*17.0+uv.x*8.0+uv.y*5.0);
        float3 lines=float3(3.5,2.92,.53)*brush.r*wave;
        float3 aura=float3(1.01,.88,.043)*brush.g;
        rgb=(lines+aura)*open*(.83+.42*fire+.42*pulse);
    }
    else if(k<1.5)
    {
        float edge=abs(c.y);
        float window=1.0-smoothstep(.80,1.0,edge);
        float end=1.0-smoothstep(.90+.054*brush.b,1.0,uv.x);
        float lane=brush.b*window, hair=brush.a*window;
        float axis=exp(-c.y*c.y*22.0);
        float moving=.5+.5*sin(uv.x*38.0-t*57.0);
        float inner=axis*(.12+.73*lane);
        rgb=float3(4.2,3.05,.026)*lane+float3(2.45,2.40,.23)*hair
            +float3(3.8,3.7,2.85)*inner+float3(.45,.34,.003)*axis*moving;
        rgb*=fire*end;
    }
    else if(k<2.5)
    {
        float filamentEdge=1.0-smoothstep(.50,1.0,abs(c.y));
        float flow=.5+.5*sin(uv.x*(11.0+shape.w*19.0)-t*28.0+motion.x);
        float chop=smoothstep(.13,.55,flow);
        float ends=smoothstep(0.0,.05,uv.x)*(1.0-smoothstep(.86,1.0,uv.x));
        rgb=float3(3.45,2.88,.25)*filamentEdge*ends*(.085+.89*chop)*fire*shape.y;
    }
    else if(k<3.5)
    {
        float r2=dot(c,c);float r=sqrt(r2);
        float gather=smoothstep(.015,charge,t);
        float disk=1.0-smoothstep(.16+.035*gather,.18+.035*gather,r);
        float crossGlow=exp(-abs(c.x)*15.0-abs(c.y)*66.0)+exp(-abs(c.y)*15.0-abs(c.x)*66.0);
        rgb=float3(4.9,4.34,.63)*disk +float3(2.0,1.8,.16)*exp(-r2*36.0)
            +float3(.64,.61,.015)*exp(-r2*5.8)+float3(3.1,2.70,.50)*crossGlow*(.12+pulse);
        rgb*=smoothstep(.014,.13,t)*(1.0-smoothstep(.84,.99,t))*max(0.0,1.0-r2);
    }
    else if(k<4.5)
    {
        float pulseStar=smoothstep(.09,.92,.5+.5*cos(6.28318*(motion.x+t*(3.4+motion.w))));
        float along=frac(motion.x+(t-charge)*motion.w*.70);
        float ends=smoothstep(.01,.12,along)*(1.0-smoothstep(.90,1.0,along));
        rgb=(float3(4.0,3.34,.78)*runeStar(c)+float3(.36,.32,.015)*exp(-dot(c,c)*9.0))*pulseStar*fire*ends;
    }
    else if(k<5.5)
    {
        if(id<.5) rgb=float3(.14,.13,.020)*exp(-dot(c,c)*3.7)*max(0.0,1.0-dot(c,c))*runeOpen(t,charge,0.0)*(.45+.55*fire);
        else rgb=float3(.064,.049,.009)*exp(-c.x*c.x*4.5)*max(0.0,1.0-c.x*c.x)*sin(3.14159*uv.y)*fire;
        rgb*=placement.z;
    }
    else if(k<6.5)
    {
        float cycle=frac(t*3.65+motion.w);
        float cut=abs(c.x)+abs(c.y);
        float strength=smoothstep(.0,.22,cycle)*(1.0-smoothstep(.79,1.0,cycle));
        float chargeLight=smoothstep(.08,.26,t)*(1.0-smoothstep(charge+.02,charge+.13,t));
        rgb=float3(2.9,2.51,.37)*(1.0-smoothstep(.63,1.0,cut))*strength*chargeLight;
    }
    else if(k<8.5)
    {
        float swish=.50+.50*sin(uv.x*5.6+motion.x+t*13.0);
        float cut=smoothstep(.07,.67,swish)*(1.0-smoothstep(.5,1.0,abs(c.y)));
        rgb=float3(2.77,2.56,.14)*cut*(.55+.45*sin(uv.x*31.0+motion.x)*sin(uv.x*11.0+t*10.0))*fire*(.38+.57*pulse)*shape.y;
    }
    else
    {
        float glow=exp(-c.y*c.y*5.8)*max(0.0,1.0-c.y*c.y);
        rgb=float3(.125,.105,.004)*glow*fire*(1.0-smoothstep(.88,1.0,uv.x));
    }
    return rgb*placement.y;
}
#endif
