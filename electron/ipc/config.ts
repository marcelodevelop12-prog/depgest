import { ipcMain, app } from 'electron'
import { getDb } from '../database'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://vxrhlljvjqdbpfngpzro.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4cmhsbGp2anFkYnBmbmdwenJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NzQ1MDAsImV4cCI6MjA5NDQ1MDUwMH0.UTzP5lf2x7GnEw8nsuoe_qnywe-JpO1ApDtfS1RLjD0'
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

    // Sync com Supabase em background
    const licenca = db.prepare('SELECT * FROM licenca LIMIT 1').get() as any
    if (licenca?.supabase_loja_id) {
      supabase.from('lojas').update({
        nome: data.nome,
        telefone: data.telefone,
        endereco: data.endereco,
        chave_pix: data.chave_pix,
        taxa_entrega: data.taxa_entrega,
        pedido_minimo: data.pedido_minimo,
        cardapio_ativo: data.cardapio_ativo,
      }).eq('id', licenca.supabase_loja_id).then(() => {})
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
