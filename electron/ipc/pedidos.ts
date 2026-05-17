import { ipcMain } from 'electron'
import { getDb } from '../database'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import crypto from 'crypto'

const supabase = createClient(
  'https://vxrhlljvjqdbpfngpzro.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4cmhsbGp2anFkYnBmbmdwenJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NzQ1MDAsImV4cCI6MjA5NDQ1MDUwMH0.UTzP5lf2x7GnEw8nsuoe_qnywe-JpO1ApDtfS1RLjD0',
  { realtime: { transport: ws as any } }
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
        json_group_array(json_object('nome', ip.nome, 'quantidade', ip.quantidade, 'preco_unitario', ip.preco_unitario)) as itens
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
    console.log('[aceitar-online] iniciando, id:', pedidoOnlineId)

    try {
      // 1. Busca o pedido no Supabase
      const { data: online, error: fetchErr } = await supabase
        .from('pedidos_online')
        .select('*')
        .eq('id', pedidoOnlineId)
        .single()

      if (fetchErr) {
        console.error('[aceitar-online] erro ao buscar pedido_online:', fetchErr.message)
        return { ok: false, erro: `Erro ao buscar pedido: ${fetchErr.message}` }
      }
      if (!online) return { ok: false, erro: 'Pedido não encontrado no Supabase' }

      console.log('[aceitar-online] pedido online carregado:', {
        cliente: online.cliente_nome,
        total: online.total,
        itens: Array.isArray(online.itens) ? online.itens.length : typeof online.itens,
        token: online.token_rastreio,
      })

      // 2. Garante que itens é um array
      const onlineItens: any[] = Array.isArray(online.itens) ? online.itens : []

      // 3. Resolve produto_local_id: items do cardápio têm produto_id (UUID de cardapio_produtos)
      const prodUuids = [...new Set(onlineItens.map((i: any) => i.produto_id).filter(Boolean))]
      const localIdMap: Record<string, number> = {}

      if (prodUuids.length > 0) {
        const { data: mapa, error: mapaErr } = await supabase
          .from('cardapio_produtos')
          .select('id, produto_local_id')
          .in('id', prodUuids)
        if (mapaErr) console.error('[aceitar-online] erro ao buscar mapa de produtos:', mapaErr.message)
        for (const row of mapa || []) {
          if (row.produto_local_id) localIdMap[row.id] = row.produto_local_id
        }
      }

      console.log('[aceitar-online] localIdMap:', localIdMap)

      const itens = onlineItens.map((i: any) => ({
        produto_id: localIdMap[i.produto_id] || i.produto_local_id || null,
        produto_unidade_id: null as number | null,
        nome: i.nome,
        tipo: i.tipo || 'unidade',
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario ?? i.preco ?? 0,
        total: i.total,
      }))

      const numero = gerarNumero()
      const token = online.token_rastreio
      const total = online.total ?? 0
      const formaPagamento = online.forma_pagamento || 'pix'

      console.log('[aceitar-online] iniciando transação SQLite, numero:', numero)

      // 4. Transação: cliente + pedido + itens + estoque + caixa + fiado
      const tx = db.transaction(() => {
        // ── Resolve cliente_id ────────────────────────────────────────────
        let clienteId: number | null = null
        const telefone = online.cliente_telefone?.replace(/\D/g, '') || null
        if (telefone) {
          const existente = db.prepare(
            "SELECT id FROM clientes WHERE replace(replace(replace(telefone,' ',''),'-',''),'(','') LIKE ?"
          ).get(`%${telefone}%`) as any
          if (existente) {
            clienteId = existente.id
          } else {
            const novo = db.prepare(
              'INSERT INTO clientes (nome, telefone, ativo) VALUES (?, ?, 1)'
            ).run(online.cliente_nome || 'Cliente Online', online.cliente_telefone)
            clienteId = novo.lastInsertRowid as number
            console.log('[aceitar-online] cliente criado, id:', clienteId)
          }
        }

        // ── INSERT pedido ─────────────────────────────────────────────────
        const result = db.prepare(`
          INSERT INTO pedidos (numero, cliente_id, cliente_nome, cliente_telefone, cliente_endereco,
            origem, status, forma_pagamento, subtotal, desconto, taxa_entrega, total, valor_pago,
            troco, observacao, token_rastreio, pedido_online_id)
          VALUES (?, ?, ?, ?, ?, 'online', 'novo', ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          numero,
          clienteId,
          online.cliente_nome || null,
          online.cliente_telefone || null,
          online.cliente_endereco || null,
          formaPagamento,
          online.subtotal ?? total,
          online.taxa_entrega ?? 0,
          total,
          total,
          online.troco_para ? online.troco_para - total : 0,
          online.observacao || null,
          token || null,
          pedidoOnlineId,
        )

        const pedidoId = result.lastInsertRowid as number
        console.log('[aceitar-online] pedido inserido, id:', pedidoId)

        // ── Itens + estoque ───────────────────────────────────────────────
        for (const item of itens) {
          db.prepare(`
            INSERT INTO itens_pedido (pedido_id, produto_id, produto_unidade_id, nome, tipo, quantidade, preco_unitario, desconto, total)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
          `).run(
            pedidoId, item.produto_id ?? null, item.produto_unidade_id ?? null,
            item.nome, item.tipo, item.quantidade, item.preco_unitario, item.total,
          )

          if (item.produto_id) {
            const saldoRow = db.prepare(`
              SELECT COALESCE(SUM(CASE WHEN tipo='entrada' THEN quantidade ELSE -quantidade END), 0) as s
              FROM estoque_movimentacoes WHERE produto_id = ?
            `).get(item.produto_id) as any
            const s = saldoRow?.s ?? 0

            db.prepare(`
              INSERT INTO estoque_movimentacoes
                (produto_id, produto_unidade_id, tipo, quantidade, saldo_anterior, saldo_posterior, motivo, referencia_tipo, referencia_id)
              VALUES (?, ?, 'saida', ?, ?, ?, 'Venda Online', 'pedido', ?)
            `).run(
              item.produto_id, item.produto_unidade_id ?? null,
              item.quantidade, s, s - item.quantidade, pedidoId,
            )
          }
        }

        // ── Caixa ─────────────────────────────────────────────────────────
        const sessao = db.prepare("SELECT id FROM caixa_sessoes WHERE status = 'aberto' LIMIT 1").get() as any
        if (sessao && formaPagamento !== 'fiado') {
          db.prepare(`
            INSERT INTO caixa_movimentacoes (sessao_id, tipo, valor, descricao, forma_pagamento, referencia_pedido_id)
            VALUES (?, 'entrada', ?, ?, ?, ?)
          `).run(sessao.id, total, `Venda Online #${numero}`, formaPagamento, pedidoId)
        }

        // ── Fiado ─────────────────────────────────────────────────────────
        if (formaPagamento === 'fiado' && clienteId) {
          const cliente = db.prepare('SELECT saldo_fiado FROM clientes WHERE id = ?').get(clienteId) as any
          const saldoAnt = cliente?.saldo_fiado ?? 0
          const saldoPost = saldoAnt + total
          db.prepare(`
            INSERT INTO fiado_movimentacoes (cliente_id, tipo, valor, saldo_anterior, saldo_posterior, descricao, referencia_pedido_id)
            VALUES (?, 'debito', ?, ?, ?, 'Venda Online fiado', ?)
          `).run(clienteId, total, saldoAnt, saldoPost, pedidoId)
          db.prepare('UPDATE clientes SET saldo_fiado = ? WHERE id = ?').run(saldoPost, clienteId)
          console.log('[aceitar-online] fiado registrado, cliente_id:', clienteId, 'saldo:', saldoPost)
        }

        return pedidoId
      })

      const pedidoId = tx()
      console.log('[aceitar-online] transação concluída, pedido_id:', pedidoId)

      // 5. Sync Supabase em background
      supabase.from('pedidos_online').update({ sincronizado: true }).eq('id', pedidoOnlineId).then(() => {})
      syncPedidoSupabase(pedidoId).catch(e => console.error('[aceitar-online] syncPedidoSupabase erro:', e?.message))

      return { ok: true, pedido_id: pedidoId, numero }
    } catch (e: any) {
      console.error('[aceitar-online] ERRO INESPERADO:', e?.message)
      console.error('[aceitar-online] stack:', e?.stack)
      return { ok: false, erro: e?.message || 'Erro desconhecido ao aceitar pedido' }
    }
  })

  ipcMain.handle('pedidos:imprimir', (_, id: number) => {
    // Impressão via electron-pos-printer
    return true
  })
}
