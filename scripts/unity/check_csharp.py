"""Parse C# source, reporting syntax only. Requires tree-sitter and tree-sitter-c-sharp."""
from pathlib import Path
import sys
try:
 import tree_sitter,tree_sitter_c_sharp
except ImportError:
 print('C_SHARP_SYNTAX_NOT_RUN: install tree-sitter and tree-sitter-c-sharp',file=sys.stderr);raise SystemExit(2)
ROOT=Path(__file__).resolve().parents[2]
parser=tree_sitter.Parser(tree_sitter.Language(tree_sitter_c_sharp.language()))
paths=sorted((ROOT/'unity/IslandGame/Assets/Island').rglob('*.cs'))+sorted((ROOT/'scripts/unity/contracts').glob('*.cs'))+sorted((ROOT/'scripts/unity/boss-trial-checks').glob('*.cs'))
failed=[]
for path in paths:
 tree=parser.parse(path.read_bytes())
 def walk(node):
  if node.type=='ERROR' or node.is_missing:failed.append((str(path.relative_to(ROOT)),node.start_point,node.type))
  for child in node.children:walk(child)
 walk(tree.root_node)
if failed:
 for row in failed:print(*row)
 raise SystemExit(1)
print('C_SHARP_SYNTAX_PASSED',len(paths),'files; semantic Unity compilation was not run')

# Pinned Spine 4.2 declares Physics inside Skeleton, not directly in namespace Spine.
# Syntax parsing alone cannot detect an invalid type qualification.
for path in paths:
 if 'Spine.Physics.' in path.read_text(encoding='utf-8'):
  print('INVALID_SPINE_PHYSICS_SCOPE',path,file=sys.stderr);raise SystemExit(1)
print('PINNED_SPINE_PHYSICS_SCOPE_PASSED')
