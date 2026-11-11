var app=UnityEngine.Object.FindFirstObjectByType<IslandGame.IslandApp>();
var view=UnityEngine.Object.FindFirstObjectByType<IslandGame.Battle3DView>();
var fx=view.Lightning;var cam=app.HudBattle.BattleCamera;var target=fx.LatestTarget;var map=app.HudSession.Map;
int lines=UnityEngine.Object.FindObjectsByType<UnityEngine.LineRenderer>(UnityEngine.FindObjectsInactive.Include,UnityEngine.FindObjectsSortMode.None).Length;
int particles=UnityEngine.Object.FindObjectsByType<UnityEngine.ParticleSystem>(UnityEngine.FindObjectsInactive.Include,UnityEngine.FindObjectsSortMode.None).Length;
fx.Reset();
for(int i=0;i<10;i++){fx.Spawn(target,0,2.4f,400+i,4);fx.Present(cam,map,.06f,null);if(fx.ActiveCount>IslandGame.LightningStrikeVfx.Capacity)throw new System.Exception("Pool capacity exceeded");}
if(lines!=UnityEngine.Object.FindObjectsByType<UnityEngine.LineRenderer>(UnityEngine.FindObjectsInactive.Include,UnityEngine.FindObjectsSortMode.None).Length||particles!=UnityEngine.Object.FindObjectsByType<UnityEngine.ParticleSystem>(UnityEngine.FindObjectsInactive.Include,UnityEngine.FindObjectsSortMode.None).Length)throw new System.Exception("Unity objects grew after 10 strikes");
int active=fx.ActiveCount;fx.Present(cam,map,1,null);if(fx.ActiveCount!=0||fx.ParticleCount!=0)throw new System.Exception("Effects did not expire");fx.Reset();
foreach(var name in new[]{"LightningGround","LightningGroundArc"}){var shader=UnityEngine.Resources.Load<UnityEngine.Shader>(name);if(!shader||!shader.isSupported)throw new System.Exception("Unsupported shader "+name);foreach(var msg in UnityEditor.ShaderUtil.GetShaderMessages(shader))if(msg.severity==UnityEditor.Rendering.ShaderCompilerMessageSeverity.Error)throw new System.Exception(msg.message);}
return new{result="PASS",strikes=10,activeAtOverlap=active,capacity=IslandGame.LightningStrikeVfx.Capacity,lines,particles,expired=true,shaders="supported/no errors"};
