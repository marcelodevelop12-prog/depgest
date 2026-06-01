// Edge Function: upload-logo
// Recebe o logo da loja (base64) do app desktop e faz o upload no Storage
// usando a service_role (disponível apenas no servidor). Atualiza também
// lojas.logo_url. O app chama esta função com a chave anon (verify_jwt),
// portanto a chave admin NUNCA é distribuída no instalador.
//
// Deploy:
//   supabase functions deploy upload-logo --project-ref vxrhlljvjqdbpfngpzro

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  try {
    const { fileBase64, ext, lojaId } = await req.json()
    if (!fileBase64 || typeof fileBase64 !== 'string') {
      return json({ error: 'Arquivo ausente ou inválido' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // base64 -> bytes
    const bytes = Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0))

    const safeExt = String(ext || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
    const contentType =
      safeExt === 'jpg' || safeExt === 'jpeg' ? 'image/jpeg' :
      safeExt === 'png' ? 'image/png' :
      safeExt === 'webp' ? 'image/webp' :
      'application/octet-stream'

    const folder = lojaId ? String(lojaId) : 'loja'
    const storagePath = `logos/${folder}/${Date.now()}.${safeExt}`

    const { error: upErr } = await supabase.storage
      .from('lojas')
      .upload(storagePath, bytes, { contentType, upsert: true })

    if (upErr) return json({ error: 'storage: ' + upErr.message }, 500)

    const { data: { publicUrl } } = supabase.storage.from('lojas').getPublicUrl(storagePath)

    // Atualiza a loja (anon não consegue por causa da RLS — aqui temos service_role)
    if (lojaId) {
      await supabase.from('lojas').update({ logo_url: publicUrl }).eq('id', lojaId)
    }

    return json({ publicUrl })
  } catch (e) {
    return json({ error: (e as Error)?.message || String(e) }, 500)
  }
})
