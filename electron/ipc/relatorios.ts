import { ipcMain } from 'electron'
import { getDb } from '../database'

export function registerRelatorioHandlers() {
  ipcMain.handle('relatorios:vendas', (_, filters: any) => {
    const db = getDb()
    const { inicio, fim } = filters

    const totalPorDia = db.prepare(`
      SELECT date(created_at) as data, COUNT(*) as pedidos, SUM(total) as total
      FROM pedidos WHERE status != 'cancelado' AND date(created_at) BETWEEN date(?) AND date(?)
      GROUP BY date(created_at) ORDER BY data
    `).all(inicio, fim)

    const porFormaPagamento = db.prepare(`
      SELECT forma_pagamento, COUNT(*) as pedidos, SUM(total) as total
      FROM pedidos WHERE status != 'cancelado' AND date(created_at) BETWEEN date(?) AND date(?)
      GROUP BY forma_pagamento
    `).all(inicio, fim)

    const topProdutos = db.prepare(`
      SELECT ip.nome, SUM(ip.quantidade) as quantidade, SUM(ip.total) as total
      FROM itens_pedido ip
      JOIN pedidos p ON p.id = ip.pedido_id
      WHERE p.status != 'cancelado' AND date(p.created_at) BETWEEN date(?) AND date(?)
      GROUP BY ip.nome ORDER BY total DESC LIMIT 20
    `).all(inicio, fim)

    const porOrigem = db.prepare(`
      SELECT origem, COUNT(*) as pedidos, SUM(total) as total
      FROM pedidos WHERE status != 'cancelado' AND date(created_at) BETWEEN date(?) AND date(?)
      GROUP BY origem
    `).all(inicio, fim)

    const totais = db.prepare(`
      SELECT COUNT(*) as total_pedidos, SUM(total) as total_vendas,
        AVG(total) as ticket_medio
      FROM pedidos WHERE status != 'cancelado' AND date(created_at) BETWEEN date(?) AND date(?)
    `).get(inicio, fim) as any

    return { totalPorDia, porFormaPagamento, topProdutos, porOrigem, totais }
  })

  ipcMain.handle('relatorios:estoque', (_, filters: any = {}) => {
    const db = getDb()

    const produtos = db.prepare(`
      SELECT p.id, p.nome, p.estoque_minimo,
        COALESCE(SUM(CASE WHEN em.tipo='entrada' THEN em.quantidade
                          WHEN em.tipo='saida' THEN -em.quantidade
                          ELSE em.quantidade END), 0) as saldo
      FROM produtos p
      LEFT JOIN estoque_movimentacoes em ON em.produto_id = p.id
      WHERE p.ativo = 1
      GROUP BY p.id
      ORDER BY p.nome
    `).all()

    const parados = db.prepare(`
      SELECT p.id, p.nome, MAX(em.created_at) as ultima_movimentacao
      FROM produtos p
      LEFT JOIN estoque_movimentacoes em ON em.produto_id = p.id
      WHERE p.ativo = 1
      GROUP BY p.id
      HAVING ultima_movimentacao < date('now', '-30 days') OR ultima_movimentacao IS NULL
      ORDER BY ultima_movimentacao ASC NULLS FIRST
      LIMIT 20
    `).all()

    return { produtos, parados }
  })

  ipcMain.handle('relatorios:clientes', (_, filters: any = {}) => {
    const db = getDb()

    const maioresCompradores = db.prepare(`
      SELECT c.id, c.nome, c.telefone, COUNT(p.id) as total_pedidos, SUM(p.total) as total_compras
      FROM clientes c
      JOIN pedidos p ON p.cliente_id = c.id
      WHERE p.status != 'cancelado'
      GROUP BY c.id
      ORDER BY total_compras DESC LIMIT 20
    `).all()

    const inadimplentes = db.prepare(`
      SELECT * FROM clientes WHERE saldo_fiado > 0 ORDER BY saldo_fiado DESC LIMIT 20
    `).all()

    const inativos = db.prepare(`
      SELECT c.id, c.nome, c.telefone, MAX(p.created_at) as ultima_compra
      FROM clientes c
      LEFT JOIN pedidos p ON p.cliente_id = c.id
      GROUP BY c.id
      HAVING ultima_compra < date('now', '-60 days') OR ultima_compra IS NULL
      ORDER BY ultima_compra ASC NULLS FIRST LIMIT 20
    `).all()

    return { maioresCompradores, inadimplentes, inativos }
  })

  ipcMain.handle('relatorios:entregas', (_, filters: any = {}) => {
    const db = getDb()
    const { inicio, fim } = filters

    const porMotoboy = db.prepare(`
      SELECT m.id, m.nome, COUNT(e.id) as total_entregas,
        SUM(CASE WHEN e.status = 'entregue' THEN 1 ELSE 0 END) as entregues
      FROM motoboys m
      LEFT JOIN entregas e ON e.motoboy_id = m.id
      ${inicio ? 'WHERE date(e.created_at) BETWEEN date(?) AND date(?)' : ''}
      GROUP BY m.id ORDER BY total_entregas DESC
    `).all(...(inicio ? [inicio, fim] : []))

    return { porMotoboy }
  })

  ipcMain.handle('relatorios:export-pdf', async (_, tipo: string, data: unknown) => {
    return { ok: true, message: 'Export PDF em desenvolvimento' }
  })

  ipcMain.handle('relatorios:export-excel', async (_, tipo: string, data: unknown) => {
    return { ok: true, message: 'Export Excel em desenvolvimento' }
  })
}
