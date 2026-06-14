// Edge Function: sync-cardapio
// Recebe os produtos selecionados (com categoria e unidades) do app desktop e
// sincroniza categorias/produtos/unidades no cardápio usando a service_role
// no servidor. O app chama com a chave pública (anon) — a chave admin nunca é
// distribuída. Isso evita o erro "new row violates row-level security policy"
// na versão instalada (que só possui a anon key).
//
// Deploy:
//   supabase functions deploy sync-cardapio --project-ref vxrhlljvjqdbpfngpzro

import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

interface Unidade {
  unidade_local_id: number
  tipo: string
  quantidade_base: number
  preco: number
}
interface Categoria {
  local_id: number
  nome: string
  ordem: number
}
interface Produto {
  produto_local_id: number
  nome: string
  descricao: string | null
  ativo: boolean
  categoria: Categoria | null
  unidades: Unidade[]
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  try {
    const { lojaId, produtos } = await req.json() as { lojaId: string; produtos: Produto[] }
    if (!lojaId) return json({ error: 'Loja não informada' }, 400)
    if (!Array.isArray(produtos)) return json({ error: 'Produtos inválidos' }, 400)
    if (produtos.length === 0) return json({ ok: true, synced: 0 })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ── PASSO 1: categorias ─────────────────────────────────────────────
    const catInput = new Map<number, Categoria>()
    for (const p of produtos) {
      if (p.categoria) catInput.set(p.categoria.local_id, p.categoria)
    }

    const catMap: Record<number, string> = {} // local_id → supabase UUID
    for (const cat of catInput.values()) {
      const { data: ex } = await supabase
        .from('cardapio_categorias')
        .select('id')
        .eq('loja_id', lojaId)
        .eq('categoria_local_id', cat.local_id)
        .maybeSingle()

      if (ex) {
        await supabase.from('cardapio_categorias')
          .update({ nome: cat.nome, ordem: cat.ordem, ativa: true })
          .eq('id', ex.id)
        catMap[cat.local_id] = ex.id
      } else {
        const { data: ins, error } = await supabase.from('cardapio_categorias')
          .insert({ loja_id: lojaId, categoria_local_id: cat.local_id, nome: cat.nome, ordem: cat.ordem, ativa: true })
          .select('id')
          .single()
        if (error) return json({ error: 'categoria: ' + error.message }, 500)
        if (ins) catMap[cat.local_id] = ins.id
      }
    }

    // ── PASSO 2: produtos ───────────────────────────────────────────────
    const prodMap: Record<number, string> = {} // local_id → supabase UUID
    for (const p of produtos) {
      const categoriaId = p.categoria ? (catMap[p.categoria.local_id] || null) : null

      const { data: ex } = await supabase
        .from('cardapio_produtos')
        .select('id')
        .eq('loja_id', lojaId)
        .eq('produto_local_id', p.produto_local_id)
        .maybeSingle()

      if (ex) {
        // Preserva foto_url existente — não sobrescreve a foto já enviada.
        await supabase.from('cardapio_produtos').update({
          nome: p.nome,
          descricao: p.descricao,
          categoria_id: categoriaId,
          ativo: p.ativo,
        }).eq('id', ex.id)
        prodMap[p.produto_local_id] = ex.id
      } else {
        const { data: ins, error } = await supabase.from('cardapio_produtos')
          .insert({
            loja_id: lojaId,
            produto_local_id: p.produto_local_id,
            nome: p.nome,
            descricao: p.descricao,
            foto_url: null,
            categoria_id: categoriaId,
            ativo: true,
            ordem: 0,
          })
          .select('id')
          .single()
        if (error) return json({ error: 'produto: ' + error.message }, 500)
        if (ins) prodMap[p.produto_local_id] = ins.id
      }
    }

    // ── PASSO 3: unidades (preços) ──────────────────────────────────────
    for (const p of produtos) {
      const cardapioProdId = prodMap[p.produto_local_id]
      if (!cardapioProdId) continue

      // Recria as unidades (mais simples que upsert por tipo)
      await supabase.from('cardapio_unidades').delete().eq('produto_id', cardapioProdId)

      if (p.unidades.length > 0) {
        const { error } = await supabase.from('cardapio_unidades').insert(
          p.unidades.map((u) => ({
            produto_id: cardapioProdId,
            unidade_local_id: u.unidade_local_id,
            tipo: u.tipo,
            quantidade_base: u.quantidade_base,
            preco: u.preco,
          })),
        )
        if (error) return json({ error: 'unidade: ' + error.message }, 500)
      }
    }

    return json({ ok: true, synced: produtos.length })
  } catch (e) {
    return json({ error: (e as Error)?.message || String(e) }, 500)
  }
})
