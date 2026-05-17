import { ipcMain } from 'electron'
import { getDb } from '../database'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import fs from 'fs'
import path from 'path'

const supabase = createClient(
  'https://vxrhlljvjqdbpfngpzro.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4cmhsbGp2anFkYnBmbmdwenJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NzQ1MDAsImV4cCI6MjA5NDQ1MDUwMH0.UTzP5lf2x7GnEw8nsuoe_qnywe-JpO1ApDtfS1RLjD0',
  { realtime: { transport: ws as any } }
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
      const { data: ex, error: exErr } = await supabase
        .from('cardapio_categorias')
        .select('id')
        .eq('loja_id', lojaId)
        .eq('categoria_local_id', cat.id)
        .maybeSingle()

      if (exErr) console.error('[cardapio:sync] cat SELECT erro:', exErr.message)

      if (ex) {
        const { error: upErr } = await supabase.from('cardapio_categorias')
          .update({ nome: cat.nome, ordem: cat.ordem, ativa: true })
          .eq('id', ex.id)
        if (upErr) console.error('[cardapio:sync] cat UPDATE erro:', upErr.message)
        catMap[cat.id] = ex.id
      } else {
        const { data: ins, error: insErr } = await supabase.from('cardapio_categorias')
          .insert({ loja_id: lojaId, categoria_local_id: cat.id, nome: cat.nome, ordem: cat.ordem, ativa: true })
          .select('id')
          .single()
        if (insErr) console.error('[cardapio:sync] cat INSERT erro:', insErr.message, insErr.code)
        if (ins) catMap[cat.id] = ins.id
      }
    }

    console.log('[cardapio:sync] catMap:', catMap)

    // ── PASSO 2: produtos ───────────────────────────────────────────────
    const prodMap: Record<number, string> = {} // local_id → supabase UUID

    for (const p of produtos) {
      const categoriaId = p.cat_id ? (catMap[p.cat_id] || null) : null

      const { data: ex, error: exErr } = await supabase
        .from('cardapio_produtos')
        .select('id')
        .eq('loja_id', lojaId)
        .eq('produto_local_id', p.id)
        .maybeSingle()

      if (exErr) console.error('[cardapio:sync] prod SELECT erro:', exErr.message)

      if (ex) {
        const { error: upErr } = await supabase.from('cardapio_produtos').update({
          nome: p.nome,
          descricao: p.descricao || null,
          categoria_id: categoriaId,
          ativo: p.ativo === 1,
        }).eq('id', ex.id)
        if (upErr) console.error('[cardapio:sync] prod UPDATE erro:', upErr.message)
        prodMap[p.id] = ex.id
      } else {
        const { data: ins, error: insErr } = await supabase.from('cardapio_produtos')
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
        if (insErr) console.error('[cardapio:sync] prod INSERT erro:', insErr.message, insErr.code)
        if (ins) prodMap[p.id] = ins.id
      }
    }

    console.log('[cardapio:sync] prodMap:', prodMap)

    // ── PASSO 3: unidades (preços) ──────────────────────────────────────
    for (const p of produtos) {
      const cardapioProdId = prodMap[p.id]
      if (!cardapioProdId) {
        console.warn('[cardapio:sync] sem UUID para produto local id:', p.id)
        continue
      }

      const unidades = db.prepare(`
        SELECT id, tipo, quantidade_base, preco_venda
        FROM produto_unidades WHERE produto_id = ? AND ativo = 1
      `).all(p.id) as any[]

      const { error: delErr } = await supabase.from('cardapio_unidades').delete().eq('produto_id', cardapioProdId)
      if (delErr) console.error('[cardapio:sync] unidades DELETE erro:', delErr.message)

      if (unidades.length > 0) {
        const { error: insErr } = await supabase.from('cardapio_unidades').insert(
          unidades.map(u => ({
            produto_id: cardapioProdId,
            unidade_local_id: u.id,
            tipo: u.tipo,
            quantidade_base: u.quantidade_base,
            preco: u.preco_venda,
            ativo: true,
          }))
        )
        if (insErr) console.error('[cardapio:sync] unidades INSERT erro:', insErr.message, insErr.code)
      }
    }

    return { ok: true, synced: produtos.length }
  })

  // ── FOTOS ──────────────────────────────────────────────────────────────────

  ipcMain.handle('cardapio:get-fotos', async () => {
    const db = getDb()
    const licenca = db.prepare('SELECT * FROM licenca LIMIT 1').get() as any
    if (!licenca?.supabase_loja_id) return { ok: false, erro: 'Loja não configurada na nuvem', produtos: [] }

    const { data, error } = await supabase
      .from('cardapio_produtos')
      .select('id, nome, foto_url, produto_local_id')
      .eq('loja_id', licenca.supabase_loja_id)
      .order('nome')

    if (error) return { ok: false, erro: error.message, produtos: [] }
    return { ok: true, produtos: data || [] }
  })

  ipcMain.handle('cardapio:upload-foto', async (_, cardapioProdutoId: string, filePath: string) => {
    const db = getDb()
    const licenca = db.prepare('SELECT * FROM licenca LIMIT 1').get() as any
    if (!licenca?.supabase_loja_id) return { ok: false, erro: 'Loja não configurada na nuvem' }

    const ext = path.extname(filePath).toLowerCase().replace('.', '') || 'jpg'
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg',
      png: 'image/png', webp: 'image/webp', gif: 'image/gif',
    }
    const contentType = mimeTypes[ext] || 'image/jpeg'
    const storagePath = `${licenca.supabase_loja_id}/${cardapioProdutoId}.${ext}`

    let fileBuffer: Buffer
    try {
      fileBuffer = fs.readFileSync(filePath)
    } catch (e: any) {
      return { ok: false, erro: `Erro ao ler arquivo: ${e.message}` }
    }

    const { error: uploadError } = await supabase.storage
      .from('produtos-fotos')
      .upload(storagePath, fileBuffer, { contentType, upsert: true })

    if (uploadError) return { ok: false, erro: uploadError.message }

    const { data: { publicUrl } } = supabase.storage
      .from('produtos-fotos')
      .getPublicUrl(storagePath)

    const { error: updateError } = await supabase
      .from('cardapio_produtos')
      .update({ foto_url: publicUrl })
      .eq('id', cardapioProdutoId)

    if (updateError) return { ok: false, erro: updateError.message }

    return { ok: true, url: publicUrl }
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
