#ifndef EMBER_GEOMETRY
#define EMBER_GEOMETRY
// x = path position, y = layer (ribbon, spark, strike, ground).
float3 emberVertex(float2 data, float2 uv, float4 motion, float4 shape,
                   float4 settings, float4 placement, float3 right, float3 up)
{
    float phase=settings.x, sweep=settings.y, mirror=settings.w;
    float2 corner=uv*2.0-1.0;
    float3 p;
    if (data.y<0.5)
        p=emberPath(uv.x,corner.y*0.86,phase,mirror);
    else if (data.y<1.5)
        p=emberSpark(data.x,motion,shape,corner,phase,sweep,mirror,right,up);
    else if (data.y<2.5)
        p=emberPath(0.59,0.0,emberBorn(0.59,sweep),mirror)+(right*corner.x+up*corner.y)*0.91;
    else
        {
            float progress=1.0-pow(1.0-min(1.0,phase/max(0.01,sweep)),1.25);
            float3 anchor=emberPath(min(progress,0.64),0.0,phase,mirror);
            p=float3(anchor.x*0.83+corner.x*2.80,-placement.w,anchor.z+corner.y*2.25);
        }
    return p*placement.x;
}

float3 emberShade(float2 data,float2 uv,float4 motion,float4 shape,
                  float4 settings,float4 placement,float4 brush)
{
    float phase=settings.x, sweep=settings.y;
    float3 rgb;
    if (data.y<0.5)
        rgb=emberRibbon(uv,brush,phase,sweep,settings.z);
    else if (data.y<1.5)
        rgb=emberSparkColor(uv,phase-emberBorn(data.x,sweep)-motion.w,shape.x,shape.w);
    else if (data.y<2.5)
        rgb=emberFlare(uv,phase,sweep);
    else
        rgb=emberPool(uv,phase,sweep,placement.z);
    return rgb*placement.y*(1.0-smoothstep(0.86,1.0,phase));
}
#endif
