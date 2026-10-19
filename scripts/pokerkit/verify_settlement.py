"""Optional independent PokerKit check. Input: JSON fixtures on stdin.
Install reference dependency: python -m pip install pokerkit==0.7.7
No Python service is required for browser or multiplayer gameplay.
"""
import json
import sys
from pokerkit import Automation, Mode, NoLimitTexasHoldem

AUTOMATIONS = (
    Automation.ANTE_POSTING, Automation.BET_COLLECTION,
    Automation.BLIND_OR_STRADDLE_POSTING, Automation.CARD_BURNING,
    Automation.RUNOUT_COUNT_SELECTION, Automation.HOLE_CARDS_SHOWING_OR_MUCKING,
    Automation.HAND_KILLING, Automation.CHIPS_PUSHING, Automation.CHIPS_PULLING,
)

def verify(case):
    starts = case['startingStacks']
    state = NoLimitTexasHoldem.create_state(
        AUTOMATIONS, True, 0, (100, 200), 200, starts, len(starts),
        mode=Mode.CASH_GAME,
        rake=lambda amount, _state: (amount // 20, amount - amount // 20),
    )
    for cards in case['holes']:
        state.deal_hole(cards)
    for _ in range(32):
        if state.actor_index is None:
            break
        actor = state.actor_index
        target = state.bets[actor] + state.stacks[actor]
        if state.can_complete_bet_or_raise_to(target):
            state.complete_bet_or_raise_to(target)
        else:
            state.check_or_call()
    assert state.actor_index is None
    for street in case['streets']:
        state.deal_board(street)
    assert not state.status
    assert list(state.stacks) == case['expectedStacks'], (case['name'], state.stacks, case['expectedStacks'])
    assert list(state.payoffs) == case['expectedProfits'], (case['name'], state.payoffs, case['expectedProfits'])
    return {'name': case['name'], 'stacks': list(state.stacks), 'profits': list(state.payoffs)}

if __name__ == '__main__':
    print(json.dumps([verify(case) for case in json.load(sys.stdin)], indent=2))
