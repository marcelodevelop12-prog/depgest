import { ipcMain } from 'electron'
import { getDb } from '../database'
import { XMLParser } from 'fast-xml-parser'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import https from 'https'

const supabase = createClient(
  'https://vxrhlljvjqdbpfngpzro.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4cmhsbGp2anFkYnBmbmdwenJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NzQ1MDAsImV4cCI6MjA5NDQ1MDUwMH0.UTzP5lf2x7GnEw8nsuoe_qnywe-JpO1ApDtfS1RLjD0',
  { realtime: { transport: ws as any } }
)

export function registerProdutoHandlers() {
  ipcMain.handle('produtos:list', (_, filters: any = {}) => {
    const db = getDb()
    let sql = `
      SELECT p.*, c.nome as categoria_nome,
        (SELECT SUM(em.quantidade * CASE WHEN em.tipo = 'entrada' THEN 1
                                         WHEN em.tipo = 'saida' THEN -1
                                         ELSE 1 END)
         FROM estoque_movimentacoes em WHERE em.produto_id = p.id) as saldo_estoque
      FROM produtos p
      LEFT JOIN categorias c ON c.id = p.categoria_id
      WHERE 1=1
    `
    const params: any[] = []

    if (filters.busca) {
      sql += ' AND (p.nome LIKE ? OR p.ean LIKE ? OR p.marca LIKE ?)'
      params.push(`%${filters.busca}%`, `%${filters.busca}%`, `%${filters.busca}%`)
    }
    if (filters.categoria_id) {
      sql += ' AND p.categoria_id = ?'
      params.push(filters.categoria_id)
    }
    if (filters.ativo !== undefined) {
      sql += ' AND p.ativo = ?'
      params.push(filters.ativo ? 1 : 0)
    }

    sql += ' ORDER BY p.nome'
    return db.prepare(sql).all(...params)
  })

  ipcMain.handle('produtos:get', (_, id: number) => {
    const db = getDb()
    const produto = db.prepare('SELECT * FROM produtos WHERE id = ?').get(id)
    const unidades = db.prepare('SELECT * FROM produto_unidades WHERE produto_id = ?').all(id)
    const validades = db.prepare('SELECT * FROM produto_validades WHERE produto_id = ? ORDER BY data_validade').all(id)
    return { ...produto as any, unidades, validades }
  })

  ipcMain.handle('produtos:create', (_, data: any) => {
    const db = getDb()
    const { unidades, validades, ...produto } = data

    const result = db.prepare(`
      INSERT INTO produtos (nome, marca, ean, categoria_id, fornecedor_id, foto_path, descricao,
        estoque_minimo, localizacao, controle_validade, ativo)
      VALUES (@nome, @marca, @ean, @categoria_id, @fornecedor_id, @foto_path, @descricao,
        @estoque_minimo, @localizacao, @controle_validade, @ativo)
    `).run({
      nome: produto.nome,
      marca: produto.marca || null,
      ean: produto.ean || null,
      categoria_id: produto.categoria_id || null,
      fornecedor_id: produto.fornecedor_id || null,
      foto_path: produto.foto_path || null,
      descricao: produto.descricao || null,
      estoque_minimo: produto.estoque_minimo || 0,
      localizacao: produto.localizacao || null,
      controle_validade: produto.controle_validade ? 1 : 0,
      ativo: 1,
    })

    const produtoId = result.lastInsertRowid as number

    if (unidades?.length) {
      saveUnidades(db, produtoId, unidades)
    }

    const estoqueInicial = Number(data.estoque_inicial) || 0
    if (estoqueInicial > 0) {
      db.prepare(`
        INSERT INTO estoque_movimentacoes
          (produto_id, tipo, quantidade, saldo_anterior, saldo_posterior, motivo)
        VALUES (?, 'entrada', ?, 0, ?, 'Estoque inicial')
      `).run(produtoId, estoqueInicial, estoqueInicial)
    }

    return { id: produtoId }
  })

  ipcMain.handle('produtos:update', (_, id: number, data: any) => {
    const db = getDb()
    const { unidades, validades, ...produto } = data

    db.prepare(`
      UPDATE produtos SET nome=@nome, marca=@marca, ean=@ean, categoria_id=@categoria_id,
        fornecedor_id=@fornecedor_id, foto_path=@foto_path, descricao=@descricao,
        estoque_minimo=@estoque_minimo, localizacao=@localizacao,
        controle_validade=@controle_validade, ativo=@ativo,
        updated_at=datetime('now')
      WHERE id=@id
    `).run({ ...produto, id, controle_validade: produto.controle_validade ? 1 : 0, ativo: produto.ativo !== false ? 1 : 0 })

    if (unidades) {
      saveUnidades(db, id, unidades)
    }

    return true
  })

  ipcMain.handle('produtos:delete', (_, id: number) => {
    const db = getDb()
    db.prepare('UPDATE produtos SET ativo = 0 WHERE id = ?').run(id)
    return true
  })

  ipcMain.handle('produtos:list-unidades', (_, produtoId: number) => {
    const db = getDb()
    return db.prepare('SELECT * FROM produto_unidades WHERE produto_id = ? AND ativo = 1').all(produtoId)
  })

  ipcMain.handle('produtos:save-unidades', (_, produtoId: number, unidades: any[]) => {
    const db = getDb()
    saveUnidades(db, produtoId, unidades)
    return true
  })

  ipcMain.handle('categorias:list', () => {
    const db = getDb()
    return db.prepare('SELECT * FROM categorias WHERE ativa = 1 ORDER BY ordem, nome').all()
  })

  ipcMain.handle('categorias:create', (_, data: any) => {
    const db = getDb()
    const result = db.prepare('INSERT INTO categorias (nome, ordem) VALUES (?, ?)').run(data.nome, data.ordem || 0)
    return { id: result.lastInsertRowid }
  })

  ipcMain.handle('categorias:update', (_, id: number, data: any) => {
    const db = getDb()
    db.prepare('UPDATE categorias SET nome=?, ordem=?, ativa=? WHERE id=?')
      .run(data.nome, data.ordem || 0, data.ativa !== false ? 1 : 0, id)
    return true
  })

  ipcMain.handle('categorias:delete', (_, id: number) => {
    const db = getDb()
    db.prepare('UPDATE categorias SET ativa = 0 WHERE id = ?').run(id)
    return true
  })

  ipcMain.handle('produtos:import-xml', async (_, xmlPath: string) => {
    const db = getDb()
    const xmlContent = fs.readFileSync(xmlPath, 'utf-8')
    const parser = new XMLParser({ ignoreAttributes: false })
    const parsed = parser.parse(xmlContent)

    const nfe = parsed?.nfeProc?.NFe?.infNFe || parsed?.NFe?.infNFe
    if (!nfe) return { ok: false, erro: 'Arquivo XML inválido ou não é uma NF-e' }

    const det = Array.isArray(nfe.det) ? nfe.det : [nfe.det]
    const preview: any[] = []

    for (const item of det) {
      const prod = item.prod
      const ean = prod.cEAN !== 'SEM GTIN' ? prod.cEAN : null
      const existente = ean
        ? db.prepare('SELECT * FROM produtos WHERE ean = ?').get(ean)
        : db.prepare('SELECT * FROM produtos WHERE nome LIKE ?').get(`%${prod.xProd}%`)

      preview.push({
        nome: prod.xProd,
        ean,
        quantidade: parseFloat(prod.qCom),
        preco_unitario: parseFloat(prod.vUnCom),
        existente: existente || null,
      })
    }

    return { ok: true, preview, emitente: nfe.emit }
  })

  ipcMain.handle('produtos:consulta-ean', async (_, ean: string) => {
    return new Promise((resolve) => {
      const url = `https://api.cosmos.bluesoft.com.br/gtins/${ean}`
      const req = https.get(url, {
        headers: { 'X-Cosmos-Token': 'seu-token-aqui', 'User-Agent': 'DepGest/1.0' }
      }, (res) => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          try {
            resolve({ ok: true, data: JSON.parse(data) })
          } catch {
            resolve({ ok: false })
          }
        })
      })
      req.on('error', () => resolve({ ok: false }))
      req.setTimeout(5000, () => { req.destroy(); resolve({ ok: false }) })
    })
  })

  ipcMain.handle('produtos:sync-cardapio', async (_, produtoIds: number[]) => {
    // Sync to Supabase cardapio_produtos
    return { ok: true }
  })
}

function saveUnidades(db: any, produtoId: number, unidades: any[]) {
  db.prepare('DELETE FROM produto_unidades WHERE produto_id = ?').run(produtoId)
  const stmt = db.prepare(`
    INSERT INTO produto_unidades (produto_id, tipo, quantidade_base, preco_custo, preco_venda, ativo)
    VALUES (?, ?, ?, ?, ?, 1)
  `)
  for (const u of unidades) {
    stmt.run(produtoId, u.tipo, u.quantidade_base || 1, u.preco_custo || 0, u.preco_venda || 0)
  }
}
