import { ipcMain } from 'electron'
import { getDb } from '../database'

export function registerEstoqueHandlers() {
  ipcMain.handle('estoque:get-saldo', (_, produtoId?: number) => {
    const db = getDb()
    if (produtoId) {
      const row = db.prepare(`
        SELECT produto_id,
          SUM(CASE WHEN tipo = 'entrada' THEN quantidade
                   WHEN tipo = 'saida' THEN -quantidade
                   ELSE quantidade END) as estoque_atual
        FROM estoque_movimentacoes
        WHERE produto_id = ?
        GROUP BY produto_id
      `).get(produtoId) as any
      return row?.estoque_atual ?? 0
    }

    return db.prepare(`
      SELECT p.id, p.nome, p.estoque_minimo,
        COALESCE(c.nome, '') as categoria,
        COALESCE(SUM(CASE WHEN em.tipo = 'entrada' THEN em.quantidade
                          WHEN em.tipo = 'saida' THEN -em.quantidade
                          ELSE em.quantidade END), 0) as estoque_atual
      FROM produtos p
      LEFT JOIN categorias c ON c.id = p.categoria_id
      LEFT JOIN estoque_movimentacoes em ON em.produto_id = p.id
      WHERE p.ativo = 1
      GROUP BY p.id
      ORDER BY p.nome
    `).all()
  })

  ipcMain.handle('estoque:movimentar', (_, data: any) => {
    const db = getDb()

    const saldoAtual: any = db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN quantidade
                               WHEN tipo = 'saida' THEN -quantidade
                               ELSE quantidade END), 0) as saldo
      FROM estoque_movimentacoes WHERE produto_id = ?
    `).get(data.produto_id)

    const saldoAnterior = saldoAtual?.saldo ?? 0
    const saldoPosterior = data.tipo === 'saida'
      ? saldoAnterior - data.quantidade
      : saldoAnterior + data.quantidade

    const result = db.prepare(`
      INSERT INTO estoque_movimentacoes
        (produto_id, produto_unidade_id, tipo, quantidade, saldo_anterior, saldo_posterior, motivo, referencia_tipo, referencia_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.produto_id, data.produto_unidade_id || null, data.tipo, data.quantidade,
      saldoAnterior, saldoPosterior, data.motivo || null, data.referencia_tipo || null, data.referencia_id || null
    )

    return { id: result.lastInsertRowid, saldo: saldoPosterior }
  })

  ipcMain.handle('estoque:list-movimentacoes', (_, filters: any = {}) => {
    const db = getDb()
    let sql = `
      SELECT em.*, p.nome as produto_nome
      FROM estoque_movimentacoes em
      JOIN produtos p ON p.id = em.produto_id
      WHERE 1=1
    `
    const params: any[] = []

    if (filters.produto_id) { sql += ' AND em.produto_id = ?'; params.push(filters.produto_id) }
    if (filters.tipo) { sql += ' AND em.tipo = ?'; params.push(filters.tipo) }
    if (filters.data_inicio) { sql += ' AND em.created_at >= ?'; params.push(filters.data_inicio) }
    if (filters.data_fim) { sql += ' AND em.created_at <= ?'; params.push(filters.data_fim) }

    sql += ' ORDER BY em.created_at DESC'
    if (filters.limit) { sql += ` LIMIT ${filters.limit}` }

    return db.prepare(sql).all(...params)
  })

  ipcMain.handle('estoque:alertas', () => {
    const db = getDb()
    return db.prepare(`
      SELECT p.id, p.nome, p.estoque_minimo,
        COALESCE(SUM(CASE WHEN em.tipo = 'entrada' THEN em.quantidade
                          WHEN em.tipo = 'saida' THEN -em.quantidade
                          ELSE em.quantidade END), 0) as saldo
      FROM produtos p
      LEFT JOIN estoque_movimentacoes em ON em.produto_id = p.id
      WHERE p.ativo = 1
      GROUP BY p.id
      HAVING saldo <= p.estoque_minimo AND p.estoque_minimo > 0
      ORDER BY saldo ASC
    `).all()
  })
}
