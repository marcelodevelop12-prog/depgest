import { ipcMain, app } from 'electron'
import { getDb } from '../database'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'
import { supabaseAdmin as supabase } from '../lib/supabase'

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
      'taxa_entrega', 'pedido_minimo', 'raio_entrega_km', 'cardapio_ativo', 'horario_funcionamento',
      'tempo_entrega', 'tempo_retirada', 'formas_pagamento']

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
    const configs = db.prepare("SELECT chave, valor FROM configuracoes WHERE chave LIKE 'loja_%'").all() as any[]
    const saved = Object.fromEntries(configs.map(r => [r.chave.replace('loja_', ''), r.valor]))

    const nfc = (v: any) => typeof v === 'string' ? v.normalize('NFC') : v

    // Campos fixos (nome, telefone, etc.) vêm do SQLite; campos dinâmicos preferem data com fallback para saved
    const logoUrl = (data.logo_url as string) || saved.logo_url || null
    const taxaEntrega = data.taxa_entrega !== undefined ? Number(data.taxa_entrega) : (saved.taxa_entrega ? Number(saved.taxa_entrega) : null)
    const pedidoMinimo = data.pedido_minimo !== undefined ? Number(data.pedido_minimo) : (saved.pedido_minimo ? Number(saved.pedido_minimo) : null)
    const cardapioAtivo = data.cardapio_ativo !== undefined
      ? (data.cardapio_ativo === 'true' || data.cardapio_ativo === true)
      : (saved.cardapio_ativo === 'true')
    const tempoEntrega = (data.tempo_entrega as string) || saved.tempo_entrega || null
    const tempoRetirada = (data.tempo_retirada as string) || saved.tempo_retirada || null
    const formasPagamento = (data.formas_pagamento as string) || saved.formas_pagamento || null

    const payload = {
      nome: nfc(saved.nome),
      codigo: nfc(saved.codigo),
      telefone: nfc(saved.telefone),
      endereco: nfc(saved.endereco),
      chave_pix: nfc(saved.chave_pix),
      logo_url: logoUrl,
      taxa_entrega: taxaEntrega,
      pedido_minimo: pedidoMinimo,
      cardapio_ativo: cardapioAtivo,
      tempo_entrega: tempoEntrega,
      tempo_retirada: tempoRetirada,
      formas_pagamento: formasPagamento,
    }

    console.log('[config:save-loja] licenca.supabase_loja_id:', licenca?.supabase_loja_id ?? 'NULL')
    console.log('[config:save-loja] payload Supabase:', JSON.stringify(payload))

    if (licenca?.supabase_loja_id) {
      const { data: updated, error } = await supabase
        .from('lojas')
        .update(payload)
        .eq('id', licenca.supabase_loja_id)
        .select('tempo_entrega,tempo_retirada,formas_pagamento,taxa_entrega,cardapio_ativo')
        .single()

      if (error) {
        console.error('[config:save-loja] UPDATE erro:', error.message, error.details)
        return { ok: false, error: error.message, payload }
      }
      console.log('[config:save-loja] UPDATE ok:', JSON.stringify(updated))
      return { ok: true, updated, payload }
    } else {
      console.log('[config:save-loja] → INSERT novo registro')
      try {
        const { data: inserted, error } = await supabase.from('lojas').insert(payload).select('id').single()
        if (error) {
          console.error('[config:save-loja] INSERT erro:', error.message, error.details, error.hint)
          return { ok: false, error: error.message, payload }
        } else if (inserted?.id) {
          db.prepare('UPDATE licenca SET supabase_loja_id = ?').run(inserted.id)
          return { ok: true, payload }
        }
      } catch (e: any) {
        console.error('[config:save-loja] INSERT exception:', e?.message)
        return { ok: false, error: e?.message, payload }
      }
    }

    return { ok: true, payload }
  })

  ipcMain.handle('config:upload-logo', async (_, filePath: string) => {
    const db = getDb()
    const licenca = db.prepare('SELECT * FROM licenca LIMIT 1').get() as any

    const ext = path.extname(filePath).slice(1).toLowerCase() || 'jpg'
    const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
    const storagePath = `logos/${licenca?.supabase_loja_id || 'loja'}/${Date.now()}.${ext}`

    const fileBuffer = fs.readFileSync(filePath)

    const { error } = await supabase.storage
      .from('lojas')
      .upload(storagePath, fileBuffer, { contentType: mimeType, upsert: true })

    if (error) throw new Error(error.message)

    const { data: { publicUrl } } = supabase.storage.from('lojas').getPublicUrl(storagePath)

    db.prepare('INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES (?, ?)').run('loja_logo_url', publicUrl)

    if (licenca?.supabase_loja_id) {
      supabase.from('lojas').update({ logo_url: publicUrl }).eq('id', licenca.supabase_loja_id).then(() => {})
    }

    return publicUrl
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
