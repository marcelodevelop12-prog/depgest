// Edge Function: validar-licenca
// "Batida de ponto" do protetor anti-chargeback. O app desktop chama esta
// função (ao abrir e a cada 4h). Ela lê a licença com a service_role NO
// SERVIDOR e responde se a licença pode rodar.
//
// Request (POST): { chave: string, machine_id: string }
// Response:
//   { status: 'ok' }                              -> liberado (salva ultima_validacao)
//   { status: 'bloqueada', motivo }               -> app trava
//   { status: 'maquina_invalida', motivo }        -> app trava (chave em outra máquina)
//
// NÃO altera as funções gerar-licenca / buscar-licenca.
//
// Deploy:
//   supabase functions deploy validar-licenca --project-ref vxrhlljvjqdbpfngpzro --no-verify-jwt

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
  if (req.method !== 'POST') return json({ status: 'erro', motivo: 'Método não permitido' }, 405)

  try {
    const { chave, machine_id } = await req.json()
    if (!chave) return json({ status: 'erro', motivo: 'Chave ausente' })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const chaveFmt = String(chave).toUpperCase().trim()

    const { data, error } = await supabase
      .from('licencas')
      .select('id, ativa, bloqueada, motivo_bloqueio, machine_id')
      .eq('chave', chaveFmt)
      .single()

    if (error || !data) {
      return json({ status: 'bloqueada', motivo: 'Licença não encontrada' })
    }

    // Bloqueio manual (chargeback/cancelamento) — ou licença desativada na origem
    if (data.bloqueada === true || data.ativa === false) {
      return json({ status: 'bloqueada', motivo: data.motivo_bloqueio || 'Licença bloqueada' })
    }

    // Chave já ativada em outra máquina
    if (data.machine_id && machine_id && data.machine_id !== machine_id) {
      return json({ status: 'maquina_invalida', motivo: 'Licença ativada em outro computador' })
    }

    // Liberado — registra a última validação
    await supabase
      .from('licencas')
      .update({ ultima_validacao: new Date().toISOString() })
      .eq('id', data.id)

    return json({ status: 'ok' })
  } catch (e) {
    // Erro inesperado do servidor: NÃO bloqueia (o app aplica a carência offline)
    return json({ status: 'erro', motivo: (e as Error)?.message || String(e) }, 500)
  }
})
