#if UNITY_EDITOR
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace IslandGame.Editor {
 public static class BossTrialTestMenu {
  [MenuItem("Island/Boss Trial Test (new unsaved scene)")]
  public static void OpenTestScene() {
   if(!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())return;
   // Never overwrite the integration scene or the user's unpublished uGUI work.
   Scene scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
   scene.name="BossTrialsTest";
   var host=new GameObject("Boss trials · standalone local sandbox");
   var trial=host.AddComponent<BossTrials.BossTrialController>();trial.ShowOnStart=true;
   Selection.activeGameObject=host;
   Debug.Log("Boss trial test scene is unsaved. Press Play. No backend connection or account writes are used.");
  }
  [MenuItem("GameObject/Island/Add Boss Trial Launcher",false,10)]
  public static void AddLauncher() {
   var host=new GameObject("Boss trial launcher");Undo.RegisterCreatedObjectUndo(host,"Add boss trial launcher");
   host.AddComponent<BossTrials.BossTrialController>();Selection.activeGameObject=host;
   Debug.Log("In an IslandApp scene, merge and bind IslandApp.OpenBossTrials to the uGUI Dungeon button. ShowMenu routes to that hook when available and refuses an unmerged online host. Standalone scenes may bind ShowMenu directly.");
  }
 }
}
#endif
