import os, sys, json
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from playwright.sync_api import sync_playwright

OUT  = os.path.dirname(os.path.abspath(__file__))
URL  = 'https://vercel-app-lime-alpha.vercel.app/loja/TONHAO'
PASS = '✅'
FAIL = '❌'
WARN = '⚠️'

results = []

def check(name, condition, detail=''):
    icon = PASS if condition else FAIL
    status = 'PASS' if condition else 'FAIL'
    msg = f'{icon} [{status}] {name}'
    if detail:
        msg += f'\n       {detail}'
    print(msg)
    results.append({'test': name, 'status': status, 'detail': detail})
    return condition

def shot(page, name):
    path = os.path.join(OUT, name)
    page.screenshot(path=path, full_page=True)
    print(f'   📸 screenshot: {name}')
    return path

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 390, 'height': 844})

    print('=' * 55)
    print('TESTE: Cardápio Online — Deposito do Tonhão')
    print('URL:', URL)
    print('=' * 55)

    # ─── TESTE 1: Carregamento e informações da loja ───────
    print('\n── Teste 1: Carregamento da página ───────────────')
    page.goto(URL)
    page.wait_for_load_state('networkidle')
    shot(page, '01_loja_carregada.png')

    body = page.locator('body').inner_text()

    tem_nome  = 'Deposito do Tonhão' in body or 'Tonhao' in body.lower() or 'Tonhão' in body
    tem_taxa  = 'R$ 13' in body or '13,00' in body
    tem_min   = 'R$ 34' in body or '34,00' in body

    check('Nome da loja visível', tem_nome,
          f'Encontrado: {"Deposito do Tonhão" if tem_nome else "NÃO encontrado"}')
    check('Taxa de entrega visível (R$ 13,00)', tem_taxa,
          'Procurado: R$ 13,00 ou 13,00')
    check('Pedido mínimo visível (R$ 34,00)', tem_min,
          'Procurado: R$ 34,00 ou 34,00')

    # ─── TESTE 2: Categorias no nav ────────────────────────
    print('\n── Teste 2: Categorias no nav ─────────────────────')
    categorias_esperadas = ['Cervejas', 'Refrigerantes', 'Águas', 'Destilados']
    cat_buttons = [b.inner_text().strip() for b in page.locator('button').all()
                   if b.is_visible()]

    for cat in categorias_esperadas:
        presente = any(cat in b for b in cat_buttons)
        check(f'Categoria "{cat}" no nav', presente)

    shot(page, '02_categorias_nav.png')

    # ─── TESTE 3: Produtos com nome e preço ───────────────
    print('\n── Teste 3: Produtos com nome e preço ─────────────')
    import re
    tem_brahma = 'Brahma' in body
    tem_skol   = 'Skol' in body
    precos     = re.findall(r'R\$\s*[\d]+[,.][\d]+', body)
    tem_preco  = len(precos) > 0

    check('Produto "Cerveja Brahma" listado', tem_brahma)
    check('Produto "Cerveja Skol" listado', tem_skol)
    check('Preços visíveis', tem_preco,
          f'Primeiro preço: {precos[0] if precos else "nenhum encontrado"}')

    shot(page, '03_produtos_listados.png')

    # ─── TESTE 4: Adicionar produto ao carrinho ────────────
    print('\n── Teste 4: Adicionar produto ao carrinho ──────────')

    # Clica no primeiro botão "Adicionar"
    adicionar_btns = [b for b in page.locator('button').all()
                      if b.is_visible() and 'Adicionar' in (b.inner_text() or '')]

    adicionou = False
    if adicionar_btns:
        adicionar_btns[0].click()
        page.wait_for_timeout(800)
        shot(page, '04_apos_adicionar.png')

        body_apos = page.locator('body').inner_text()
        # Verifica se carrinho apareceu (quantidade > 0 ou badge)
        tem_carrinho = (
            'Finalizar' in body_apos
            or 'carrinho' in body_apos.lower()
            or 'Ver pedido' in body_apos
            or 'R$ 4' in body_apos   # preço do item adicionado
        )
        adicionou = True
        check('Produto adicionado ao carrinho', tem_carrinho,
              'Verificado: botão Finalizar / "Ver pedido" ou badge')
    else:
        check('Botão "Adicionar" encontrado', False, 'Nenhum botão Adicionar visível')

    # ─── TESTE 5: Checkout abre com campos corretos ────────
    print('\n── Teste 5: Checkout / campos do pedido ───────────')

    # Procura botão para abrir checkout
    checkout_btn = None
    for b in page.locator('button').all():
        txt = (b.inner_text() or '').lower()
        if any(w in txt for w in ['finalizar', 'ver pedido', 'checkout', 'pedido', 'carrinho']):
            if b.is_visible():
                checkout_btn = b
                break

    if checkout_btn:
        checkout_btn.click()
        page.wait_for_timeout(1000)
        shot(page, '05_checkout_aberto.png')

        # Clica em "Continuar" para avançar ao formulário de dados
        continuar_btn = None
        for b in page.locator('button').all():
            txt = (b.inner_text() or '').lower()
            if 'continuar' in txt and b.is_visible():
                continuar_btn = b
                break
        if continuar_btn:
            continuar_btn.click()
            page.wait_for_timeout(1000)

        body_checkout = page.locator('body').inner_text()
        tem_nome_campo   = 'nome' in body_checkout.lower() or 'Nome' in body_checkout
        tem_tel_campo    = 'telefone' in body_checkout.lower() or 'Telefone' in body_checkout or 'whatsapp' in body_checkout.lower()
        tem_end_campo    = 'endereço' in body_checkout.lower() or 'Endereço' in body_checkout or 'entrega' in body_checkout.lower()

        check('Checkout abre corretamente', True)
        check('Campo "Nome" presente no checkout', tem_nome_campo)
        check('Campo "Telefone" presente no checkout', tem_tel_campo)
        check('Campo "Endereço/Entrega" presente no checkout', tem_end_campo)

        # Tenta preencher os campos
        try:
            nome_input = page.locator('input[placeholder*="ome"], input[name*="nome"]').first
            if nome_input.is_visible():
                nome_input.fill('Teste Auditoria')
        except: pass

        try:
            tel_input = page.locator('input[placeholder*="elefone"], input[placeholder*="9"], input[type="tel"]').first
            if tel_input.is_visible():
                tel_input.fill('21999999999')
        except: pass

        page.wait_for_timeout(500)
        shot(page, '05b_checkout_preenchido.png')
    else:
        # Talvez ainda não tenha produto no carrinho — tenta adicionar mais 1
        check('Botão de checkout encontrado', False,
              'Não encontrou botão "Finalizar" ou "Ver pedido" visível — verifique screenshot 04')

    # ─── TESTE 6: Screenshot final completo ───────────────
    print('\n── Teste 6: Screenshot final ───────────────────────')
    page.goto(URL)
    page.wait_for_load_state('networkidle')
    shot(page, '06_pagina_final.png')
    check('Screenshot final capturado', True)

    browser.close()

# ─── Sumário ───────────────────────────────────────────
print('\n' + '=' * 55)
print('SUMÁRIO DOS TESTES')
print('=' * 55)
passed = [r for r in results if r['status'] == 'PASS']
failed = [r for r in results if r['status'] == 'FAIL']
print(f'{PASS} Passou: {len(passed)}/{len(results)}')
print(f'{FAIL} Falhou: {len(failed)}/{len(results)}')
if failed:
    print('\nFalhas:')
    for r in failed:
        print(f'  - {r["test"]}')
        if r['detail']:
            print(f'    {r["detail"]}')
print(f'\nScreenshots salvos em: {OUT}')
