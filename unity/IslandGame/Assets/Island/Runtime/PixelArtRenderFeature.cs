using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.RenderGraphModule;
using UnityEngine.Rendering.Universal;
namespace IslandGame {
 public sealed class PixelArtRenderFeature : ScriptableRendererFeature {
  public Shader shader;
  Material material; PixelPass pass;
  public override void Create(){CoreUtils.Destroy(material);if(shader)material=CoreUtils.CreateEngineMaterial(shader);pass=new PixelPass(material);}
  public override void AddRenderPasses(ScriptableRenderer renderer,ref RenderingData data){
   bool active=PixelArtSettings.Active && data.cameraData.camera.GetComponent<PixelArtCamera>();
   Shader.SetGlobalFloat("_IslandPixelArt",active?1:0);
   if(active && material)renderer.EnqueuePass(pass);
  }
  protected override void Dispose(bool disposing){CoreUtils.Destroy(material);Shader.SetGlobalFloat("_IslandPixelArt",0);}
  sealed class PixelPass : ScriptableRenderPass {
   readonly Material mat;
   sealed class Data {public TextureHandle source;public Material material;}
   public PixelPass(Material m){mat=m;renderPassEvent=RenderPassEvent.AfterRenderingPostProcessing;requiresIntermediateTexture=true;ConfigureInput(ScriptableRenderPassInput.Depth);}
   public override void RecordRenderGraph(RenderGraph graph,ContextContainer frame){
    var r=frame.Get<UniversalResourceData>();if(r.isActiveTargetBackBuffer||!r.cameraDepthTexture.IsValid())return;
    var desc=graph.GetTextureDesc(r.activeColorTexture);desc.name="Island final palette";desc.clearBuffer=false;desc.filterMode=FilterMode.Point;
    var dest=graph.CreateTexture(desc);
    using(var b=graph.AddRasterRenderPass<Data>("Island depth edges + Bayer + final palette",out var d)){
     d.source=r.activeColorTexture;d.material=mat;
     b.UseTexture(d.source,AccessFlags.Read);b.UseTexture(r.cameraDepthTexture,AccessFlags.Read);
     b.UseAllGlobalTextures(true);b.SetRenderAttachment(dest,0,AccessFlags.Write);
     b.SetRenderFunc(static (Data data,RasterGraphContext ctx)=>Blitter.BlitTexture(ctx.cmd,data.source,new Vector4(1,1,0,0),data.material,0));
    }
    r.cameraColor=dest;
   }
  }
 }
}
