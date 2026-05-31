import { ipcMain } from 'electron'
import { getDb } from '../database'
import { XMLParser } from 'fast-xml-parser'
import fs from 'fs'

export function registerFornecedorHandlers() {
  ipcMain.handle('fornecedores:list', () => {
    const db = getDb()
    return db.prepare('SELECT * FROM fornecedores WHERE ativo = 1 ORDER BY nome').all()
  })

  ipcMain.handle('fornecedores:get', (_, id: number) => {
    const db = getDb()
    const fornecedor = db.prepare('SELECT * FROM fornecedores WHERE id = ?').get(id)
    const compras = db.prepare(`
      SELECT c.*, COUNT(ic.id) as total_itens
      FROM compras c LEFT JOIN itens_compra ic ON ic.compra_id = c.id
      WHERE c.fornecedor_id = ? AND c.status != 'cancelada'
      GROUP BY c.id ORDER BY c.created_at DESC LIMIT 20
    `).all(id)
    return { ...fornecedor as any, compras }
  })

  ipcMain.handle('fornecedores:create', (_, data: any) => {
    const db = getDb()
    const result = db.prepare(`
      INSERT INTO fornecedores (nome, cnpj, telefone, email, contato, observacoes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(data.nome, data.cnpj || null, data.telefone || null, data.email || null, data.contato || null, data.observacoes || null)
    return { id: result.lastInsertRowid }
  })

  ipcMain.handle('fornecedores:update', (_, id: number, data: any) => {
    const db = getDb()
    db.prepare('UPDATE fornecedores SET nome=?, cnpj=?, telefone=?, email=?, contato=?, observacoes=?, ativo=? WHERE id=?')
      .run(data.nome, data.cnpj || null, data.telefone || null, data.email || null,
        data.contato || null, data.observacoes || null, data.ativo !== false ? 1 : 0, id)
    return true
  })

  ipcMain.handle('fornecedores:delete', (_, id: number) => {
    const db = getDb()
    db.prepare('UPDATE fornecedores SET ativo = 0 WHERE id = ?').run(id)
    return true
  })

  ipcMain.handle('compras:list', (_, filters: any = {}) => {
    const db = getDb()
    let sql = `
      SELECT c.*, f.nome as fornecedor_nome, COUNT(ic.id) as total_itens
      FROM compras c
      LEFT JOIN fornecedores f ON f.id = c.fornecedor_id
      LEFT JOIN itens_compra ic ON ic.compra_id = c.id
      WHERE 1=1
    `
    const params: any[] = []
    if (filters.status) { sql += ' AND c.status = ?'; params.push(filters.status) }
    if (filters.fornecedor_id) { sql += ' AND c.fornecedor_id = ?'; params.push(filters.fornecedor_id) }
    sql += ' GROUP BY c.id ORDER BY c.created_at DESC'
    return db.prepare(sql).all(...params)
  })

  ipcMain.handle('compras:get', (_, id: number) => {
    const db = getDb()
    const compra = db.prepare('SELECT c.*, f.nome as fornecedor_nome FROM compras c LEFT JOIN fornecedores f ON f.id = c.fornecedor_id WHERE c.id = ?').get(id)
    const itens = db.prepare('SELECT ic.*, p.nome as produto_nome FROM itens_compra ic LEFT JOIN produtos p ON p.id = ic.produto_id WHERE ic.compra_id = ?').all(id)
    return { ...compra as any, itens }
  })

  ipcMain.handle('compras:create', (_, data: any) => {
    const db = getDb()
    const tx = db.transaction(() => {
      // Resolve o fornecedor: usa o informado ou cria/vincula pelo CNPJ do emitente (import XML)
      let fornecedorId: number | null = data.fornecedor_id || null
      const emit = data.emitente
      if (!fornecedorId && emit && (emit.cnpj || emit.nome)) {
        const cnpjLimpo = emit.cnpj ? String(emit.cnpj).replace(/\D/g, '') : null
        let existente: any = null
        if (cnpjLimpo) {
          existente = db.prepare("SELECT id FROM fornecedores WHERE REPLACE(REPLACE(REPLACE(COALESCE(cnpj,''),'.',''),'/',''),'-','') = ?").get(cnpjLimpo)
        }
        if (!existente && emit.nome) {
          existente = db.prepare('SELECT id FROM fornecedores WHERE nome = ?').get(emit.nome)
        }
        if (existente?.id) {
          fornecedorId = existente.id
        } else {
          const novo = db.prepare('INSERT INTO fornecedores (nome, cnpj) VALUES (?, ?)')
            .run(emit.nome || 'Fornecedor (NF-e)', emit.cnpj || null)
          fornecedorId = novo.lastInsertRowid as number
        }
      }

      const result = db.prepare(`
        INSERT INTO compras (fornecedor_id, numero_nf, data_compra, total, observacoes)
        VALUES (?, ?, ?, ?, ?)
      `).run(fornecedorId, data.numero_nf || null, data.data_compra || new Date().toISOString().split('T')[0], data.total || 0, data.observacoes || null)

      const compraId = result.lastInsertRowid as number

      for (const item of data.itens || []) {
        db.prepare(`
          INSERT INTO itens_compra (compra_id, produto_id, produto_unidade_id, descricao, quantidade, preco_unitario, total)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(compraId, item.produto_id || null, item.produto_unidade_id || null,
          item.descricao || null, item.quantidade, item.preco_unitario, item.total)
      }

      return compraId
    })
    return { id: tx() }
  })

  ipcMain.handle('compras:receber', (_, id: number) => {
    const db = getDb()
    const compra = db.prepare('SELECT * FROM compras WHERE id = ?').get(id) as any
    const itens = db.prepare('SELECT * FROM itens_compra WHERE compra_id = ?').all(id) as any[]

    const tx = db.transaction(() => {
      db.prepare("UPDATE compras SET status = 'recebida' WHERE id = ?").run(id)

      for (const item of itens) {
        if (!item.produto_id) continue
        const saldoRow = db.prepare(`
          SELECT COALESCE(SUM(CASE WHEN tipo='entrada' THEN quantidade ELSE -quantidade END), 0) as s
          FROM estoque_movimentacoes WHERE produto_id = ?
        `).get(item.produto_id) as any

        db.prepare(`
          INSERT INTO estoque_movimentacoes (produto_id, tipo, quantidade, saldo_anterior, saldo_posterior, motivo, referencia_tipo, referencia_id)
          VALUES (?, 'entrada', ?, ?, ?, 'Compra recebida', 'compra', ?)
        `).run(item.produto_id, item.quantidade, saldoRow.s, saldoRow.s + item.quantidade, id)

        if (item.produto_unidade_id) {
          db.prepare('UPDATE produto_unidades SET preco_custo = ? WHERE id = ?')
            .run(item.preco_unitario, item.produto_unidade_id)
        }
      }
    })
    tx()
    return true
  })

  ipcMain.handle('compras:cancel', (_, id: number) => {
    const db = getDb()
    db.prepare("UPDATE compras SET status = 'cancelada' WHERE id = ?").run(id)
    return true
  })

  ipcMain.handle('compras:import-xml', async (_, xmlPath: string) => {
    const xmlContent = fs.readFileSync(xmlPath, 'utf-8')
    const parser = new XMLParser({ ignoreAttributes: false })
    const parsed = parser.parse(xmlContent)
    const nfe = parsed?.nfeProc?.NFe?.infNFe || parsed?.NFe?.infNFe
    if (!nfe) return { ok: false, erro: 'XML inválido' }

    const det = Array.isArray(nfe.det) ? nfe.det : [nfe.det]
    const db = getDb()

    const itens = det.map((item: any) => {
      const prod = item.prod
      const ean = prod.cEAN !== 'SEM GTIN' ? prod.cEAN : null
      const existente = ean
        ? db.prepare('SELECT id, nome FROM produtos WHERE ean = ?').get(ean)
        : null

      return {
        ean,
        descricao: prod.xProd,
        produto_id: (existente as any)?.id || null,
        produto_nome: (existente as any)?.nome || null,
        quantidade: parseFloat(prod.qCom),
        preco_unitario: parseFloat(prod.vUnCom),
        total: parseFloat(prod.vProd),
      }
    })

    return {
      ok: true,
      emitente: { nome: nfe.emit?.xNome, cnpj: nfe.emit?.CNPJ },
      numero_nf: nfe.ide?.nNF,
      total: parseFloat(nfe.total?.ICMSTot?.vNF || '0'),
      itens,
    }
  })
}
