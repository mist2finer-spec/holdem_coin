#!/usr/bin/env python3
"""Prepare private recovered curves and validate the web combat adapter in one run."""
import argparse
import hashlib
import json
import shutil
import subprocess
from pathlib import Path
from export_runtime_balance import export


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--recovered',required=True,type=Path)
    p.add_argument('--output',type=Path,default=Path('data/rpg-reference/runtime-balance.json'))
    a=p.parse_args()
    root=Path(__file__).resolve().parents[2]
    output=a.output if a.output.is_absolute() else root/a.output
    if output.exists():
        evidence=json.loads(output.with_suffix('.evidence.json').read_text(encoding='utf-8'))
        if hashlib.sha256(output.read_bytes()).hexdigest()!=evidence['runtimeSha256']:
            raise ValueError('Existing runtime configuration changed; use a separate --output path')
        for name,digest in evidence['sourceHashes'].items():
            if hashlib.sha256((a.recovered/name).read_bytes()).hexdigest()!=digest:
                raise ValueError('Source differs; use a separate --output path to preserve existing configuration')
    else:
        print('Recovered curve adapter prepared; max level:',export(a.recovered,output))
    npm=shutil.which('npm.cmd') or shutil.which('npm')
    if not npm:raise ValueError('Install Node.js/npm and repository dependencies first')
    for command in ['check:rpg','test:rpg']:
        subprocess.run([npm,'run',command],cwd=root,check=True)
    print('RPG_ADAPTER_VALIDATED')
    print('Private balance:',output)
    print('For a hosted server set RPG_BALANCE_PATH to this absolute path and RPG_SAVE_DIR to persistent storage.')
    print('Original dedicated character motions, original damage formula and original drops are not claimed restored.')


if __name__=='__main__':main()
