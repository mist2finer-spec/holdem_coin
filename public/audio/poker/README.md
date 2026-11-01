# Poker audio

User-supplied MP3 assets; the user states these are free to use without a license requirement.

| File | Playback |
|---|---|
| lobby_jazz.mp3 | Lobby at 24% gain; solo/multiplayer/tournament tables at 6%, looping |
| button_press.mp3 | Non-betting UI buttons at 45% gain |
| game_room.mp3 / poker_room.mp3 | Historical files, no longer selected for playback |
| shuffle_card.mp3 | Empty-table hand transition, loop/cut to 1.5 seconds |
| taking_card.mp3 | Hole cards dealt, after shuffle |
| chip_raise.mp3 | Confirmed bet, raise or call |
| all_in_chip.mp3 | Confirmed all-in, including stack-exhausting calls |

Chip/dealing effects remain at 65%. Betting controls, raise-size menus (including portalled content), and queued pre-actions exclude the generic button sound. Confirmed chip actions retain chip_raise/all_in_chip; fold/check do not add a chip sound. A single capture-phase click listener covers mouse, touch-generated clicks and keyboard activation; pointerdown only unlocks audio, avoiding duplicate touch feedback. Poker scene transitions retain the navigation click; mute, hide and poker exit invalidate delayed UI effects. RPG controls are silent in this poker audio system.

First interaction unlocks browser audio. Mute preference persists locally; leaving poker stops all audio, hidden tabs are silent. Audio failure never blocks gameplay. Multiplayer dealStage snapshots are deduplicated; reconnecting does not replay prior actions. New lobby_jazz.mp3 and button_press.mp3 were supplied by the user on 2026-11-01. Their bytes are copied unchanged.

Start-screen ambience: `choose_map.mp3` loops at 42% gain; `tv_sound.mp3` loops at 22% gain as a faint background layer. The TV source averages -31.7 dBFS versus -12.8 dBFS for choose_map, so the final TV layer averages about 24.5 dB below the main track. Both stop together on navigation, mute or tab hiding. These two additional files were supplied by the user.

2026-11-01 validation: audio regression and production build passed. Tests cover lobby/table gain, no old BGM selection, navigation clicks, no autoplay before unlock, mute/visibility/exit cancellation, shuffle duration and existing chip/deal effects. No game rules or settlement changed. Per AGENTS.md, formal verification is omitted for this presentation/audio change; actual lifecycle tests exercise the affected asynchronous requests.
