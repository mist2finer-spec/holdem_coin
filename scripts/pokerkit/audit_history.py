"""Offline audit for admin/public holdem hand histories, PokerKit 0.7.7.
Usage: python scripts/pokerkit/audit_history.py history.json
Public histories with masked cards cannot verify showdown (reported as skipped).
No network, account mutation, or pretend GTO/50% fallback.
"""
import argparse,json,sys
from pokerkit import Automation,Mode,NoLimitTexasHoldem,StandardHighHand,Card

SUITS={'♠':'s','♥':'h','♦':'d','♣':'c'}
def cards(raw):
    return list(Card.parse(''.join(x[0]+SUITS.get(x[1],x[1]) for x in raw)))
def audit(hand):
    issues=[];skips=[]
    def issue(field,expected,actual,sequence=0):
        issues.append(dict(hand=hand['handNumber'],sequence=sequence,field=field,expected=expected,actual=actual))
    if hand.get('status')!='completed':return issues,['aborted hand: replay skipped']
    results=hand['results'];contributed=sum(r['contribution'] for r in results)
    if contributed!=sum(r['payout'] for r in results)+hand['rake']:issue('chip_conservation',contributed,sum(r['payout'] for r in results)+hand['rake'])
    contested=sum(p['amount'] for p in hand['pots'] if p.get('refundSeatId') is None)
    expected_rake=contested//20 if len(hand['board'])>=3 else 0
    if hand['rake']!=expected_rake:issue('rake',expected_rake,hand['rake'])
    for p in hand['pots']:
        if p.get('refundSeatId') is not None and p.get('rake',0)!=0:issue('refund_rake',0,p['rake'])
    players={p['seatId']:p for p in hand['players']};ring=max(players)+1
    known=[c for p in players.values() for c in p.get('holeCards',[]) if c!='??']+hand['board']
    if len(set(known))!=len(known):issue('duplicate_cards','unique known cards',known)
    anchor=hand['bigBlindSeat'] if len(players)==2 else hand['smallBlindSeat']
    order=sorted(players,key=lambda n:(n-anchor+ring)%ring)
    autos=(Automation.ANTE_POSTING,Automation.BLIND_OR_STRADDLE_POSTING,Automation.BET_COLLECTION,
           Automation.RUNOUT_COUNT_SELECTION,Automation.HOLE_CARDS_SHOWING_OR_MUCKING,Automation.HAND_KILLING,Automation.CHIPS_PUSHING,Automation.CHIPS_PULLING)
    try:
        state=NoLimitTexasHoldem.create_state(autos,True,0,(hand['smallBlind'],hand['bigBlind']),hand['bigBlind'],[players[n]['startingStack'] for n in order],len(order),mode=Mode.CASH_GAME)
        for seat in order:
            hole=players[seat].get('holeCards',[])
            state.deal_hole(cards(hole) if len(hole)==2 and '??' not in hole else '????')
        dealt=0;folded=set();allin={f['seatId'] for f in hand['forcedBets'] if f['paid']==players[f['seatId']]['startingStack']}
        for a in hand['actions']:
            seq=a['sequence'];board=a.get('board',[])
            if len(board)>dealt:
                state.burn_card('??');state.deal_board(cards(board[dealt:]));dealt=len(board)
            if state.actor_index is None:issue('unexpected_action','no pending actor',a['seatId'],seq);break
            if order[state.actor_index]!=a['seatId']:issue('actor',order[state.actor_index],a['seatId'],seq);break
            pk_call=state.checking_or_calling_amount
            if a['stackBefore']!=state.stacks[state.actor_index]:issue('stackBefore',state.stacks[state.actor_index],a['stackBefore'],seq)
            if a['betBefore']!=state.bets[state.actor_index]:issue('betBefore',state.bets[state.actor_index],a['betBefore'],seq)
            if a['paid']!=a['stackBefore']-a['stackAfter']:issue('paid',a['stackBefore']-a['stackAfter'],a['paid'],seq)
            expected_bet=a['betBefore']+a['paid']
            if a['betAfter']!=expected_bet:issue('betAfter',expected_bet,a['betAfter'],seq)
            if a['action']=='check' and pk_call:issue('check','zero call',pk_call,seq)
            if min(a['callBefore'],a['stackBefore'])!=pk_call:issue('call',pk_call,min(a['callBefore'],a['stackBefore']),seq)
            audit_data=a.get('privateAudit') or {}
            recorded_min=a.get('minRaiseBefore',audit_data.get('minRaise'))
            if 'canRaiseBefore' in a and a['canRaiseBefore']!=state.can_complete_bet_or_raise_to():issue('canRaiseBefore',state.can_complete_bet_or_raise_to(),a['canRaiseBefore'],seq)
            pk_min=state.min_completion_betting_or_raising_to_amount
            if pk_min is not None and recorded_min is not None:
                # Public minimum is uncapped; a shorter all-in is the sole exception.
                capped=min(recorded_min,a['stackBefore']+a['betBefore'])
                if capped!=pk_min:issue('minRaise',pk_min,capped,seq)
            actionable=set(players)-folded-allin
            post_order=sorted(actionable,key=lambda n:(n-hand['buttonSeat']-1+ring)%ring)
            expected_oop=len(post_order)>1 and post_order[-1]!=a['seatId']
            if audit_data.get('isOOP') is not None and audit_data['isOOP']!=expected_oop:issue('isOOP',expected_oop,audit_data['isOOP'],seq)
            act=a['action'];highest=max(state.bets)
            if act=='raise' and a['street']!='PREFLOP' and highest==0:issue('action_label','bet',act,seq)
            if act=='fold':state.fold();folded.add(a['seatId'])
            elif act in ('call','check') or (act=='allin' and a['betAfter']<=highest):state.check_or_call()
            elif act in ('bet','raise','allin'):state.complete_bet_or_raise_to(a['betAfter'])
            else:raise ValueError('Unknown action '+act)
            if a['stackAfter']==0:allin.add(a['seatId'])
        else:
            while dealt<len(hand['board']):
                count=3 if dealt==0 else 1
                state.burn_card('??');state.deal_board(cards(hand['board'][dealt:dealt+count]));dealt+=count
            if state.status:issue('incomplete_replay','completed PokerKit state','pending operations')
        for pot in hand['pots']:
            ids=pot['eligibleSeatIds']
            if not ids:continue
            if len(ids)==1:expected=ids
            elif any('??' in players[n].get('holeCards',[]) or len(players[n].get('holeCards',[]))!=2 for n in ids):
                skips.append('showdown: private cards masked');continue
            else:
                values={n:StandardHighHand.from_game(cards(players[n]['holeCards']),cards(hand['board'])) for n in ids}
                best=max(values.values());expected=[n for n,h in values.items() if h==best]
            if set(expected)!=set(pot.get('winnerSeatIds',[])):issue('showdown_winners',expected,pot.get('winnerSeatIds',[]))
    except Exception as exc:
        issue('pokerkit_replay','legal complete hand',f'{type(exc).__name__}: {exc}',locals().get('seq',0))
    return issues,skips

def main():
    ap=argparse.ArgumentParser();ap.add_argument('history');args=ap.parse_args()
    with open(args.history,encoding='utf-8-sig') as f:payload=json.load(f)
    hands=payload['hands'] if isinstance(payload,dict) else payload
    reports=[]
    for h in hands:
        issues,skips=audit(h);reports.append({'id':h['id'],'hand':h['handNumber'],'issues':issues,'skipped':skips})
    print(json.dumps({'reference':'PokerKit 0.7.7','gto_solver':False,'reports':reports},ensure_ascii=False,indent=2))
    return int(any(r['issues'] for r in reports))
if __name__=='__main__':sys.exit(main())
