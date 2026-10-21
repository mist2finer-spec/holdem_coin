"""Take a full-page screenshot of preview_standalone.html for the user.
Adds explicit waits and console error capture for diagnostics.
"""
from playwright.sync_api import sync_playwright
from pathlib import Path

SRC = Path('/home/z/my-project/download/preview_standalone.html').resolve()
OUT = Path('/home/z/my-project/download/preview_screenshot.png')

console_logs = []
page_errors = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        viewport={'width': 1400, 'height': 1200},
        device_scale_factor=2,
    )
    page = context.new_page()

    page.on('console', lambda msg: console_logs.append(f'[{msg.type}] {msg.text}'))
    page.on('pageerror', lambda exc: page_errors.append(str(exc)))

    page.goto(SRC.as_uri())
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1500)  # give JS time to populate chip gallery

    # Verify the chip gallery got children
    chip_count = page.eval_on_selector('#chip-gallery', "el => el.children.length")
    player_count = page.eval_on_selector('#player-list', "el => el.children.length")
    print(f'chip cards rendered: {chip_count}')
    print(f'player rows rendered: {player_count}')

    page.screenshot(path=str(OUT), full_page=True)
    browser.close()

print(f'\nscreenshot saved: {OUT}')
print(f'size: {OUT.stat().st_size / 1024:.1f} KB')
if console_logs:
    print(f'\nconsole logs ({len(console_logs)}):')
    for l in console_logs[:10]:
        print(f'  {l}')
if page_errors:
    print(f'\npage errors ({len(page_errors)}):')
    for e in page_errors[:5]:
        print(f'  {e}')
