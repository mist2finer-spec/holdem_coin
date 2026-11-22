#ifndef RUNE_BEAM_COMMON
#define RUNE_BEAM_COMMON
float2 runeRotate(float2 p,float angle)
{
    float c=cos(angle), s=sin(angle);
    return float2(c*p.x-s*p.y,s*p.x+c*p.y);
}
float runeOpen(float t,float charge,float seal)
{
    float start=seal*.060;
    return smoothstep(start,start+charge*(0.54+0.09*seal),t)
          *(1.0-smoothstep(.865,1.0,t));
}
float runeFire(float t,float charge)
{
    return smoothstep(charge-.008,charge+.025,t)*(1.0-smoothstep(.77,.91,t));
}
float runeFront(float t,float charge)
{
    return smoothstep(charge-.003,charge+.072,t);
}
float runePulse(float t,float charge)
{
    float a=(t-charge-.010)*30.0;
    return exp(-a*a);
}
float2 runeBrushUV(float kind,float2 uv,float t)
{
    if (kind>.5 && kind<1.5)
        return float2(frac(uv.x*1.63-t*2.9),uv.y);
    return uv;
}
float runeStar(float2 p)
{
    float ax=sqrt(abs(p.x)), ay=sqrt(abs(p.y));
    return 1.0-smoothstep(.80,1.0,ax+ay);
}
float3 runeBeamSide(float3 right,float3 up)
{
    float3 view=cross(right,up);
    float3 side=cross(float3(0.0,0.0,1.0),view);
    float l=length(side);
    if(l<.001) return right;
    return side/l;
}
#endif
