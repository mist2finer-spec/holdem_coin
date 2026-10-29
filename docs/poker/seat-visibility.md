# Seat visibility correction

North guest uses an explicitly sized upper-body viewport with an absolutely positioned full-height sprite. This avoids image flex shrink and negative name offsets obscuring the face. West/east columns move out to 10%/90%. All guest, name and chip column widths match (64px, 54px on short screens). Opponent hole cards are centered above the portrait; own cards and card visibility rules remain unchanged.

Production build passed. Browser QA could not execute: installed Playwright has no browser binary and Chromium download returned a truncated archive. Image-generated layout mockup is illustrative only, not a runtime screenshot. Formal verification omitted for presentation-only changes.
