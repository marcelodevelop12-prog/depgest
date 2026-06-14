// Edge Function: upload-foto-produto
// Recebe a foto de um produto (base64) do app desktop e faz o upload no
// Storage usando a service_role (no servidor). Cria o bucket se não existir,
// atualiza cardapio_produtos.foto_url e devolve a URL pública.
// O app chama com a chave pública (anon) — a chave admin nunca é distribuída.
//
// Deploy:
//   supabase functions deploy upload-foto-produto --project-ref vxrhlljvjqdbpfngpzro

import { createClient } from 'jsr:@supabase/supabase-js@2'

const BUCKET = 'cardapio-fotos'

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  try {
    const { fileBase64, ext, lojaId, produtoLocalId } = await req.json()
    if (!fileBase64 || typeof fileBase64 !== 'string') {
      return json({ error: 'Arquivo ausente ou inválido' }, 400)
    }
    if (!lojaId) return json({ error: 'Loja não informada' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Garante que o bucket existe (corrige "Bucket not found"). Ignora se já existir.
    const { error: bucketErr } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 5242880, // 5 MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    })
    if (bucketErr && !/already exists/i.test(bucketErr.message)) {
      return json({ error: 'bucket: ' + bucketErr.message }, 500)
    }

    const bytes = Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0))
    const safeExt = String(ext || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
    const contentType =
      safeExt === 'png' ? 'image/png' :
      safeExt === 'webp' ? 'image/webp' :
      safeExt === 'gif' ? 'image/gif' :
      'image/jpeg'

    const fileName = `${lojaId}/${produtoLocalId || 'p'}_${Date.now()}.${safeExt}`

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, bytes, { contentType, upsert: true })

    if (upErr) return json({ error: 'storage: ' + upErr.message }, 500)

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(fileName)

    // Atualiza a foto no cardápio, se o produto já estiver sincronizado.
    if (produtoLocalId) {
      const { data: ex } = await supabase
        .from('cardapio_produtos')
        .select('id')
        .eq('loja_id', lojaId)
        .eq('produto_local_id', produtoLocalId)
        .maybeSingle()
      if (ex) {
        await supabase.from('cardapio_produtos').update({ foto_url: publicUrl }).eq('id', ex.id)
      }
    }

    return json({ publicUrl })
  } catch (e) {
    return json({ error: (e as Error)?.message || String(e) }, 500)
  }
})
