import { ipcMain } from 'electron'
import { getDb } from '../database'

export function registerClienteHandlers() {
  ipcMain.handle('clientes:list', (_, filters: any = {}) => {
    const db = getDb()
    let sql = `SELECT * FROM clientes WHERE 1=1`
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
    const movimentacoes = db.prepare(`
      SELECT fm.*, p.numero as pedido_numero
      FROM fiado_movimentacoes fm
      LEFT JOIN pedidos p ON p.id = fm.referencia_pedido_id
      WHERE fm.cliente_id = ?
      ORDER BY fm.created_at DESC
      LIMIT 50
    `).all(clienteId)
    return { saldo: cliente?.saldo_fiado || 0, limite: cliente?.limite_fiado || 0, movimentacoes }
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
    if (periodo.inicio) { sql += ' AND fm.created_at >= ?'; params.push(periodo.inicio) }
    if (periodo.fim) { sql += ' AND fm.created_at <= ?'; params.push(periodo.fim) }
    sql += ' ORDER BY fm.created_at DESC'
    return db.prepare(sql).all(...params)
  })
}
