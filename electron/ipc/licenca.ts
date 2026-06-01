import { ipcMain } from 'electron'
import crypto from 'crypto'
import os from 'os'
import { getDb } from '../database'
import { supabaseAdmin as supabase, supabase as supabaseAnon } from '../lib/supabase'

const CARENCIA_DIAS = 3

// Avalia a carência offline quando não foi possível validar online.
function avaliarCarencia(lic: any) {
  const ref = lic?.ultima_validacao || lic?.data_ativacao
  const refMs = ref ? Date.parse(ref) : NaN
  if (!isNaN(refMs)) {
    const dias = (Date.now() - refMs) / 86400000
    if (dias <= CARENCIA_DIAS) return { liberado: true, offline: true }
  }
  return { liberado: false, motivo: 'Conecte à internet para validar sua licença.' }
}

function getMachineId(): string {
  const hostname = os.hostname()
  const cpus = os.cpus()[0]?.model || ''
  const platform = os.platform()
  const raw = `${hostname}-${cpus}-${platform}-${os.arch()}`
  return crypto.createHash('sha256').update(raw).digest('hex')
}

export function registerLicenseHandlers() {
  ipcMain.handle('licenca:get-machine-id', () => getMachineId())

  ipcMain.handle('licenca:get', () => {
    const db = getDb()
    return db.prepare('SELECT * FROM licenca LIMIT 1').get()
  })

  ipcMain.handle('licenca:verificar', async (_, chave: string) => {
    const chaveFormatada = chave.toUpperCase().trim()

    // Valida formato DEP-XXXX-XXXX-XXXX
    if (!/^DEP-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(chaveFormatada)) {
      return { ok: false, erro: 'Formato de chave inválido. Use DEP-XXXX-XXXX-XXXX' }
    }

    try {
      const machineId = getMachineId()

      const { data, error } = await supabase
        .from('licencas')
        .select('*, lojas(*)')
        .eq('chave', chaveFormatada)
        .single()

      if (error || !data) {
        return { ok: false, erro: 'Chave não encontrada ou inválida' }
      }

      if (!data.ativa) {
        return { ok: false, erro: 'Esta licença está desativada' }
      }

      if (data.bloqueada) {
        return { ok: false, erro: data.motivo_bloqueio || 'Licença bloqueada. Entre em contato com o suporte DepGest.' }
      }

      if (data.data_expiracao && new Date(data.data_expiracao) < new Date()) {
        return { ok: false, erro: 'Licença expirada' }
      }

      if (data.machine_id && data.machine_id !== machineId) {
        return { ok: false, erro: 'Esta chave já está ativada em outro computador' }
      }

      // Registra machine_id no Supabase
      if (!data.machine_id) {
        await supabase
          .from('licencas')
          .update({ machine_id: machineId, data_ativacao: new Date().toISOString() })
          .eq('id', data.id)
      }

      // Salva localmente
      const db = getDb()
      db.prepare(`
        INSERT OR REPLACE INTO licenca
        (id, chave, machine_id, nome_titular, cnpj, ativa, data_ativacao, data_expiracao, supabase_loja_id)
        VALUES (1, ?, ?, ?, ?, 1, ?, ?, ?)
      `).run(
        chaveFormatada,
        machineId,
        data.nome_titular || '',
        data.cnpj || '',
        data.data_ativacao || new Date().toISOString(),
        data.data_expiracao || null,
        data.lojas?.[0]?.id || null
      )

      return { ok: true, licenca: data }
    } catch (err) {
      return { ok: false, erro: 'Erro ao conectar com servidor de licenças. Verifique sua internet.' }
    }
  })

  // Heartbeat do protetor: revalida a licença no servidor.
  // Retorna { liberado, motivo? }. Chamado ao abrir o app e a cada 4h.
  ipcMain.handle('licenca:validar', async () => {
    const db = getDb()
    const lic = db.prepare('SELECT * FROM licenca LIMIT 1').get() as any
    if (!lic || !lic.chave) return { liberado: false, motivo: 'Nenhuma licença ativa.' }

    const machineId = getMachineId()

    try {
      const { data, error } = await supabaseAnon.functions.invoke('validar-licenca', {
        body: { chave: lic.chave, machine_id: machineId },
      })
      if (error) throw error

      const status = (data as any)?.status

      if (status === 'bloqueada' || status === 'maquina_invalida') {
        db.prepare('UPDATE licenca SET ativa = 0 WHERE id = ?').run(lic.id)
        return {
          liberado: false,
          bloqueada: true,
          motivo: (data as any)?.motivo || 'Licença bloqueada. Entre em contato com o suporte DepGest.',
        }
      }

      if (status === 'ok') {
        db.prepare('UPDATE licenca SET ultima_validacao = ? WHERE id = ?').run(new Date().toISOString(), lic.id)
        return { liberado: true }
      }

      // Resposta indeterminada (ex.: erro temporário do servidor) → aplica carência.
      return avaliarCarencia(lic)
    } catch {
      // Sem internet / função inacessível → carência offline.
      return avaliarCarencia(lic)
    }
  })
}
