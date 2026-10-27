"""Read-only, parameterized queries of the recovered private acquisition database."""
import argparse,json,sqlite3
from pathlib import Path

def query(path,*,chapter=None,material=None,category=None,stage=None):
 if not path.is_file():raise FileNotFoundError(path)
 db=sqlite3.connect(path.resolve().as_uri()+'?mode=ro',uri=True);db.row_factory=sqlite3.Row
 try:
  if stage is not None:
   if category is None:raise ValueError('Stage requires explicit category')
   rows=db.execute('SELECT group_no,row_no,reward_category,reward_type,amount,min_amount,ref_idle,chance FROM reward_entries WHERE category=? AND stage_id=? ORDER BY group_no,row_no',(category,stage))
  elif chapter is not None:
   rows=db.execute('SELECT b.chapter,b.material_id,m.name,b.amount,b.source_vector FROM chapter_baselines b JOIN materials m ON m.id=b.material_id WHERE b.chapter=? AND (? IS NULL OR b.material_id=?) ORDER BY b.material_id',(chapter,material,material))
  elif material is not None:
   rows=db.execute('SELECT id,name,max_count,max_recharge,definition FROM materials WHERE id=?',(material,))
  else:raise ValueError('Select chapter, material or category+stage')
  return [dict(r) for r in rows]
 finally:db.close()
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--db',type=Path,required=True);p.add_argument('--chapter',type=int);p.add_argument('--material',type=int);p.add_argument('--category');p.add_argument('--stage',type=int);a=p.parse_args();print(json.dumps(query(a.db,chapter=a.chapter,material=a.material,category=a.category,stage=a.stage),ensure_ascii=False,indent=2))
