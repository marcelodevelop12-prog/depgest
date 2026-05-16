import express from 'express'
import { getDb } from './database'

const PORT = 3791

export function startLocalServer() {
  const app = express()
  app.use(express.json())

  app.get('/health', (_, res) => res.json({ ok: true }))

  app.get('/pedido/:token', (req, res) => {
    const db = getDb()
    const pedido = db.prepare(`
      SELECT p.*, GROUP_CONCAT(ip.nome || ' x' || ip.quantidade, ', ') as itens_resumo
      FROM pedidos p
      LEFT JOIN itens_pedido ip ON ip.pedido_id = p.id
      WHERE p.token_rastreio = ?
      GROUP BY p.id
    `).get(req.params.token)
    if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' })
    res.json(pedido)
  })

  app.listen(PORT, '127.0.0.1', () => {
    console.log(`DepGest local server running on port ${PORT}`)
  })
}
