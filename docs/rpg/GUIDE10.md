# guid_10 RPG growth integration

Source: user-provided guid_10.pptx, 8 slides. Normalized values verified against the private recovered CombatArtData, TraitData, MasteryData, WillData and SkillData tables. Original binaries, full tables and screenshots are not committed.

## Implemented

- Battle stays above a bounded, independently scrolling growth panel. Tabs: combat arts, traits, skills, mastery and fighting spirit. Existing original skill icons and weapon assets are reused. No replacement character imagery.
- 13 combat-art categories, 19 definition rows from tiers 1–2. Original costs, increments, caps, tier gates and cross-training prerequisites. A ×1/×10/×100 purchase buys up to the affordable/unlocked/capped quantity; each level's cost is summed, charged once and saved with existing sequence/CAS retry protection.
- Existing attackTraining/healthTraining fields remain authoritative for art101/102. Their historical levels and balances are preserved. Legacy single-training endpoint commands now use the same gated purchase planner as bulk commands. Historical levels remain valid.
- 13 traits, maximum10 each. One point per character level after level1. The guide explicitly asks for the same categories as combat arts, with approximately ten training levels per point. Accordingly, this is a **web-specific distribution board**, not a claim to reproduce the original 780-node board. Each point applies ten increments from the first art matching its ability.
- Original abilities: raw/rate attack and HP, basic/skill damage, attack speed, crit and crit damage feed the current combat adapter. Valor/mental use a capped tanh modifier against the test monster's zero reference. Focus and tenacity persist/display, but original accuracy/CC mechanics are not implemented in this test enemy and are clearly identified as pending in UI. No hidden miss or invulnerability penalty was added.
- Six existing web skills can be equipped/disabled and strengthened. Original common-grade maximum50 and per-level duplicate requirements are used. Existing six animations remain. +5% damage/healing per level and deterministic acquisition (one copy every5 kills, rotating through slots) are **web test adapters**, not recovered skill-Type mappings, gacha, synthesis or awakening.
- First10 mastery stages use recovered costs and cumulative ability rows (selected current row, not sum of previous snapshots). Test source:100 mastery essence per kill. Native extra-hit unlocks beyond the current combo are pending.
- Fighting spirit level0–100 uses the recovered first-grade curve and +2attack/+10HP/+2valor/+2focus per level. Level0 is a web starting state; first purchase uses level1 price. Test source:50 orbs per kill. Evolution and spirit cards are pending.
- Armory has separate weapon and armor tabs. Existing grade1 equipment strengthening remains, with current HP preview and explicit unavailable higher-grade synthesis/engraving.
- Base movement/attack/rush/dodge tempo multiplied by0.85, retaining weapon speed differences. Attack-speed ability changes attack/skill timing only. In-flight motion snapshots its animation rate, so training mid-swing does not desynchronize the existing hit schedule.
- HP10000 test bar stays unchanged. Natural-HP growth uses the previous damage-scaling adapter.

## Persistence and limits

New records and skill arrays migrate additively and validate IDs, lengths and caps. Battle responses deep-copy nested state. Failed/unaffordable requests do not charge; duplicate successful sequences return the cached result. Currency caps remain1e12. Test rewards are only awarded by the server on actual kills.

The existing Render free service still uses ephemeral SQLite: deployment or instance replacement can reset guest progress. This patch does not provision paid persistence or change accounts/authentication.

## Verification

RPG regression tests include bulk cost summation/partial affordability/unlock stopping, invalid requests, caps, earned trait points, resource consumption, restart serialization, duplicate sequences, old response snapshot isolation, disabled skill enforcement, drop cadence and attack timing synchronization. Type checking, lint and production build are required before publishing.
