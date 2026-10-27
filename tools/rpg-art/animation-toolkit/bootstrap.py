"""Connect pinned upstream research sources without executing their setup/install scripts."""
import argparse,json,subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--cache',type=Path,required=True);a=p.parse_args();a.cache.mkdir(parents=True,exist_ok=True);lock=json.loads((Path(__file__).parent/'connections.lock.json').read_text())
for item in lock['repositories']:
 dest=a.cache/item['name']
 if not dest.exists():subprocess.run(['git','clone','--filter=blob:none',item['url'],str(dest)],check=True)
 subprocess.run(['git','fetch','origin',item['commit']],cwd=dest,check=True);subprocess.run(['git','checkout','--detach',item['commit']],cwd=dest,check=True)
 print('CONNECTED',item['name'],item['mode'])
