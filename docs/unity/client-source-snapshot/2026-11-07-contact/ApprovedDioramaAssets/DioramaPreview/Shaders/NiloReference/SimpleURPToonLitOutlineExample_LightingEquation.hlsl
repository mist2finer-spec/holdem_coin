// Derived from Colin Leung's MIT public tutorial, pinned fbe276e0df1d1f9379e13581c20b6a080a1a6977.
// Island changes: directional SH, broad diffuse transition, energy split metallic/specular and optional directional rim.
// See LICENSE and SOURCE.md. This is not the separate commercial NiloToonURP product.
#pragma once
half3 ShadeGI(ToonSurfaceData s, ToonLightingData d) {
 return max(_IndirectLightMinColor, SampleSH(d.normalWS)) * lerp(1, s.occlusion, .65);
}
half3 ShadeSingleLight(ToonSurfaceData s, ToonLightingData d, Light light, bool additional) {
 half ndl = saturate(dot(d.normalWS,light.direction));
 half diffuse = lerp(ndl, smoothstep(-_CelShadeSoftness,_CelShadeSoftness+0.5,dot(d.normalWS,light.direction)),.2);
 half3 h = SafeNormalize(light.direction+d.viewDirectionWS);
 half rough = max(.08,1-s.smoothness);half exponent = min(256,2/(rough*rough)-2);
 half spec = pow(saturate(dot(d.normalWS,h)),exponent)*(exponent+2)/8 * ndl;
 half3 f0 = lerp(half3(.04,.04,.04),s.albedo,s.metallic);
 half3 response = s.albedo*(1-s.metallic)*diffuse + f0*spec;
 return response * light.color * min(4,light.distanceAttenuation) * lerp(1,light.shadowAttenuation,_ReceiveShadowMappingAmount) * s.occlusion;
}
half3 ShadeEmission(ToonSurfaceData s, ToonLightingData d) {return lerp(s.emission,s.emission*s.albedo,_EmissionMulByBaseColor);}
half3 CompositeAllLightResults(half3 gi,half3 main,half3 additional,half3 emission,ToonSurfaceData s,ToonLightingData d) {
 half facing=pow(1-saturate(dot(d.normalWS,d.viewDirectionWS)),lerp(10,1,_RimWidth));
 half direction=saturate(dot(d.normalWS,normalize(half3(-.4,.8,-.3))));
 half3 reflected=GlossyEnvironmentReflection(reflect(-d.viewDirectionWS,d.normalWS),d.positionWS,1-s.smoothness,s.occlusion)*lerp(half3(.04,.04,.04),s.albedo,s.metallic);
 return reflected+gi*s.albedo*(1-s.metallic*.7)+main+additional+emission+_RimColor.rgb*_RimStrength*facing*direction;
}
