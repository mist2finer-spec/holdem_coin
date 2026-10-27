"""Differential original ARM64 critical and hypercritical ability-only verification."""
import argparse,json,math,random
from pathlib import Path
from verify_final_damage_native import create_oracle
from reference_critical import critical_damage,hypercritical_damage

def verify(native,output):
    layout={r['name']:r['offset'] for r in json.loads((Path(__file__).resolve().parents[2]/'docs/rpg/actor-ability-layout.json').read_text())['fields']}
    oracle=create_oracle(native,layout);rng=random.Random(20261027);cases=0
    for hyper in [False,True]:
     for i in range(600):
      chance=rng.choice([0,10,50,90,100,150]);resistance=rng.choice([0,5,50,100]);percent=rng.choice([0,50,100,250]);bonus=rng.choice([-10,0,20]);cap=90.;damage=rng.uniform(1,10000);rolls=[rng.random(),rng.random()];bits=1 if hyper and i%3 else 0
      attacker={'hyperCri' if hyper else 'cri':chance,'hyperCriDmg' if hyper else 'criDmg':percent}
      actual=oracle.critical(damage,bits,attacker,{'criResist':resistance},bonus,cap,rolls,hyper)
      expected=hypercritical_damage(damage,bits,chance=chance,damage_percent=percent,bonus=bonus,cap=cap,roll=rolls[0]) if hyper else critical_damage(damage,bits,chance=chance,damage_percent=percent,resistance=resistance,bonus=bonus,cap=cap,rolls=rolls)
      if not math.isclose(actual[0],expected[0],rel_tol=1e-12) or actual[1:]!=expected[1:]:raise AssertionError((hyper,actual,expected))
      cases+=1
    result={'passed':True,'cases':cases,'scope':'Original critical and hypercritical formulas; supplied rolls and caps; active hypercritical effects excluded'}
    output.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--native',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();verify(a.native,a.output)
