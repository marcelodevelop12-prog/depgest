import Database from 'better-sqlite3'
import path from 'path'

let db: Database.Database

export function initDatabase(dbPath: string): Database.Database {
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = NORMAL')
  createSchema()
  runMigrations()
  return db
}

// Migrações leves para bancos já existentes (ALTER TABLE só roda se a coluna não existir)
function runMigrations() {
  const cols = db.prepare(`PRAGMA table_info(fiado_movimentacoes)`).all() as any[]
  if (!cols.some(c => c.name === 'ciclo_id')) {
    db.exec(`ALTER TABLE fiado_movimentacoes ADD COLUMN ciclo_id INTEGER REFERENCES fiado_ciclos(id)`)
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_fiado_ciclo ON fiado_movimentacoes(ciclo_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_fiado_ciclos_cliente ON fiado_ciclos(cliente_id)`)
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized')
  return db
}

function createSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS licenca (
      id INTEGER PRIMARY KEY,
      chave TEXT NOT NULL,
      machine_id TEXT NOT NULL,
      nome_titular TEXT,
      cnpj TEXT,
      ativa INTEGER DEFAULT 1,
      data_ativacao TEXT,
      data_expiracao TEXT,
      supabase_loja_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS configuracoes (
      id INTEGER PRIMARY KEY,
      chave TEXT UNIQUE NOT NULL,
      valor TEXT
    );

    CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      ordem INTEGER DEFAULT 0,
      ativa INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO categorias (id, nome, ordem) VALUES
      (1, 'Cervejas',     1),
      (2, 'Refrigerantes',2),
      (3, 'Águas',        3),
      (4, 'Sucos',        4),
      (5, 'Vinhos',       5),
      (6, 'Destilados',   6),
      (7, 'Energéticos',  7),
      (8, 'Outros',       8);

    CREATE TABLE IF NOT EXISTS produtos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      marca TEXT,
      ean TEXT,
      categoria_id INTEGER REFERENCES categorias(id),
      fornecedor_id INTEGER,
      foto_path TEXT,
      descricao TEXT,
      estoque_minimo REAL DEFAULT 0,
      localizacao TEXT,
      controle_validade INTEGER DEFAULT 0,
      ativo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS produto_unidades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
      tipo TEXT NOT NULL CHECK(tipo IN ('unidade','fardo','caixa','barril')),
      quantidade_base REAL DEFAULT 1,
      preco_custo REAL DEFAULT 0,
      preco_venda REAL NOT NULL DEFAULT 0,
      ativo INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS produto_validades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
      data_validade TEXT NOT NULL,
      quantidade REAL DEFAULT 0,
      lote TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fornecedores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cnpj TEXT,
      telefone TEXT,
      email TEXT,
      contato TEXT,
      observacoes TEXT,
      ativo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS compras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fornecedor_id INTEGER REFERENCES fornecedores(id),
      numero_nf TEXT,
      data_compra TEXT DEFAULT (date('now')),
      status TEXT DEFAULT 'pendente' CHECK(status IN ('pendente','recebida','cancelada')),
      total REAL DEFAULT 0,
      observacoes TEXT,
      xml_path TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS itens_compra (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      compra_id INTEGER NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
      produto_id INTEGER REFERENCES produtos(id),
      produto_unidade_id INTEGER REFERENCES produto_unidades(id),
      descricao TEXT,
      quantidade REAL NOT NULL,
      preco_unitario REAL NOT NULL,
      total REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS estoque_movimentacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      produto_id INTEGER NOT NULL REFERENCES produtos(id),
      produto_unidade_id INTEGER REFERENCES produto_unidades(id),
      tipo TEXT NOT NULL CHECK(tipo IN ('entrada','saida','ajuste')),
      quantidade REAL NOT NULL,
      saldo_anterior REAL,
      saldo_posterior REAL,
      motivo TEXT,
      referencia_tipo TEXT,
      referencia_id INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cpf TEXT,
      telefone TEXT,
      endereco TEXT,
      bairro TEXT,
      cidade TEXT,
      limite_fiado REAL DEFAULT 0,
      saldo_fiado REAL DEFAULT 0,
      observacoes TEXT,
      ativo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fiado_movimentacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL REFERENCES clientes(id),
      tipo TEXT NOT NULL CHECK(tipo IN ('debito','credito')),
      valor REAL NOT NULL,
      saldo_anterior REAL,
      saldo_posterior REAL,
      descricao TEXT,
      referencia_pedido_id INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fiado_ciclos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL REFERENCES clientes(id),
      numero INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'fechado' CHECK(status IN ('aberto','fechado')),
      saldo_inicial REAL DEFAULT 0,
      total_debitos REAL DEFAULT 0,
      total_creditos REAL DEFAULT 0,
      saldo_final REAL DEFAULT 0,
      aberto_em TEXT,
      fechado_em TEXT DEFAULT (datetime('now')),
      observacao TEXT
    );

    CREATE TABLE IF NOT EXISTS motoboys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      telefone TEXT,
      veiculo TEXT,
      placa TEXT,
      ativo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT UNIQUE NOT NULL,
      cliente_id INTEGER REFERENCES clientes(id),
      cliente_nome TEXT,
      cliente_telefone TEXT,
      cliente_endereco TEXT,
      origem TEXT DEFAULT 'balcao' CHECK(origem IN ('balcao','online')),
      status TEXT DEFAULT 'novo' CHECK(status IN ('novo','separando','a_caminho','entregue','cancelado')),
      forma_pagamento TEXT,
      forma_pagamento2 TEXT,
      valor_pago REAL,
      valor_pago2 REAL,
      subtotal REAL DEFAULT 0,
      desconto REAL DEFAULT 0,
      taxa_entrega REAL DEFAULT 0,
      total REAL DEFAULT 0,
      troco REAL DEFAULT 0,
      observacao TEXT,
      motivo_cancelamento TEXT,
      motoboy_id INTEGER REFERENCES motoboys(id),
      token_rastreio TEXT,
      pedido_online_id TEXT,
      supabase_synced INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS itens_pedido (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
      produto_id INTEGER REFERENCES produtos(id),
      produto_unidade_id INTEGER REFERENCES produto_unidades(id),
      nome TEXT NOT NULL,
      tipo TEXT,
      quantidade REAL NOT NULL,
      preco_unitario REAL NOT NULL,
      desconto REAL DEFAULT 0,
      total REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entregas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
      motoboy_id INTEGER NOT NULL REFERENCES motoboys(id),
      status TEXT DEFAULT 'em_andamento' CHECK(status IN ('em_andamento','entregue','devolvido')),
      saiu_as TEXT,
      entregue_as TEXT,
      observacao TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS caixa_sessoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      valor_inicial REAL DEFAULT 0,
      valor_final REAL,
      abertura TEXT NOT NULL DEFAULT (datetime('now')),
      fechamento TEXT,
      status TEXT DEFAULT 'aberto' CHECK(status IN ('aberto','fechado')),
      operador TEXT,
      observacoes TEXT
    );

    CREATE TABLE IF NOT EXISTS caixa_movimentacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessao_id INTEGER NOT NULL REFERENCES caixa_sessoes(id),
      tipo TEXT NOT NULL CHECK(tipo IN ('entrada','saida','sangria','suprimento')),
      valor REAL NOT NULL,
      descricao TEXT,
      forma_pagamento TEXT,
      referencia_pedido_id INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS financeiro_contas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL CHECK(tipo IN ('pagar','receber')),
      descricao TEXT NOT NULL,
      valor REAL NOT NULL,
      vencimento TEXT,
      pago INTEGER DEFAULT 0,
      data_pagamento TEXT,
      valor_pago REAL,
      categoria TEXT,
      fornecedor_id INTEGER REFERENCES fornecedores(id),
      cliente_id INTEGER REFERENCES clientes(id),
      observacoes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tabela TEXT NOT NULL,
      operacao TEXT NOT NULL,
      referencia_id TEXT,
      status TEXT DEFAULT 'pendente' CHECK(status IN ('pendente','ok','erro')),
      erro TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Índices de performance
    CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos(categoria_id);
    CREATE INDEX IF NOT EXISTS idx_produtos_ean ON produtos(ean);
    CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status);
    CREATE INDEX IF NOT EXISTS idx_pedidos_created ON pedidos(created_at);
    CREATE INDEX IF NOT EXISTS idx_estoque_produto ON estoque_movimentacoes(produto_id);
    CREATE INDEX IF NOT EXISTS idx_fiado_cliente ON fiado_movimentacoes(cliente_id);
    CREATE INDEX IF NOT EXISTS idx_caixa_sessao ON caixa_movimentacoes(sessao_id);

    -- Config padrão
    INSERT OR IGNORE INTO configuracoes (chave, valor) VALUES ('tema', 'dark');
    INSERT OR IGNORE INTO configuracoes (chave, valor) VALUES ('impressora', '');
    INSERT OR IGNORE INTO configuracoes (chave, valor) VALUES ('largura_impressora', '80');
    INSERT OR IGNORE INTO configuracoes (chave, valor) VALUES ('rodape_cupom', 'Obrigado pela preferência!');
    INSERT OR IGNORE INTO configuracoes (chave, valor) VALUES ('pedido_numero_seq', '1');
  `)
}
