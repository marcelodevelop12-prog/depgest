import { ipcMain } from 'electron'
import { getDb } from '../database'

export function registerClienteHandlers() {
  ipcMain.handle('clientes:list', (_, filters: any = {}) => {
    const db = getDb()
    let sql = `
      SELECT c.*,
        COALESCE((SELECT SUM(p.total) FROM pedidos p
                  WHERE p.cliente_id = c.id AND p.status != 'cancelado'), 0) as total_compras
      FROM clientes c WHERE 1=1`
    const params: any[] = []

    if (filters.busca) {
      sql += ' AND (nome LIKE ? OR cpf LIKE ? OR telefone LIKE ?)'
      params.push(`%${filters.busca}%`, `%${filters.busca}%`, `%${filters.busca}%`)
    }
    if (filters.com_fiado) {
      sql += ' AND saldo_fiado > 0'
    }
    if (filters.ativo !== undefined) {
      sql += ' AND ativo = ?'
      params.push(filters.ativo ? 1 : 0)
    }

    sql += ' ORDER BY nome'
    return db.prepare(sql).all(...params)
  })

  ipcMain.handle('clientes:get', (_, id: number) => {
    const db = getDb()
    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(id)
    const totalCompras = db.prepare(`
      SELECT COUNT(*) as total, SUM(total) as valor
      FROM pedidos WHERE cliente_id = ? AND status != 'cancelado'
    `).get(id) as any
    return { ...cliente as any, total_compras: totalCompras?.total, valor_total_compras: totalCompras?.valor }
  })

  ipcMain.handle('clientes:create', (_, data: any) => {
    const db = getDb()
    const result = db.prepare(`
      INSERT INTO clientes (nome, cpf, telefone, endereco, bairro, cidade, limite_fiado, observacoes)
      VALUES (@nome, @cpf, @telefone, @endereco, @bairro, @cidade, @limite_fiado, @observacoes)
    `).run({
      nome: data.nome, cpf: data.cpf || null, telefone: data.telefone || null,
      endereco: data.endereco || null, bairro: data.bairro || null, cidade: data.cidade || null,
      limite_fiado: data.limite_fiado || 0, observacoes: data.observacoes || null
    })
    return { id: result.lastInsertRowid }
  })

  ipcMain.handle('clientes:update', (_, id: number, data: any) => {
    const db = getDb()
    db.prepare(`
      UPDATE clientes SET nome=@nome, cpf=@cpf, telefone=@telefone, endereco=@endereco,
        bairro=@bairro, cidade=@cidade, limite_fiado=@limite_fiado, observacoes=@observacoes,
        ativo=@ativo, updated_at=datetime('now')
      WHERE id=@id
    `).run({ ...data, id, ativo: data.ativo !== false ? 1 : 0 })
    return true
  })

  ipcMain.handle('clientes:delete', (_, id: number) => {
    const db = getDb()
    db.prepare('UPDATE clientes SET ativo = 0 WHERE id = ?').run(id)
    return true
  })

  ipcMain.handle('clientes:get-fiado', (_, clienteId: number) => {
    const db = getDb()
    const cliente = db.prepare('SELECT saldo_fiado, limite_fiado FROM clientes WHERE id = ?').get(clienteId) as any
    // Apenas a "página atual" do caderno: movimentações ainda não fechadas em um ciclo
    const movimentacoes = db.prepare(`
      SELECT fm.*, p.numero as pedido_numero
      FROM fiado_movimentacoes fm
      LEFT JOIN pedidos p ON p.id = fm.referencia_pedido_id
      WHERE fm.cliente_id = ? AND fm.ciclo_id IS NULL
      ORDER BY fm.created_at DESC
      LIMIT 50
    `).all(clienteId)
    return { saldo: cliente?.saldo_fiado || 0, limite: cliente?.limite_fiado || 0, movimentacoes }
  })

  // Fecha o ciclo atual ("vira a página do caderno"): arquiva as movimentações abertas,
  // registra a receita recebida no Financeiro e abre uma página nova (transportando saldo se houver).
  ipcMain.handle('clientes:fechar-ciclo', (_, data: any) => {
    const db = getDb()
    const clienteId = data.cliente_id

    const movs = db.prepare(`
      SELECT * FROM fiado_movimentacoes
      WHERE cliente_id = ? AND ciclo_id IS NULL
      ORDER BY created_at ASC, id ASC
    `).all(clienteId) as any[]

    if (movs.length === 0) throw new Error('Não há movimentações para fechar')

    const totalDebitos = movs.filter(m => m.tipo === 'debito').reduce((s, m) => s + m.valor, 0)
    const totalCreditos = movs.filter(m => m.tipo === 'credito').reduce((s, m) => s + m.valor, 0)
    const saldoInicial = movs[0].saldo_anterior ?? 0
    const saldoFinal = movs[movs.length - 1].saldo_posterior ?? 0

    const cliente = db.prepare('SELECT nome FROM clientes WHERE id = ?').get(clienteId) as any
    const ultimo = db.prepare('SELECT MAX(numero) as n FROM fiado_ciclos WHERE cliente_id = ?').get(clienteId) as any
    const numero = (ultimo?.n || 0) + 1

    // Fechar = o cliente acertou a conta. O total recebido inclui o acerto final (saldo que faltava).
    const creditosTotais = totalCreditos + (saldoFinal > 0 ? saldoFinal : 0)

    const tx = db.transaction(() => {
      // Se ainda havia saldo devedor, registra o acerto final que quita a conta
      if (saldoFinal > 0) {
        db.prepare(`
          INSERT INTO fiado_movimentacoes
            (cliente_id, tipo, valor, saldo_anterior, saldo_posterior, descricao, ciclo_id)
          VALUES (?, 'credito', ?, ?, 0, 'Acerto da conta no fechamento', NULL)
        `).run(clienteId, saldoFinal, saldoFinal)
      }

      const result = db.prepare(`
        INSERT INTO fiado_ciclos
          (cliente_id, numero, status, saldo_inicial, total_debitos, total_creditos, saldo_final, aberto_em, fechado_em, observacao)
        VALUES (?, ?, 'fechado', ?, ?, ?, 0, ?, datetime('now'), ?)
      `).run(clienteId, numero, saldoInicial, totalDebitos, creditosTotais, movs[0].created_at || null, data.observacao || null)
      const cicloId = result.lastInsertRowid

      // arquiva todas as movimentações (inclusive o acerto final) nesse ciclo
      db.prepare('UPDATE fiado_movimentacoes SET ciclo_id = ? WHERE cliente_id = ? AND ciclo_id IS NULL').run(cicloId, clienteId)

      // lança no financeiro o total recebido neste ciclo (receita já paga)
      if (creditosTotais > 0) {
        db.prepare(`
          INSERT INTO financeiro_contas
            (tipo, descricao, valor, vencimento, pago, data_pagamento, valor_pago, categoria, cliente_id, observacoes)
          VALUES ('receber', ?, ?, date('now'), 1, date('now'), ?, 'Fiado', ?, ?)
        `).run(
          `Fechamento fiado #${numero} - ${cliente?.nome || 'Cliente'}`,
          creditosTotais, creditosTotais, clienteId, `Ciclo ${numero} (compras ${totalDebitos.toFixed(2)})`
        )
      }

      // conta quitada: nova página começa do zero
      db.prepare('UPDATE clientes SET saldo_fiado = 0 WHERE id = ?').run(clienteId)
    })
    tx()
    return { numero, total_debitos: totalDebitos, total_creditos: creditosTotais, saldo_final: 0 }
  })

  ipcMain.handle('clientes:list-ciclos', (_, clienteId: number) => {
    const db = getDb()
    return db.prepare('SELECT * FROM fiado_ciclos WHERE cliente_id = ? ORDER BY numero DESC').all(clienteId)
  })

  ipcMain.handle('clientes:ciclo-movimentacoes', (_, cicloId: number) => {
    const db = getDb()
    return db.prepare(`
      SELECT fm.*, p.numero as pedido_numero
      FROM fiado_movimentacoes fm
      LEFT JOIN pedidos p ON p.id = fm.referencia_pedido_id
      WHERE fm.ciclo_id = ?
      ORDER BY fm.created_at ASC, fm.id ASC
    `).all(cicloId)
  })

  ipcMain.handle('clientes:lancar-fiado', (_, data: any) => {
    const db = getDb()
    const cliente = db.prepare('SELECT saldo_fiado FROM clientes WHERE id = ?').get(data.cliente_id) as any
    const saldoAnterior = cliente?.saldo_fiado || 0
    const saldoPosterior = saldoAnterior + data.valor

    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO fiado_movimentacoes (cliente_id, tipo, valor, saldo_anterior, saldo_posterior, descricao, referencia_pedido_id)
        VALUES (?, 'debito', ?, ?, ?, ?, ?)
      `).run(data.cliente_id, data.valor, saldoAnterior, saldoPosterior, data.descricao || 'Compra fiado', data.pedido_id || null)

      db.prepare('UPDATE clientes SET saldo_fiado = ? WHERE id = ?').run(saldoPosterior, data.cliente_id)
    })
    tx()
    return { saldo: saldoPosterior }
  })

  ipcMain.handle('clientes:pagar-fiado', (_, data: any) => {
    const db = getDb()
    const cliente = db.prepare('SELECT saldo_fiado FROM clientes WHERE id = ?').get(data.cliente_id) as any
    const saldoAnterior = cliente?.saldo_fiado || 0
    const saldoPosterior = Math.max(0, saldoAnterior - data.valor)

    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO fiado_movimentacoes (cliente_id, tipo, valor, saldo_anterior, saldo_posterior, descricao)
        VALUES (?, 'credito', ?, ?, ?, ?)
      `).run(data.cliente_id, data.valor, saldoAnterior, saldoPosterior, data.descricao || 'Pagamento fiado')

      db.prepare('UPDATE clientes SET saldo_fiado = ? WHERE id = ?').run(saldoPosterior, data.cliente_id)
    })
    tx()
    return { saldo: saldoPosterior }
  })

  ipcMain.handle('clientes:extrato', (_, clienteId: number, periodo: any = {}) => {
    const db = getDb()
    let sql = `
      SELECT fm.*, p.numero as pedido_numero
      FROM fiado_movimentacoes fm
      LEFT JOIN pedidos p ON p.id = fm.referencia_pedido_id
      WHERE fm.cliente_id = ?
    `
    const params: any[] = [clienteId]
    if (periodo.inicio) { sql += ' AND date(fm.created_at) >= date(?)'; params.push(periodo.inicio) }
    if (periodo.fim) { sql += ' AND date(fm.created_at) <= date(?)'; params.push(periodo.fim) }
    sql += ' ORDER BY fm.created_at DESC'
    return db.prepare(sql).all(...params)
  })
}
