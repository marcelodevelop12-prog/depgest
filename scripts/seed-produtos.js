/**
 * Seed de produtos de teste para o depósito de bebidas.
 * Uso (via Electron): npx electron scripts/seed-produtos.js
 * Uso (via Node):     node scripts/seed-produtos.js
 */

const path = require('path')
const os = require('os')

// Quando rodado via Electron, aguarda o app estar pronto e encerra no final
const isElectron = !!process.versions.electron
if (isElectron) {
  const { app } = require('electron')
  app.whenReady().then(() => { runSeed(); app.quit() })
} else {
  runSeed()
}

function runSeed() {

// Localiza o banco SQLite do Electron (mesmo caminho que app.getPath('userData'))
const DB_PATH = path.join(os.homedir(), 'AppData', 'Roaming', 'DepGest', 'depgest.db')

let Database
try {
  Database = require('better-sqlite3')
} catch {
  console.error('Instale o better-sqlite3: npm install better-sqlite3')
  process.exit(1)
}

const db = new Database(DB_PATH)
db.pragma('foreign_keys = ON')

// IDs das categorias já seedadas pelo app
// 1=Cervejas 2=Refrigerantes 3=Águas 4=Sucos 5=Vinhos 6=Destilados 7=Energéticos 8=Outros
const CAT = { cerveja: 1, refri: 2, agua: 3, suco: 4, vinho: 5, destilado: 6, energetico: 7, outros: 8 }

const produtos = [
  // ── CERVEJAS ────────────────────────────────────────────────
  {
    nome: 'Cerveja Brahma Lata 350ml',
    marca: 'Brahma',
    ean: '7891149104531',
    categoria_id: CAT.cerveja,
    estoque_minimo: 24,
    unidades: [
      { tipo: 'unidade',  quantidade_base: 1,  preco_custo: 2.50,  preco_venda: 4.00 },
      { tipo: 'fardo',    quantidade_base: 12, preco_custo: 28.00, preco_venda: 40.00 },
    ],
    estoque_inicial: 120, // unidades
  },
  {
    nome: 'Cerveja Skol Lata 350ml',
    marca: 'Skol',
    ean: '7891149108591',
    categoria_id: CAT.cerveja,
    estoque_minimo: 24,
    unidades: [
      { tipo: 'unidade',  quantidade_base: 1,  preco_custo: 2.40,  preco_venda: 3.90 },
      { tipo: 'fardo',    quantidade_base: 12, preco_custo: 27.00, preco_venda: 39.00 },
    ],
    estoque_inicial: 96,
  },
  {
    nome: 'Cerveja Heineken Long Neck 330ml',
    marca: 'Heineken',
    ean: '8711000010564',
    categoria_id: CAT.cerveja,
    estoque_minimo: 12,
    unidades: [
      { tipo: 'unidade',  quantidade_base: 1,  preco_custo: 4.80,  preco_venda: 8.00 },
      { tipo: 'fardo',    quantidade_base: 6,  preco_custo: 27.00, preco_venda: 42.00 },
    ],
    estoque_inicial: 48,
  },
  {
    nome: 'Cerveja Eisenbahn Weizenbier 500ml',
    marca: 'Eisenbahn',
    ean: '7898286200138',
    categoria_id: CAT.cerveja,
    estoque_minimo: 6,
    unidades: [
      { tipo: 'unidade',  quantidade_base: 1,  preco_custo: 6.50,  preco_venda: 10.00 },
      { tipo: 'caixa',    quantidade_base: 12, preco_custo: 72.00, preco_venda: 108.00 },
    ],
    estoque_inicial: 24,
  },

  // ── REFRIGERANTES ───────────────────────────────────────────
  {
    nome: 'Coca-Cola Lata 350ml',
    marca: 'Coca-Cola',
    ean: '7894900011517',
    categoria_id: CAT.refri,
    estoque_minimo: 24,
    unidades: [
      { tipo: 'unidade',  quantidade_base: 1,  preco_custo: 2.20,  preco_venda: 4.00 },
      { tipo: 'fardo',    quantidade_base: 12, preco_custo: 24.00, preco_venda: 42.00 },
    ],
    estoque_inicial: 72,
  },
  {
    nome: 'Coca-Cola 2L PET',
    marca: 'Coca-Cola',
    ean: '7894900010015',
    categoria_id: CAT.refri,
    estoque_minimo: 12,
    unidades: [
      { tipo: 'unidade',  quantidade_base: 1,  preco_custo: 5.50,  preco_venda: 9.00 },
      { tipo: 'fardo',    quantidade_base: 6,  preco_custo: 31.00, preco_venda: 48.00 },
    ],
    estoque_inicial: 36,
  },
  {
    nome: 'Guaraná Antarctica 2L PET',
    marca: 'Antarctica',
    ean: '7891991010771',
    categoria_id: CAT.refri,
    estoque_minimo: 12,
    unidades: [
      { tipo: 'unidade',  quantidade_base: 1,  preco_custo: 4.80,  preco_venda: 8.00 },
      { tipo: 'fardo',    quantidade_base: 6,  preco_custo: 27.00, preco_venda: 42.00 },
    ],
    estoque_inicial: 36,
  },

  // ── ÁGUAS ───────────────────────────────────────────────────
  {
    nome: 'Água Crystal sem Gás 1,5L',
    marca: 'Crystal',
    ean: '7894900530001',
    categoria_id: CAT.agua,
    estoque_minimo: 24,
    unidades: [
      { tipo: 'unidade',  quantidade_base: 1,  preco_custo: 1.30,  preco_venda: 2.50 },
      { tipo: 'fardo',    quantidade_base: 12, preco_custo: 14.00, preco_venda: 24.00 },
    ],
    estoque_inicial: 72,
  },
  {
    nome: 'Água Tônica Schweppes 350ml',
    marca: 'Schweppes',
    ean: '7894900700176',
    categoria_id: CAT.agua,
    estoque_minimo: 12,
    unidades: [
      { tipo: 'unidade',  quantidade_base: 1,  preco_custo: 2.50,  preco_venda: 4.50 },
      { tipo: 'fardo',    quantidade_base: 12, preco_custo: 28.00, preco_venda: 46.00 },
    ],
    estoque_inicial: 48,
  },

  // ── DESTILADOS ──────────────────────────────────────────────
  {
    nome: 'Cachaça Sagatiba 700ml',
    marca: 'Sagatiba',
    ean: '7896110000121',
    categoria_id: CAT.destilado,
    estoque_minimo: 3,
    unidades: [
      { tipo: 'unidade',  quantidade_base: 1,  preco_custo: 22.00, preco_venda: 38.00 },
      { tipo: 'caixa',    quantidade_base: 12, preco_custo: 250.00, preco_venda: 420.00 },
    ],
    estoque_inicial: 12,
  },
  {
    nome: 'Vodka Smirnoff 998ml',
    marca: 'Smirnoff',
    ean: '5000067522019',
    categoria_id: CAT.destilado,
    estoque_minimo: 3,
    unidades: [
      { tipo: 'unidade',  quantidade_base: 1,  preco_custo: 35.00, preco_venda: 58.00 },
      { tipo: 'caixa',    quantidade_base: 12, preco_custo: 396.00, preco_venda: 648.00 },
    ],
    estoque_inicial: 6,
  },
  {
    nome: 'Whisky Red Label 1L',
    marca: 'Johnnie Walker',
    ean: '5000267023656',
    categoria_id: CAT.destilado,
    estoque_minimo: 2,
    unidades: [
      { tipo: 'unidade',  quantidade_base: 1,  preco_custo: 65.00, preco_venda: 99.00 },
      { tipo: 'caixa',    quantidade_base: 12, preco_custo: 720.00, preco_venda: 1080.00 },
    ],
    estoque_inicial: 6,
  },
]

// ── Executa a inserção ───────────────────────────────────────

const insertProduto = db.prepare(`
  INSERT OR IGNORE INTO produtos (nome, marca, ean, categoria_id, estoque_minimo, ativo)
  VALUES (@nome, @marca, @ean, @categoria_id, @estoque_minimo, 1)
`)

const insertUnidade = db.prepare(`
  INSERT INTO produto_unidades (produto_id, tipo, quantidade_base, preco_custo, preco_venda, ativo)
  VALUES (@produto_id, @tipo, @quantidade_base, @preco_custo, @preco_venda, 1)
`)

const insertEstoque = db.prepare(`
  INSERT INTO estoque_movimentacoes
    (produto_id, produto_unidade_id, tipo, quantidade, saldo_anterior, saldo_posterior, motivo)
  VALUES (@produto_id, @unidade_id, 'entrada', @quantidade, 0, @quantidade, 'Estoque inicial (seed)')
`)

const run = db.transaction(() => {
  let produtosInseridos = 0
  let unidadesInseridas = 0

  for (const p of produtos) {
    // Verifica se já existe pelo EAN
    const existente = db.prepare('SELECT id FROM produtos WHERE ean = ?').get(p.ean)
    if (existente) {
      console.log(`  ⚠  Já existe: ${p.nome} (EAN ${p.ean}) — pulando`)
      continue
    }

    const res = insertProduto.run({ nome: p.nome, marca: p.marca, ean: p.ean, categoria_id: p.categoria_id, estoque_minimo: p.estoque_minimo })
    const produtoId = res.lastInsertRowid
    produtosInseridos++

    for (const u of p.unidades) {
      const ur = insertUnidade.run({ produto_id: produtoId, ...u })
      const unidadeId = ur.lastInsertRowid
      unidadesInseridas++

      // Adiciona estoque inicial apenas na unidade base (tipo 'unidade')
      if (u.tipo === 'unidade') {
        insertEstoque.run({ produto_id: produtoId, unidade_id: unidadeId, quantidade: p.estoque_inicial })
      }
    }

    console.log(`  ✓  ${p.nome} — ${p.unidades.length} unidade(s), estoque: ${p.estoque_inicial}`)
  }

  console.log(`\n  Produtos inseridos : ${produtosInseridos}`)
  console.log(`  Unidades inseridas : ${unidadesInseridas}`)
})

console.log(`\nBanco: ${DB_PATH}\n`)
try {
  run()
  console.log('\n✅ Seed concluído!\n')
} catch (err) {
  console.error('\n❌ Erro:', err.message)
  process.exit(1)
}
} // fim runSeed()
