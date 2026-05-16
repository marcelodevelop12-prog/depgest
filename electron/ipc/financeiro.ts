import { ipcMain } from 'electron'
import { getDb } from '../database'

export function registerFinanceiroHandlers() {
  ipcMain.handle('financeiro:list-contas', (_, filters: any = {}) => {
    const db = getDb()
    let sql = `
      SELECT fc.*, f.nome as fornecedor_nome, c.nome as cliente_nome
      FROM financeiro_contas fc
      LEFT JOIN fornecedores f ON f.id = fc.fornecedor_id
      LEFT JOIN clientes c ON c.id = fc.cliente_id
      WHERE 1=1
    `
    const params: any[] = []
    if (filters.tipo) { sql += ' AND fc.tipo = ?'; params.push(filters.tipo) }
    if (filters.pago !== undefined) { sql += ' AND fc.pago = ?'; params.push(filters.pago ? 1 : 0) }
    if (filters.vencimento_ate) { sql += ' AND fc.vencimento <= ?'; params.push(filters.vencimento_ate) }
    sql += ' ORDER BY fc.vencimento ASC NULLS LAST'
    return db.prepare(sql).all(...params)
  })

  ipcMain.handle('financeiro:create-conta', (_, data: any) => {
    const db = getDb()
    const result = db.prepare(`
      INSERT INTO financeiro_contas (tipo, descricao, valor, vencimento, categoria, fornecedor_id, cliente_id, observacoes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(data.tipo, data.descricao, data.valor, data.vencimento || null,
      data.categoria || null, data.fornecedor_id || null, data.cliente_id || null, data.observacoes || null)
    return { id: result.lastInsertRowid }
  })

  ipcMain.handle('financeiro:pagar-conta', (_, id: number, data: any) => {
    const db = getDb()
    db.prepare(`
      UPDATE financeiro_contas SET pago = 1, data_pagamento = ?, valor_pago = ? WHERE id = ?
    `).run(data.data_pagamento || new Date().toISOString().split('T')[0], data.valor_pago, id)
    return true
  })

  ipcMain.handle('financeiro:get-fluxo', (_, periodo: any) => {
    const db = getDb()
    const entradas = db.prepare(`
      SELECT date(cm.created_at) as data, SUM(cm.valor) as total
      FROM caixa_movimentacoes cm
      JOIN caixa_sessoes cs ON cs.id = cm.sessao_id
      WHERE cm.tipo = 'entrada' AND cm.created_at BETWEEN ? AND ?
      GROUP BY date(cm.created_at)
      ORDER BY data
    `).all(periodo.inicio, periodo.fim)

    const saidas = db.prepare(`
      SELECT date(created_at) as data, SUM(valor) as total
      FROM financeiro_contas
      WHERE tipo = 'pagar' AND pago = 1 AND data_pagamento BETWEEN ? AND ?
      GROUP BY data ORDER BY data
    `).all(periodo.inicio, periodo.fim)

    const fiadoRecebido = db.prepare(`
      SELECT date(created_at) as data, SUM(valor) as total
      FROM fiado_movimentacoes
      WHERE tipo = 'credito' AND created_at BETWEEN ? AND ?
      GROUP BY data ORDER BY data
    `).all(periodo.inicio, periodo.fim)

    return { entradas, saidas, fiadoRecebido }
  })

  ipcMain.handle('financeiro:get-dre', (_, periodo: any) => {
    const db = getDb()

    const receitas = db.prepare(`
      SELECT SUM(cm.valor) as total
      FROM caixa_movimentacoes cm
      WHERE cm.tipo = 'entrada' AND cm.created_at BETWEEN ? AND ?
    `).get(periodo.inicio, periodo.fim) as any

    const custos = db.prepare(`
      SELECT SUM(ic.total) as total
      FROM itens_compra ic
      JOIN compras c ON c.id = ic.compra_id
      WHERE c.status = 'recebida' AND c.data_compra BETWEEN ? AND ?
    `).get(periodo.inicio, periodo.fim) as any

    const despesas = db.prepare(`
      SELECT SUM(valor_pago) as total FROM financeiro_contas
      WHERE tipo = 'pagar' AND pago = 1 AND data_pagamento BETWEEN ? AND ?
    `).get(periodo.inicio, periodo.fim) as any

    const receitaBruta = receitas?.total || 0
    const cmv = custos?.total || 0
    const lucrobruto = receitaBruta - cmv
    const totalDespesas = despesas?.total || 0
    const lucroLiquido = lucrobruto - totalDespesas

    return { receitaBruta, cmv, lucrobruto, totalDespesas, lucroLiquido, margem: receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : 0 }
  })
}
