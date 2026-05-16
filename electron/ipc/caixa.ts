import { ipcMain } from 'electron'
import { getDb } from '../database'

export function registerCaixaHandlers() {
  ipcMain.handle('caixa:get-sessao-ativa', () => {
    const db = getDb()
    const sessao = db.prepare("SELECT * FROM caixa_sessoes WHERE status = 'aberto' ORDER BY id DESC LIMIT 1").get() as any
    if (!sessao) return null

    const resumo = db.prepare(`
      SELECT forma_pagamento, SUM(valor) as total
      FROM caixa_movimentacoes
      WHERE sessao_id = ? AND tipo = 'entrada'
      GROUP BY forma_pagamento
    `).all(sessao.id)

    const sangrias = db.prepare(`
      SELECT SUM(valor) as total FROM caixa_movimentacoes
      WHERE sessao_id = ? AND tipo = 'sangria'
    `).get(sessao.id) as any

    const suprimentos = db.prepare(`
      SELECT SUM(valor) as total FROM caixa_movimentacoes
      WHERE sessao_id = ? AND tipo = 'suprimento'
    `).get(sessao.id) as any

    return {
      ...sessao,
      resumo_pagamentos: resumo,
      total_sangrias: sangrias?.total || 0,
      total_suprimentos: suprimentos?.total || 0,
    }
  })

  ipcMain.handle('caixa:abrir', (_, valorInicial: number) => {
    const db = getDb()
    const sessaoAtiva = db.prepare("SELECT id FROM caixa_sessoes WHERE status = 'aberto'").get()
    if (sessaoAtiva) return { ok: false, erro: 'Já existe um caixa aberto' }

    const result = db.prepare(`
      INSERT INTO caixa_sessoes (valor_inicial, abertura, status) VALUES (?, datetime('now'), 'aberto')
    `).run(valorInicial)

    return { ok: true, id: result.lastInsertRowid }
  })

  ipcMain.handle('caixa:fechar', (_, data: any) => {
    const db = getDb()
    const sessao = db.prepare("SELECT id FROM caixa_sessoes WHERE status = 'aberto' LIMIT 1").get() as any
    if (!sessao) return { ok: false, erro: 'Nenhum caixa aberto' }

    db.prepare(`
      UPDATE caixa_sessoes SET status = 'fechado', fechamento = datetime('now'), valor_final = ?, observacoes = ?
      WHERE id = ?
    `).run(data.valor_final || 0, data.observacoes || null, sessao.id)

    return { ok: true }
  })

  ipcMain.handle('caixa:movimentar', (_, data: any) => {
    const db = getDb()
    const sessao = db.prepare("SELECT id FROM caixa_sessoes WHERE status = 'aberto' LIMIT 1").get() as any
    if (!sessao) return { ok: false, erro: 'Nenhum caixa aberto' }

    db.prepare(`
      INSERT INTO caixa_movimentacoes (sessao_id, tipo, valor, descricao, forma_pagamento)
      VALUES (?, ?, ?, ?, ?)
    `).run(sessao.id, data.tipo, data.valor, data.descricao, data.forma_pagamento || null)

    return { ok: true }
  })

  ipcMain.handle('caixa:get-resumo', () => {
    const db = getDb()
    const sessao = db.prepare("SELECT * FROM caixa_sessoes WHERE status = 'aberto' LIMIT 1").get() as any
    if (!sessao) return null

    const entradas = db.prepare(`
      SELECT forma_pagamento, SUM(valor) as total
      FROM caixa_movimentacoes WHERE sessao_id = ? AND tipo = 'entrada'
      GROUP BY forma_pagamento
    `).all(sessao.id) as any[]

    const saidas = db.prepare(`
      SELECT SUM(valor) as total FROM caixa_movimentacoes
      WHERE sessao_id = ? AND tipo IN ('saida', 'sangria')
    `).get(sessao.id) as any

    const totalEntradas = entradas.reduce((s, e) => s + e.total, 0)

    return {
      sessao,
      entradas,
      total_entradas: totalEntradas,
      total_saidas: saidas?.total || 0,
      saldo_esperado: sessao.valor_inicial + totalEntradas - (saidas?.total || 0),
    }
  })

  ipcMain.handle('caixa:get-historico', (_, filters: any = {}) => {
    const db = getDb()
    return db.prepare(`
      SELECT * FROM caixa_sessoes ORDER BY abertura DESC LIMIT 30
    `).all()
  })
}
