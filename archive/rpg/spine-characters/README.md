# Archived nine-character Spine rigs

These are the intact Spine 4.2 character rigs previously used in hunting. The game now uses the existing 16-frame sprite sheets. This folder is outside `public`, so the web server does not serve or load these rigs.

- Each character folder retains skeleton JSON, atlases, textures, individual parts, previews and source provenance.
- `index.json` records the skeleton hashes at archival time.
- Native monster Spine assets remain active; this archive concerns the nine player appearances.
- Optional integrity check: `npm run test:rpg:archive`.
- Unity export remains available through `python scripts/rpg/export_spine_unity.py --output /path/to/archive.zip`.
- Regeneration scripts target this archive and do not switch the game back to Spine.
- No native `.spine` editor project is available. See `docs/rpg/UNITY_SPINE_IMPORT.md` for version and licensing notes.
