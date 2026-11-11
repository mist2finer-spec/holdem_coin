#ifndef ISLAND_LIGHTNING_SURFACE
#define ISLAND_LIGHTNING_SURFACE
#include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/DeclareDepthTexture.hlsl"
// Let the ground's light reach low grass, but retain occlusion by bodies and tall scenery.
void LightningSurfaceOcclusion(float3 world,float2 screenUV) {
 // Clip-derived UV is local to the battle viewport, including direct Android presentation.
 // Absolute SV_POSITION / screen size incorrectly samples outside a partial viewport.
 float depth=SampleSceneDepth(screenUV);
 if(depth<=.00001 || depth>=.99999)return;
 #if !UNITY_REVERSED_Z
 depth=lerp(UNITY_NEAR_CLIP_VALUE,1,depth);
 #endif
 float3 surface=ComputeWorldSpacePosition(screenUV,depth,UNITY_MATRIX_I_VP);
 if(-TransformWorldToView(surface).z<-TransformWorldToView(world).z-.025 && surface.y-world.y>.65)clip(-1);
}
#endif
