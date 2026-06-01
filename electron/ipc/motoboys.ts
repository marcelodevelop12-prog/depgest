import { ipcMain } from 'electron'
import { getDb } from '../database'

export function registerMotoboyHandlers() {
  ipcMain.handle('motoboys:list', () => {
    const db = getDb()
    return db.prepare('SELECT * FROM motoboys WHERE ativo = 1 ORDER BY nome').all()
  })

  ipcMain.handle('motoboys:create', (_, data: any) => {
    const db = getDb()
    const result = db.prepare('INSERT INTO motoboys (nome, telefone, veiculo, placa) VALUES (?, ?, ?, ?)')
      .run(data.nome, data.telefone || null, data.veiculo || null, data.placa || null)
    return { id: result.lastInsertRowid }
  })

  ipcMain.handle('motoboys:update', (_, id: number, data: any) => {
    const db = getDb()
    db.prepare('UPDATE motoboys SET nome=?, telefone=?, veiculo=?, placa=?, ativo=? WHERE id=?')
      .run(data.nome, data.telefone || null, data.veiculo || null, data.placa || null, data.ativo !== false ? 1 : 0, id)
    return true
  })

  ipcMain.handle('motoboys:delete', (_, id: number) => {
    const db = getDb()
    db.prepare('UPDATE motoboys SET ativo = 0 WHERE id = ?').run(id)
    return true
  })

  ipcMain.handle('motoboys:get-entregas', (_, motoboyId?: number, data?: string) => {
    const db = getDb()
    let sql = `
      SELECT e.id, e.pedido_id, e.motoboy_id, e.status, e.created_at,
             e.saiu_as as saiu_em, e.entregue_as as chegou_em,
             p.numero as pedido_numero, p.total, p.cliente_nome,
             p.cliente_endereco as endereco, p.status as pedido_status
      FROM entregas e
      JOIN pedidos p ON p.id = e.pedido_id
      WHERE 1=1
    `
    const params: any[] = []
    // motoboyId 0/undefined = todas as entregas
    if (motoboyId) { sql += ' AND e.motoboy_id = ?'; params.push(motoboyId) }
    if (data) { sql += ' AND date(e.created_at) = ?'; params.push(data) }
    sql += ' ORDER BY e.created_at DESC'
    return db.prepare(sql).all(...params)
  })
}
