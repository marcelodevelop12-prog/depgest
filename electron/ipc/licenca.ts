import { ipcMain } from 'electron'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import crypto from 'crypto'
import os from 'os'
import { getDb } from '../database'

const supabase = createClient(
  'https://vxrhlljvjqdbpfngpzro.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4cmhsbGp2anFkYnBmbmdwenJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NzQ1MDAsImV4cCI6MjA5NDQ1MDUwMH0.UTzP5lf2x7GnEw8nsuoe_qnywe-JpO1ApDtfS1RLjD0',
  { realtime: { transport: ws as any } }
)

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
}
