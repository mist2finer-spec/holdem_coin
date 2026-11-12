#ifndef ISLAND_PIXEL_LIGHTING
#define ISLAND_PIXEL_LIGHTING
float _IslandPixelArt;
half IslandPixelBand(half x) { return .25h + .35h*step(.32h,x) + .40h*step(.68h,x); }
half IslandPixelDiffuse(half x) { return lerp(x,IslandPixelBand(saturate(x)),_IslandPixelArt); }
#endif
