"""Take screenshots of character_animation.html — one default, one mid-attack."""
from playwright.sync_api import sync_playwright
from pathlib import Path

SRC = Path('/home/z/my-project/src/ui/demo/character_animation.html').resolve()
OUT_DEFAULT = Path('/home/z/my-project/download/character_animation_default.png')
OUT_ATTACK  = Path('/home/z/my-project/download/character_animation_attack.png')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1200, 'height': 800}, device_scale_factor=2)
    page = context.new_page()

    # Capture console errors
    errors = []
    page.on('pageerror', lambda exc: errors.append(str(exc)))

    page.goto(SRC.as_uri())
    page.wait_for_load_state('networkidle')
    # Wait for our loaded counter (exposed on window)
    page.wait_for_function('window.imagesLoaded !== undefined && window.imagesLoaded >= 20', timeout=15000)
    page.wait_for_timeout(2000)  # let animation start cycling

    page.screenshot(path=str(OUT_DEFAULT), full_page=True)
    print(f'default: {OUT_DEFAULT}')

    # Trigger attack by pressing Space
    page.press('body', ' ')
    page.wait_for_timeout(500)
    page.screenshot(path=str(OUT_ATTACK), full_page=True)
    print(f'attack: {OUT_ATTACK}')

    if errors:
        print(f'\npage errors ({len(errors)}):')
        for e in errors[:5]:
            print(f'  {e}')

    browser.close()
