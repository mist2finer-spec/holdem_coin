# Poker audio

User-supplied MP3 assets; the user states these are free to use without a license requirement.

| File | Playback |
|---|---|
| game_room.mp3 | Lobby music, looping |
| poker_room.mp3 | Solo/multiplayer table music, looping |
| shuffle_card.mp3 | Empty-table hand transition, loop/cut to 1.5 seconds |
| taking_card.mp3 | Hole cards dealt, after shuffle |
| chip_raise.mp3 | Confirmed bet, raise or call |
| all_in_chip.mp3 | Confirmed all-in, including stack-exhausting calls |

Music volume 24%, effects 65%. First interaction unlocks browser audio. Mute preference persists locally; leaving poker stops all audio, hidden tabs are silent. Audio failure never blocks gameplay. Multiplayer dealStage snapshots are deduplicated; reconnecting does not replay prior actions.

Start-screen ambience: `choose_map.mp3` loops at 42% gain; `tv_sound.mp3` loops at 3.5% gain as a faint background layer. Both stop together on navigation, mute or tab hiding. These two additional files were supplied by the user.
