"""Take screenshots of all 4 model standalone demos."""
from playwright.sync_api import sync_playwright
from pathlib import Path

DEMOS = [
    ('model_2', '/home/z/my-project/download/character_model_2_standalone.html'),
    ('model_3', '/home/z/my-project/download/character_model_3_standalone.html'),
    ('model_4', '/home/z/my-project/download/character_model_4_standalone.html'),
    ('model_5', '/home/z/my-project/download/character_model_5_standalone.html'),
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for model_id, src in DEMOS:
        src_path = Path(src).resolve()
        out_path = Path(f'/home/z/my-project/download/character_{model_id}_screenshot.png')

        context = browser.new_context(viewport={'width': 1200, 'height': 800}, device_scale_factor=2)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda exc: errors.append(str(exc)))

        page.goto(src_path.as_uri())
        page.wait_for_load_state('networkidle')
        try:
            page.wait_for_function('window.imagesLoaded !== undefined && window.imagesLoaded >= 1', timeout=20000)
        except Exception as e:
            print(f'  WARN: {model_id} imagesLoaded wait failed: {e}')
        page.wait_for_timeout(1500)

        page.screenshot(path=str(out_path), full_page=True)
        size_kb = out_path.stat().st_size / 1024
        print(f'  {model_id}: {out_path.name} ({size_kb:.1f} KB)')
        if errors:
            print(f'    page errors: {errors[:3]}')

        context.close()
    browser.close()

# Also screenshot the index page
print('\n── index ──')
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1200, 'height': 800}, device_scale_factor=2)
    page = context.new_page()
    src = Path('/home/z/my-project/src/ui/demo/character_index.html').resolve()
    page.goto(src.as_uri())
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1500)
    out = Path('/home/z/my-project/download/character_index_screenshot.png')
    page.screenshot(path=str(out), full_page=True)
    print(f'  index: {out.name} ({out.stat().st_size // 1024} KB)')
    browser.close()
