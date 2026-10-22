"""Compare TypeScript street traces with independent PokerKit 0.7.7 legality."""
import json,sys
from pokerkit import Automation,Mode,NoLimitTexasHoldem
for case in json.load(sys.stdin):
    s=NoLimitTexasHoldem.create_state((Automation.BLIND_OR_STRADDLE_POSTING,Automation.BET_COLLECTION),True,0,(100,200),200,case['stacks'],len(case['stacks']),mode=Mode.CASH_GAME)
    for _ in case['stacks']:s.deal_hole('????')
    for event in case['events']:
        actual={'actor':s.actor_index,'call':s.checking_or_calling_amount,'canRaise':s.can_complete_bet_or_raise_to(),'minTo':s.min_completion_betting_or_raising_to_amount}
        for key in actual:assert actual[key]==event[key],(case['name'],event,actual)
        target=event['target']
        if target>max(s.bets):s.complete_bet_or_raise_to(target)
        else:s.check_or_call()
    print(case['name']+': POKERKIT_MATCH')
