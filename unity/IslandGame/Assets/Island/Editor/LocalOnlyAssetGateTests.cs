using NUnit.Framework;
using IslandGame.Editor;

namespace IslandGame.Tests {
 // public-build-prep-20261123 (6): local-only scripts count as "in the player" unless the whole file is one #if UNITY_EDITOR block.
 public sealed class LocalOnlyAssetGateTests {
  [Test] public void Whole_file_in_one_UNITY_EDITOR_block_is_editor_only(){
   Assert.IsTrue(LocalOnlyAssetGate.EditorOnlyGuarded("#if UNITY_EDITOR // note\r\nusing UnityEngine;\r\nclass A {\r\n#if UNITY_EDITOR\r\n int x;\r\n#endif\r\n}\r\n\r\n#endif\r\n"));
   Assert.IsTrue(LocalOnlyAssetGate.EditorOnlyGuarded("#if UNITY_EDITOR\nclass A {}\n#endif"));
  }
  [Test] public void Partly_guarded_or_other_define_is_in_the_player(){
   Assert.IsFalse(LocalOnlyAssetGate.EditorOnlyGuarded("using UnityEngine;\nclass A {}\n"), "no guard");
   Assert.IsFalse(LocalOnlyAssetGate.EditorOnlyGuarded("#if UNITY_EDITOR\nusing UnityEditor;\n#endif\nclass A {}\n"), "guard closes before the code");
   Assert.IsFalse(LocalOnlyAssetGate.EditorOnlyGuarded("#if UNITY_EDITOR_WIN\nclass A {}\n#endif\n"), "another define");
   Assert.IsFalse(LocalOnlyAssetGate.EditorOnlyGuarded("#if !UNITY_EDITOR\nclass A {}\n#endif\n"), "inverted");
   Assert.IsFalse(LocalOnlyAssetGate.EditorOnlyGuarded("#if UNITY_EDITOR || ISLAND_DEV\nclass A {}\n#endif\n"), "or another define");
   Assert.IsFalse(LocalOnlyAssetGate.EditorOnlyGuarded(""), "empty");
  }
 }
}
