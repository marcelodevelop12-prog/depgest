import { ipcMain } from 'electron'
import { getDb } from '../database'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  'https://vxrhlljvjqdbpfngpzro.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4cmhsbGp2anFkYnBmbmdwenJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NzQ1MDAsImV4cCI6MjA5NDQ1MDUwMH0.UTzP5lf2x7GnEw8nsuoe_qnywe-JpO1ApDtfS1RLjD0'
)

function gerarNumero(): string {
  const db = getDb()
  const row = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'pedido_numero_seq'").get() as any
  const seq = parseInt(row?.valor || '1')
  db.prepare("INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES ('pedido_numero_seq', ?)").run(String(seq + 1))
  return String(seq).padStart(6, '0')
}

function gerarToken(): string {
  return crypto.randomBytes(8).toString('hex').toUpperCase()
}

async function syncPedidoSupabase(pedidoId: number) {
  const db = getDb()
  const licenca = db.prepare('SELECT * FROM licenca LIMIT 1').get() as any
  if (!licenca?.supabase_loja_id) return

  const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(pedidoId) as any
  const itens = db.prepare('SELECT * FROM itens_pedido WHERE pedido_id = ?').all(pedidoId) as any[]

  const itensResumo = itens.map(i => ({ nome: i.nome, quantidade: i.quantidade, total: i.total }))

  const payload = {
    token: pedido.token_rastreio,
    loja_id: licenca.supabase_loja_id,
    pedido_local_id: pedidoId,
    cliente_nome: pedido.cliente_nome || 'Cliente',
    cliente_telefone: pedido.cliente_telefone || '',
    itens_resumo: itensResumo,
    total: pedido.total,
    status: pedido.status,
    motoboy_nome: null as string | null,
    origem: pedido.origem,
    observacao: pedido.observacao || '',
    motivo_cancelamento: pedido.motivo_cancelamento || null,
  }

  if (pedido.motoboy_id) {
    const motoboy = db.prepare('SELECT nome FROM motoboys WHERE id = ?').get(pedido.motoboy_id) as any
    payload.motoboy_nome = motoboy?.nome || null
  }

  await supabase.from('pedidos_rastreio').upsert(payload, { onConflict: 'token' })
  db.prepare('UPDATE pedidos SET supabase_synced = 1 WHERE id = ?').run(pedidoId)
}

export function registerPedidoHandlers() {
  ipcMain.handle('pedidos:list', (_, filters: any = {}) => {
    const db = getDb()
    let sql = `
      SELECT p.*, c.nome as cliente_nome_cadastro, m.nome as motoboy_nome,
        GROUP_CONCAT(ip.nome || ' x' || ip.quantidade, ' | ') as itens_resumo
      FROM pedidos p
      LEFT JOIN clientes c ON c.id = p.cliente_id
      LEFT JOIN motoboys m ON m.id = p.motoboy_id
      LEFT JOIN itens_pedido ip ON ip.pedido_id = p.id
      WHERE 1=1
    `
    const params: any[] = []

    if (filters.status && filters.status !== 'todos') {
      sql += ' AND p.status = ?'
      params.push(filters.status)
    }
    if (filters.data) {
      sql += ' AND date(p.created_at) = ?'
      params.push(filters.data)
    }
    if (filters.origem) {
      sql += ' AND p.origem = ?'
      params.push(filters.origem)
    }

    sql += ' GROUP BY p.id ORDER BY p.created_at DESC'
    if (filters.limit) sql += ` LIMIT ${filters.limit}`

    return db.prepare(sql).all(...params)
  })

  ipcMain.handle('pedidos:get', (_, id: number) => {
    const db = getDb()
    const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id)
    const itens = db.prepare('SELECT ip.*, pu.tipo FROM itens_pedido ip LEFT JOIN produto_unidades pu ON pu.id = ip.produto_unidade_id WHERE ip.pedido_id = ?').all(id)
    return { ...pedido as any, itens }
  })

  ipcMain.handle('pedidos:create', async (_, data: any) => {
    const db = getDb()
    const numero = gerarNumero()
    const token = gerarToken()

    const tx = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO pedidos (numero, cliente_id, cliente_nome, cliente_telefone, cliente_endereco,
          origem, status, forma_pagamento, forma_pagamento2, valor_pago, valor_pago2,
          subtotal, desconto, taxa_entrega, total, troco, observacao, token_rastreio, pedido_online_id)
        VALUES (@numero, @cliente_id, @cliente_nome, @cliente_telefone, @cliente_endereco,
          @origem, 'novo', @forma_pagamento, @forma_pagamento2, @valor_pago, @valor_pago2,
          @subtotal, @desconto, @taxa_entrega, @total, @troco, @observacao, @token, @pedido_online_id)
      `).run({
        numero, token,
        cliente_id: data.cliente_id || null,
        cliente_nome: data.cliente_nome || null,
        cliente_telefone: data.cliente_telefone || null,
        cliente_endereco: data.cliente_endereco || null,
        origem: data.origem || 'balcao',
        forma_pagamento: data.forma_pagamento,
        forma_pagamento2: data.forma_pagamento2 || null,
        valor_pago: data.valor_pago || data.total,
        valor_pago2: data.valor_pago2 || null,
        subtotal: data.subtotal,
        desconto: data.desconto || 0,
        taxa_entrega: data.taxa_entrega || 0,
        total: data.total,
        troco: data.troco || 0,
        observacao: data.observacao || null,
        pedido_online_id: data.pedido_online_id || null,
      })

      const pedidoId = result.lastInsertRowid as number

      // Insere itens e baixa estoque
      for (const item of data.itens) {
        db.prepare(`
          INSERT INTO itens_pedido (pedido_id, produto_id, produto_unidade_id, nome, tipo, quantidade, preco_unitario, desconto, total)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(pedidoId, item.produto_id, item.produto_unidade_id || null, item.nome,
          item.tipo || 'unidade', item.quantidade, item.preco_unitario, item.desconto || 0, item.total)

        if (item.produto_id) {
          const saldoRow = db.prepare(`
            SELECT COALESCE(SUM(CASE WHEN tipo='entrada' THEN quantidade ELSE -quantidade END), 0) as s
            FROM estoque_movimentacoes WHERE produto_id = ?
          `).get(item.produto_id) as any

          db.prepare(`
            INSERT INTO estoque_movimentacoes (produto_id, produto_unidade_id, tipo, quantidade, saldo_anterior, saldo_posterior, motivo, referencia_tipo, referencia_id)
            VALUES (?, ?, 'saida', ?, ?, ?, 'Venda PDV', 'pedido', ?)
          `).run(item.produto_id, item.produto_unidade_id || null, item.quantidade,
            saldoRow.s, saldoRow.s - item.quantidade, pedidoId)
        }
      }

      // Fiado
      if (data.forma_pagamento === 'fiado' && data.cliente_id) {
        const cliente = db.prepare('SELECT saldo_fiado FROM clientes WHERE id = ?').get(data.cliente_id) as any
        const saldoAnt = cliente?.saldo_fiado || 0
        const saldoPost = saldoAnt + data.total
        db.prepare(`INSERT INTO fiado_movimentacoes (cliente_id, tipo, valor, saldo_anterior, saldo_posterior, descricao, referencia_pedido_id) VALUES (?, 'debito', ?, ?, ?, 'Venda fiado', ?)`).run(data.cliente_id, data.total, saldoAnt, saldoPost, pedidoId)
        db.prepare('UPDATE clientes SET saldo_fiado = ? WHERE id = ?').run(saldoPost, data.cliente_id)
      }

      // Caixa
      const sessao = db.prepare("SELECT id FROM caixa_sessoes WHERE status = 'aberto' LIMIT 1").get() as any
      if (sessao && data.forma_pagamento !== 'fiado') {
        db.prepare(`
          INSERT INTO caixa_movimentacoes (sessao_id, tipo, valor, descricao, forma_pagamento, referencia_pedido_id)
          VALUES (?, 'entrada', ?, ?, ?, ?)
        `).run(sessao.id, data.total, `Venda #${numero}`, data.forma_pagamento, pedidoId)
      }

      return pedidoId
    })

    const pedidoId = tx()
    // Sync Supabase em background
    syncPedidoSupabase(pedidoId).catch(() => {})

    return { id: pedidoId, numero, token }
  })

  ipcMain.handle('pedidos:update-status', async (_, id: number, status: string, extra: any = {}) => {
    const db = getDb()
    const updates: any = { status, updated_at: "datetime('now')" }

    if (extra.motoboy_id) {
      db.prepare('UPDATE pedidos SET status = ?, motoboy_id = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .run(status, extra.motoboy_id, id)

      // Registra entrega
      db.prepare(`INSERT INTO entregas (pedido_id, motoboy_id, saiu_as) VALUES (?, ?, datetime('now'))`)
        .run(id, extra.motoboy_id)
    } else if (status === 'entregue') {
      db.prepare(`UPDATE pedidos SET status = 'entregue', updated_at = datetime('now') WHERE id = ?`).run(id)
      db.prepare(`UPDATE entregas SET status = 'entregue', entregue_as = datetime('now') WHERE pedido_id = ? AND status = 'em_andamento'`).run(id)
    } else {
      db.prepare(`UPDATE pedidos SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, id)
    }

    syncPedidoSupabase(id).catch(() => {})
    return true
  })

  ipcMain.handle('pedidos:cancel', async (_, id: number, motivo: string) => {
    const db = getDb()
    db.prepare(`UPDATE pedidos SET status = 'cancelado', motivo_cancelamento = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(motivo, id)
    syncPedidoSupabase(id).catch(() => {})
    return true
  })

  ipcMain.handle('pedidos:get-token', (_, id: number) => {
    const db = getDb()
    const pedido = db.prepare('SELECT token_rastreio FROM pedidos WHERE id = ?').get(id) as any
    return pedido?.token_rastreio
  })

  ipcMain.handle('pedidos:get-online', async () => {
    const licenca = getDb().prepare('SELECT * FROM licenca LIMIT 1').get() as any
    if (!licenca?.supabase_loja_id) return []

    const { data } = await supabase
      .from('pedidos_online')
      .select('*')
      .eq('loja_id', licenca.supabase_loja_id)
      .eq('sincronizado', false)
      .in('status', ['novo'])
      .order('created_at', { ascending: false })

    return data || []
  })

  ipcMain.handle('pedidos:aceitar-online', async (_, pedidoOnlineId: string) => {
    const db = getDb()
    const { data: online } = await supabase
      .from('pedidos_online')
      .select('*')
      .eq('id', pedidoOnlineId)
      .single()

    if (!online) return { ok: false, erro: 'Pedido não encontrado' }

    const itens = (online.itens as any[]).map(i => ({
      produto_id: i.produto_local_id || null,
      produto_unidade_id: i.unidade_id || null,
      nome: i.nome,
      tipo: i.tipo || 'unidade',
      quantidade: i.quantidade,
      preco_unitario: i.preco_unitario,
      desconto: 0,
      total: i.total,
    }))

    const pedidoData = {
      cliente_nome: online.cliente_nome,
      cliente_telefone: online.cliente_telefone,
      cliente_endereco: online.cliente_endereco,
      origem: 'online',
      forma_pagamento: online.forma_pagamento,
      subtotal: online.subtotal,
      desconto: 0,
      taxa_entrega: online.taxa_entrega,
      total: online.total,
      troco: online.troco_para ? online.troco_para - online.total : 0,
      observacao: online.observacao,
      pedido_online_id: pedidoOnlineId,
      itens,
    }

    // Cria pedido local via o mesmo handler
    const numero = gerarNumero()
    const token = online.token_rastreio

    // ... simplified creation
    const result = db.prepare(`
      INSERT INTO pedidos (numero, cliente_nome, cliente_telefone, cliente_endereco, origem, status,
        forma_pagamento, subtotal, taxa_entrega, total, troco, observacao, token_rastreio, pedido_online_id)
      VALUES (?, ?, ?, ?, 'online', 'novo', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(numero, online.cliente_nome, online.cliente_telefone, online.cliente_endereco,
      online.forma_pagamento, online.subtotal, online.taxa_entrega, online.total,
      online.troco_para ? online.troco_para - online.total : 0, online.observacao, token, pedidoOnlineId)

    const pedidoId = result.lastInsertRowid as number

    await supabase.from('pedidos_online').update({ sincronizado: true }).eq('id', pedidoOnlineId)
    await syncPedidoSupabase(pedidoId)

    return { ok: true, pedido_id: pedidoId, numero }
  })

  ipcMain.handle('pedidos:imprimir', (_, id: number) => {
    // Impressão via electron-pos-printer
    return true
  })
}
