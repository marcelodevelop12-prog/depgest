import os, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from playwright.sync_api import sync_playwright

OUT = os.path.dirname(os.path.abspath(__file__))
URL = 'https://vercel-app-lime-alpha.vercel.app/loja/TONHAO'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 390, 'height': 844})  # mobile (cardápio é mobile-first)

    print(f'Navegando para {URL}')
    page.goto(URL)
    page.wait_for_load_state('networkidle')

    page.screenshot(path=os.path.join(OUT, '00_page_loaded.png'), full_page=True)
    print('Screenshot 00_page_loaded.png salvo')

    # Extrai texto visível e botões
    title = page.title()
    print(f'Título da página: {title}')

    body_text = page.locator('body').inner_text()
    lines = [l.strip() for l in body_text.split('\n') if l.strip()][:60]
    print('--- Primeiras linhas do body ---')
    for l in lines:
        print(' ', l)

    # Identifica botões
    buttons = page.locator('button').all()
    print(f'\n--- Botões encontrados: {len(buttons)} ---')
    for b in buttons[:20]:
        try:
            print(f'  [{b.inner_text().strip()[:60]}]')
        except:
            pass

    browser.close()
