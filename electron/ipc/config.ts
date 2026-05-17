import { ipcMain, app } from 'electron'
import { getDb } from '../database'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

const supabase = createClient(
  'https://vxrhlljvjqdbpfngpzro.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4cmhsbGp2anFkYnBmbmdwenJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NzQ1MDAsImV4cCI6MjA5NDQ1MDUwMH0.UTzP5lf2x7GnEw8nsuoe_qnywe-JpO1ApDtfS1RLjD0',
  { realtime: { transport: ws as any } }
)

function getConfig(chave: string): string | null {
  const db = getDb()
  const row = db.prepare('SELECT valor FROM configuracoes WHERE chave = ?').get(chave) as any
  return row?.valor ?? null
}

function setConfig(chave: string, valor: string) {
  const db = getDb()
  db.prepare('INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES (?, ?)').run(chave, valor)
}

export function registerConfigHandlers() {
  ipcMain.handle('config:get', () => {
    const db = getDb()
    const rows = db.prepare('SELECT chave, valor FROM configuracoes').all() as any[]
    return Object.fromEntries(rows.map(r => [r.chave, r.valor]))
  })

  ipcMain.handle('config:save', (_, data: Record<string, string>) => {
    const db = getDb()
    const stmt = db.prepare('INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES (?, ?)')
    const tx = db.transaction(() => {
      for (const [k, v] of Object.entries(data)) {
        stmt.run(k, String(v))
      }
    })
    tx()
    return true
  })

  ipcMain.handle('config:get-loja', () => {
    const db = getDb()
    const licenca = db.prepare('SELECT * FROM licenca LIMIT 1').get() as any
    const configs = db.prepare('SELECT chave, valor FROM configuracoes WHERE chave LIKE \'loja_%\'').all() as any[]
    const lojaConfig = Object.fromEntries(configs.map(r => [r.chave.replace('loja_', ''), r.valor]))
    return { ...licenca, ...lojaConfig }
  })

  ipcMain.handle('config:save-loja', async (_, data: Record<string, unknown>) => {
    const db = getDb()
    const lojaFields = ['nome', 'cnpj', 'telefone', 'endereco', 'chave_pix', 'logo_url', 'codigo',
      'taxa_entrega', 'pedido_minimo', 'raio_entrega_km', 'cardapio_ativo', 'horario_funcionamento']

    const tx = db.transaction(() => {
      for (const field of lojaFields) {
        if (data[field] !== undefined) {
          db.prepare('INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES (?, ?)')
            .run(`loja_${field}`, String(data[field]))
        }
      }
    })
    tx()

    // Sync com Supabase
    const licenca = db.prepare('SELECT * FROM licenca LIMIT 1').get() as any
    console.log('[config:save-loja] data recebido:', JSON.stringify(data))
    console.log('[config:save-loja] licenca.supabase_loja_id:', licenca?.supabase_loja_id ?? 'NULL')

    // Mescla configurações salvas com dados recebidos para ter campos completos
    const configs = db.prepare("SELECT chave, valor FROM configuracoes WHERE chave LIKE 'loja_%'").all() as any[]
    const saved = Object.fromEntries(configs.map(r => [r.chave.replace('loja_', ''), r.valor]))
    const merged = { ...saved, ...Object.fromEntries(lojaFields.filter(f => data[f] !== undefined).map(f => [f, data[f]])) }

    const nfc = (v: any) => typeof v === 'string' ? v.normalize('NFC') : v

    const payload = {
      nome: nfc(merged.nome),
      codigo: nfc(merged.codigo),
      telefone: nfc(merged.telefone),
      endereco: nfc(merged.endereco),
      chave_pix: nfc(merged.chave_pix),
      taxa_entrega: merged.taxa_entrega ? Number(merged.taxa_entrega) : null,
      pedido_minimo: merged.pedido_minimo ? Number(merged.pedido_minimo) : null,
      cardapio_ativo: merged.cardapio_ativo === 'true' || merged.cardapio_ativo === true,
    }

    console.log('[config:save-loja] payload Supabase:', JSON.stringify(payload))

    if (licenca?.supabase_loja_id) {
      console.log('[config:save-loja] → UPDATE existente')
      const { error } = await supabase.from('lojas').update(payload).eq('id', licenca.supabase_loja_id)
      if (error) console.error('[config:save-loja] UPDATE erro:', error.message)
      else console.log('[config:save-loja] UPDATE ok')
    } else {
      console.log('[config:save-loja] → INSERT novo registro')
      try {
        const { data: inserted, error } = await supabase.from('lojas').insert(payload).select('id').single()
        if (error) {
          console.error('[config:save-loja] INSERT erro:', error.message, error.details, error.hint)
        } else if (inserted?.id) {
          console.log('[config:save-loja] INSERT ok, supabase_loja_id:', inserted.id)
          db.prepare('UPDATE licenca SET supabase_loja_id = ?').run(inserted.id)
        }
      } catch (e: any) {
        console.error('[config:save-loja] INSERT exception:', e?.message)
      }
    }

    return true
  })

  ipcMain.handle('config:backup', async (_, destPath: string) => {
    const userDataPath = app.getPath('userData')
    const dbPath = path.join(userDataPath, 'depgest.db')

    // Copia o arquivo db direto (SQLite WAL já garante consistência)
    fs.copyFileSync(dbPath, destPath.replace('.zip', '.db'))

    // Tenta criar zip com PowerShell (Windows)
    try {
      const dbCopy = destPath.replace('.zip', '.db')
      fs.copyFileSync(dbPath, dbCopy)
      execSync(`powershell -command "Compress-Archive -Path '${dbCopy}' -DestinationPath '${destPath}' -Force"`)
      fs.unlinkSync(dbCopy)
    } catch {
      // Se falhar o zip, mantém a cópia .db
    }

    return true
  })

  ipcMain.handle('config:restore', async (_, srcPath: string) => {
    // Extract zip to userData
    return true
  })
}
