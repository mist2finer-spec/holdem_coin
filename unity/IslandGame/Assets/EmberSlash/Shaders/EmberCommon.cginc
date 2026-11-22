#ifndef EMBER_SLASH_COMMON
#define EMBER_SLASH_COMMON
// EQ: radians. u runs from the distant point of the crescent around the left bend.
float emberBorn(float u, float sweep)
{
    return sweep * (1.0 - pow(max(0.0, 1.0-u), 0.80));
}

float3 emberPath(float u, float offset, float phase, float mirror)
{
    float a = 0.39 + 4.55*u;
    float taper = pow(max(0.0, sin(3.14159265*u)), 0.58);
    float radius = 1.66 + 0.17*sin(4.3*u-0.35) + offset*(0.34+0.66*taper);
    radius *= 0.934 + 0.080*smoothstep(0.0,0.46,phase);
    return float3(mirror*(radius*cos(a)+0.075*u), 
                  0.10*sin(a-0.45)+0.068*cos(a*1.61)+0.090*offset,
                  (radius*0.85)*sin(a));
}

float emberEnvelope(float u, float phase, float sweep, float persistence)
{
    float age = phase-emberBorn(u,sweep);
    float alive = smoothstep(-0.009,0.014,age);
    float decay = 1.0-smoothstep(0.030, persistence*(0.68+0.39*u),age);
    return alive*decay;
}

float3 emberRibbon(float2 uv, float4 brush, float phase, float sweep, float persistence)
{
    float u = uv.x;
    float amount = emberEnvelope(u,phase,sweep,persistence);
    float age = max(0.0,phase-emberBorn(u,sweep));
    float tips = smoothstep(0.0,0.080,u)*(1.0-smoothstep(0.885,1.0,u));
    float bendDistance = (u-0.59)*4.4;
    float bend = exp(-bendDistance*bendDistance);
    float energy = amount*tips*(0.55+0.58*bend);
    float head = exp(-age*age*1450.0);
    float upper = 1.0-smoothstep(0.59,0.86,u);
    float heat = energy*(0.56+0.70*upper+0.15*head);
    float cool = smoothstep(0.09, max(persistence,0.16),age);
    float body = brush.r*heat*(1.0-0.68*cool);
    float core = brush.g*heat*(0.68+0.80*bend)*(1.0-0.90*cool);
    float wisps = brush.b*tips*emberEnvelope(u,phase-0.014,sweep,persistence*1.17);
    float fire = pow(max(0.0,body),1.65);
    float3 rgb = float3(2.75,0.36,0.023)*body
               + float3(1.2,0.85,0.035)*fire
               + float3(4.3,3.7,1.55)*core
               + float3(1.55,0.23,0.019)*wisps
               + float3(1.32,0.024,0.050)*brush.a*energy;
    return rgb;
}

// Calculates billboard centres and directions in effect-local space.
float3 emberSpark(float track, float4 motion, float4 shape, float2 corner,
                  float phase, float sweep, float mirror, float3 right, float3 up)
{
    float born = emberBorn(track,sweep)+motion.w;
    float age = max(0.0,phase-born);
    float3 v = float3(motion.x*mirror,motion.y,motion.z);
    float travel = age/(1.0+1.25*age);
    float3 p = emberPath(track,0.0,born,mirror)+v*travel;
    p.y -= 0.82*age*age;
    float3 tangent = v/((1.0+1.25*age)*(1.0+1.25*age));
    tangent.y -= 1.64*age;
    float2 axis = float2(dot(tangent,right),dot(tangent,up));
    axis /= max(length(axis),0.001);
    float2 side = float2(-axis.y,axis.x);
    float life = max(0.001,shape.x);
    float shrink = 1.0-0.65*smoothstep(0.0,life,age);
    float2 d = axis*(shape.z*shrink*corner.x)+side*(shape.y*shrink*corner.y);
    return p+right*d.x+up*d.y;
}

float3 emberSparkColor(float2 uv, float age, float life, float seed)
{
    float normalized=age/max(life,0.001);
    float visible=smoothstep(0.0,0.017,age)*(1.0-smoothstep(0.14,1.0,normalized));
    float2 p=uv*2.0-1.0;
    float cut=abs(p.x)+abs(p.y)*1.10;
    float mark=1.0-smoothstep(0.52,1.0,cut);
    float pulse=0.86+0.14*sin(normalized*10.0+seed*19.0);
    float3 rgb=lerp(float3(4.4,1.72,0.28),float3(1.65,0.128,0.022),smoothstep(0.04,0.88,normalized+seed*0.15));
    return rgb*mark*visible*pulse;
}

float emberStrike(float phase, float sweep)
{
    float age=phase-emberBorn(0.59,sweep);
    return smoothstep(-0.026,0.022,age)*(1.0-smoothstep(0.027,0.244,age));
}

float3 emberFlare(float2 uv,float phase,float sweep)
{
    float2 p=uv*2.0-1.0;
    float r2=dot(p,p);
    float fade=max(0.0,1.0-r2);
    float star=exp(-abs(p.x)*13.0-abs(p.y)*67.0) + 0.45*exp(-abs(p.x)*81.0-abs(p.y)*18.0);
    float3 c=float3(6.6,6.2,4.4)*exp(-r2*315.0)
            +float3(3.7,1.65,0.45)*exp(-r2*75.0)
            +float3(1.15,.042,.075)*exp(-r2*13.0)
            +float3(.34,.010,.038)*exp(-r2*3.6)
            +float3(2.4,1.02,.57)*star;
    return c*fade*emberStrike(phase,sweep);
}

float3 emberPool(float2 uv,float phase,float sweep,float ground)
{
    float2 p=uv*2.0-1.0;
    float r2=dot(p,p);
    float a=smoothstep(.025,.17,phase)*(1.0-smoothstep(sweep*.71,sweep+.39,phase));
    return float3(.46,.027,.044)*exp(-r2*4.7)*max(0.0,1.0-r2)*a*ground;
}
#endif
