import { ipcMain } from 'electron'
import { getDb } from '../database'
import { supabaseAdmin as supabase, supabase as supabaseAnon } from '../lib/supabase'
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

    // Monta o payload com categoria + unidades de cada produto. O upsert no
    // Supabase é feito pela Edge Function `sync-cardapio` (service_role no
    // servidor), evitando o erro de RLS na versão instalada (que só tem anon).
    const payload = produtos.map(p => {
      const unidades = db.prepare(`
        SELECT id, tipo, quantidade_base, preco_venda
        FROM produto_unidades WHERE produto_id = ? AND ativo = 1
      `).all(p.id) as any[]

      return {
        produto_local_id: p.id,
        nome: p.nome,
        descricao: p.descricao || null,
        ativo: p.ativo === 1,
        categoria: p.cat_id ? { local_id: p.cat_id, nome: p.cat_nome, ordem: p.cat_ordem || 0 } : null,
        unidades: unidades.map(u => ({
          unidade_local_id: u.id,
          tipo: u.tipo,
          quantidade_base: u.quantidade_base,
          preco: u.preco_venda,
        })),
      }
    })

    const { data, error } = await supabaseAnon.functions.invoke('sync-cardapio', {
      body: { lojaId, produtos: payload },
    })
    if (error) return { ok: false, erro: 'Falha na sincronização: ' + error.message }
    if ((data as any)?.error) return { ok: false, erro: 'Falha na sincronização: ' + (data as any).error }

    return { ok: true, synced: (data as any)?.synced ?? produtos.length }
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

    // O upload é feito pela Edge Function `upload-foto-produto` (service_role no
    // servidor), que cria o bucket se necessário e devolve a URL pública. Evita
    // o "Bucket not found" e o erro de RLS na versão instalada (que só tem anon).
    const { data, error } = await supabaseAnon.functions.invoke('upload-foto-produto', {
      body: { fileBase64: fileBuffer.toString('base64'), ext, lojaId, produtoLocalId },
    })
    if (error) return { ok: false, erro: 'Falha no envio da foto: ' + error.message }
    const fotoUrl = (data as any)?.publicUrl
    if (!fotoUrl) return { ok: false, erro: 'Falha no envio da foto: ' + ((data as any)?.error || 'resposta inválida do servidor') }

    // Salva foto_path local no SQLite (cache local do caminho original)
    db.prepare('UPDATE produtos SET foto_path = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(filePath, produtoLocalId)

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
