"""Read-only derived reward lookup. Never applies a grant or samples rewards."""
import argparse,json,sqlite3
from pathlib import Path

def query(path,kind,chapter,stage,material=None):
 if not path.is_file():raise FileNotFoundError(path)
 table={'idle-base':'interpolated_idle_bases','hunting-preview':'hunting_preview'}.get(kind)
 if table is None:raise ValueError('Unknown reward view')
 db=sqlite3.connect(path.resolve().as_uri()+'?mode=ro',uri=True);db.row_factory=sqlite3.Row
 try:return [dict(row) for row in db.execute(f'SELECT * FROM {table} WHERE chapter=? AND stage=? AND (? IS NULL OR material=?) ORDER BY material',(chapter,stage,material,material))]
 finally:db.close()
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--db',type=Path,required=True);p.add_argument('--kind',choices=['idle-base','hunting-preview'],required=True);p.add_argument('--chapter',type=int,required=True);p.add_argument('--stage',type=int,required=True);p.add_argument('--material',type=int);a=p.parse_args();print(json.dumps(query(a.db,a.kind,a.chapter,a.stage,a.material),ensure_ascii=False,indent=2))
