import { ipcMain } from 'electron'
import { getDb } from '../database'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://vxrhlljvjqdbpfngpzro.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4cmhsbGp2anFkYnBmbmdwenJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NzQ1MDAsImV4cCI6MjA5NDQ1MDUwMH0.UTzP5lf2x7GnEw8nsuoe_qnywe-JpO1ApDtfS1RLjD0'
)

export function registerCardapioHandlers() {
  ipcMain.handle('cardapio:get-produtos', () => {
    const db = getDb()
    return db.prepare(`
      SELECT p.*, pu.tipo, pu.preco_venda, pu.quantidade_base,
        c.nome as categoria_nome
      FROM produtos p
      LEFT JOIN produto_unidades pu ON pu.produto_id = p.id AND pu.ativo = 1
      LEFT JOIN categorias c ON c.id = p.categoria_id
      WHERE p.ativo = 1
      ORDER BY c.ordem, p.nome
    `).all()
  })

  ipcMain.handle('cardapio:update-produtos', async (_, produtos: any[]) => {
    const db = getDb()
    const licenca = db.prepare('SELECT * FROM licenca LIMIT 1').get() as any
    if (!licenca?.supabase_loja_id) return { ok: false, erro: 'Loja não configurada na nuvem' }

    const lojaId = licenca.supabase_loja_id

    for (const p of produtos) {
      const { data: existente } = await supabase
        .from('cardapio_produtos')
        .select('id')
        .eq('loja_id', lojaId)
        .eq('produto_local_id', p.id)
        .single()

      if (existente) {
        await supabase.from('cardapio_produtos').update({
          nome: p.nome,
          descricao: p.descricao,
          ativo: p.ativo,
        }).eq('id', existente.id)
      } else {
        await supabase.from('cardapio_produtos').insert({
          loja_id: lojaId,
          produto_local_id: p.id,
          nome: p.nome,
          descricao: p.descricao || null,
          foto_url: null,
          ativo: true,
          ordem: 0,
        })
      }
    }

    return { ok: true }
  })

  ipcMain.handle('cardapio:sync', async () => {
    const db = getDb()
    const licenca = db.prepare('SELECT * FROM licenca LIMIT 1').get() as any
    if (!licenca?.supabase_loja_id) return { ok: false }

    const config = db.prepare("SELECT chave, valor FROM configuracoes WHERE chave LIKE 'loja_%'").all() as any[]
    const cfg = Object.fromEntries(config.map((r: any) => [r.chave.replace('loja_', ''), r.valor]))

    await supabase.from('lojas').update({
      cardapio_ativo: cfg.cardapio_ativo === 'true',
      taxa_entrega: parseFloat(cfg.taxa_entrega || '0'),
      pedido_minimo: parseFloat(cfg.pedido_minimo || '0'),
    }).eq('id', licenca.supabase_loja_id)

    return { ok: true }
  })
}
