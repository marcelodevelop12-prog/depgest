import { ipcMain } from 'electron'
import { getDb } from '../database'
import { supabaseAdmin as supabase } from '../lib/supabase'
import fs from 'fs'
import path from 'path'

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

  ipcMain.handle('cardapio:update-produtos', async (_, produtoIds: number[]) => {
    const db = getDb()
    const licenca = db.prepare('SELECT * FROM licenca LIMIT 1').get() as any
    if (!licenca?.supabase_loja_id) return { ok: false, erro: 'Loja não configurada na nuvem' }

    const lojaId = licenca.supabase_loja_id

    // Carrega produtos com categoria do SQLite local
    const placeholders = produtoIds.map(() => '?').join(',')
    const produtos = db.prepare(`
      SELECT p.id, p.nome, p.descricao, p.ativo, p.foto_path,
             c.id as cat_id, c.nome as cat_nome, c.ordem as cat_ordem
      FROM produtos p
      LEFT JOIN categorias c ON c.id = p.categoria_id
      WHERE p.id IN (${placeholders})
    `).all(...produtoIds) as any[]

    if (produtos.length === 0) return { ok: true, synced: 0 }

    // ── PASSO 1: categorias ─────────────────────────────────────────────
    const cats = [...new Map(
      produtos.filter(p => p.cat_id)
        .map(p => [p.cat_id, { id: p.cat_id, nome: p.cat_nome, ordem: p.cat_ordem || 0 }])
    ).values()]

    const catMap: Record<number, string> = {} // local_id → supabase UUID

    for (const cat of cats) {
      const { data: ex } = await supabase
        .from('cardapio_categorias')
        .select('id')
        .eq('loja_id', lojaId)
        .eq('categoria_local_id', cat.id)
        .maybeSingle()

      if (ex) {
        await supabase.from('cardapio_categorias')
          .update({ nome: cat.nome, ordem: cat.ordem, ativa: true })
          .eq('id', ex.id)
        catMap[cat.id] = ex.id
      } else {
        const { data: ins } = await supabase.from('cardapio_categorias')
          .insert({ loja_id: lojaId, categoria_local_id: cat.id, nome: cat.nome, ordem: cat.ordem, ativa: true })
          .select('id')
          .single()
        if (ins) catMap[cat.id] = ins.id
      }
    }

    // ── PASSO 2: produtos ───────────────────────────────────────────────
    const prodMap: Record<number, string> = {} // local_id → supabase UUID

    for (const p of produtos) {
      const categoriaId = p.cat_id ? (catMap[p.cat_id] || null) : null

      const { data: ex } = await supabase
        .from('cardapio_produtos')
        .select('id')
        .eq('loja_id', lojaId)
        .eq('produto_local_id', p.id)
        .maybeSingle()

      if (ex) {
        await supabase.from('cardapio_produtos').update({
          nome: p.nome,
          descricao: p.descricao || null,
          categoria_id: categoriaId,
          ativo: p.ativo === 1,
        }).eq('id', ex.id)
        prodMap[p.id] = ex.id
      } else {
        const { data: ins } = await supabase.from('cardapio_produtos')
          .insert({
            loja_id: lojaId,
            produto_local_id: p.id,
            nome: p.nome,
            descricao: p.descricao || null,
            foto_url: null,
            categoria_id: categoriaId,
            ativo: true,
            ordem: 0,
          })
          .select('id')
          .single()
        if (ins) prodMap[p.id] = ins.id
      }
    }

    // ── PASSO 3: unidades (preços) ──────────────────────────────────────
    for (const p of produtos) {
      const cardapioProdId = prodMap[p.id]
      if (!cardapioProdId) continue

      const unidades = db.prepare(`
        SELECT id, tipo, quantidade_base, preco_venda
        FROM produto_unidades WHERE produto_id = ? AND ativo = 1
      `).all(p.id) as any[]

      // Recria unidades: mais simples que upsert por tipo
      await supabase.from('cardapio_unidades').delete().eq('produto_id', cardapioProdId)

      if (unidades.length > 0) {
        await supabase.from('cardapio_unidades').insert(
          unidades.map(u => ({
            produto_id: cardapioProdId,
            unidade_local_id: u.id,
            tipo: u.tipo,
            quantidade_base: u.quantidade_base,
            preco: u.preco_venda,
          }))
        )
      }
    }

    return { ok: true, synced: produtos.length }
  })

  ipcMain.handle('cardapio:get-fotos', async () => {
    const db = getDb()
    const licenca = db.prepare('SELECT * FROM licenca LIMIT 1').get() as any
    if (!licenca?.supabase_loja_id) return {}

    const { data } = await supabase
      .from('cardapio_produtos')
      .select('produto_local_id, foto_url')
      .eq('loja_id', licenca.supabase_loja_id)
      .not('foto_url', 'is', null)

    if (!data) return {}
    return Object.fromEntries(data.map((r: any) => [r.produto_local_id, r.foto_url]))
  })

  ipcMain.handle('cardapio:upload-foto', async (_, produtoLocalIdStr: string, filePath: string) => {
    const db = getDb()
    const licenca = db.prepare('SELECT * FROM licenca LIMIT 1').get() as any
    if (!licenca?.supabase_loja_id) return { ok: false, erro: 'Loja não configurada na nuvem' }

    const lojaId = licenca.supabase_loja_id
    const produtoLocalId = parseInt(produtoLocalIdStr)

    // Lê o arquivo de imagem
    if (!fs.existsSync(filePath)) return { ok: false, erro: 'Arquivo não encontrado' }
    const fileBuffer = fs.readFileSync(filePath)
    const ext = path.extname(filePath).toLowerCase().replace('.', '') || 'jpg'
    const mimeType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg'
    const fileName = `${lojaId}/${produtoLocalId}_${Date.now()}.${ext}`

    // Upload para Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('cardapio-fotos')
      .upload(fileName, fileBuffer, { contentType: mimeType, upsert: true })

    if (uploadError) return { ok: false, erro: uploadError.message }

    // URL pública
    const { data: urlData } = supabase.storage.from('cardapio-fotos').getPublicUrl(fileName)
    const fotoUrl = urlData.publicUrl

    // Salva foto_path local no SQLite
    db.prepare('UPDATE produtos SET foto_path = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(filePath, produtoLocalId)

    // Atualiza foto_url no cardapio_produtos (se o produto já foi sincronizado)
    const { data: ex } = await supabase
      .from('cardapio_produtos')
      .select('id')
      .eq('loja_id', lojaId)
      .eq('produto_local_id', produtoLocalId)
      .maybeSingle()

    if (ex) {
      await supabase.from('cardapio_produtos').update({ foto_url: fotoUrl }).eq('id', ex.id)
    }

    return { ok: true, foto_url: fotoUrl, foto_path: filePath }
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
