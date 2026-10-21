# 1.16.1 — full-contribution house rake

Cause: unmatched excess was deliberately returned without rake. Called-action EV used the same untaxed refund; fold-win EV charged only the pre-existing pot. This implemented a different rule from the requested full-bet house rake.

Completed hands now charge `floor(sum(actual totalBet) * 0.05)`, including uncalled bets/all-ins. One shared layer allocator carries rounding across main pots, side pots and refunds. Eligibility remains unchanged: unmatched excess belongs to its contributor after its rake, and short-stack winners cannot receive a covering player's excess. Net profit remains payout minus contribution. Aborted hands retain the existing full rollback with zero rake.

Example: 20,000 all-in versus a player who contributes 200 then folds. Gross contributions 20,200; rake 1,010; winner receives 19,190; winner's net profit -810. The game can therefore charge a net loss on a successful oversized bluff, as requested.

CPU called EV uses precisely the same taxed layers as settlement. Fold-win EV is existing gross pot minus `floor((existing gross pot + newly paid bet) * 5%)`; a large uncalled bet is no longer free in the raise/shove EV model. Position/stack realization and equity estimates remain estimates, not a solver or a guarantee against mixed strategy shoves.

Applies through shared settlement/EV code to single player, multiplayer and self-play training. Regression cases cover folded-to all-ins, taxed excess ownership, main/side-pot eligibility, total rounding and chip conservation, EV versus actual settlement, and real server settlement. Pair strategy tests now require positive EV rather than forcing shoves that became negative under the new house rule.
