import { ipcMain, app } from 'electron'
import Database from 'better-sqlite3'
import { getDb } from '../database'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'
import { supabaseAdmin as supabase, supabase as supabaseAnon } from '../lib/supabase'

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
        const { data: lic, error: licErr } = await supabase
          .from('licencas')
          .select('id')
          .eq('chave', licenca.chave)
          .single()
        if (licErr || !lic?.id) {
          console.error('[config:save-loja] lookup licenca_id erro:', licErr?.message)
          return { ok: false, error: licErr?.message || 'Licença não encontrada no Supabase', payload }
        }
        const insertPayload = { ...payload, licenca_id: lic.id }
        const { data: inserted, error } = await supabase.from('lojas').insert(insertPayload).select('id').single()
        if (error) {
          console.error('[config:save-loja] INSERT erro:', error.message, error.details, error.hint)
          return { ok: false, error: error.message, payload: insertPayload }
        } else if (inserted?.id) {
          db.prepare('UPDATE licenca SET supabase_loja_id = ?').run(inserted.id)
          return { ok: true, payload: insertPayload }
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
    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error('Arquivo de imagem não encontrado')
    }

    const licenca = db.prepare('SELECT * FROM licenca LIMIT 1').get() as any
    const ext = path.extname(filePath).slice(1).toLowerCase() || 'jpg'

    let fileBuffer: Buffer
    try {
      fileBuffer = fs.readFileSync(filePath)
    } catch (e: any) {
      throw new Error('Não foi possível ler a imagem: ' + (e?.message || 'erro de leitura'))
    }

    // Upload via Edge Function (a chave admin fica no servidor; o app usa a chave pública).
    const { data, error } = await supabaseAnon.functions.invoke('upload-logo', {
      body: {
        fileBase64: fileBuffer.toString('base64'),
        ext,
        lojaId: licenca?.supabase_loja_id || null,
      },
    })

    if (error) throw new Error('Falha no envio do logo: ' + error.message)
    const publicUrl = (data as any)?.publicUrl
    if (!publicUrl) {
      const serverErr = (data as any)?.error
      throw new Error('Falha no envio do logo: ' + (serverErr || 'resposta inválida do servidor'))
    }

    db.prepare('INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES (?, ?)').run('loja_logo_url', publicUrl)

    return publicUrl
  })

  ipcMain.handle('config:backup', async (_, destPath: string) => {
    const dbCopy = destPath.replace(/\.zip$/i, '.db')

    // Online backup do better-sqlite3: gera um .db consistente mesmo com WAL
    // ativo (não basta copiar o arquivo, pois dados podem estar no -wal).
    await getDb().backup(dbCopy)

    // Se o destino for .zip, comprime via PowerShell (Windows)
    if (destPath.toLowerCase().endsWith('.zip')) {
      try {
        execSync(`powershell -command "Compress-Archive -LiteralPath '${dbCopy}' -DestinationPath '${destPath}' -Force"`)
        fs.unlinkSync(dbCopy)
      } catch {
        // Se o zip falhar, mantém a cópia .db ao lado
      }
    }

    return true
  })

  ipcMain.handle('config:restore', async (_, srcPath: string) => {
    const userDataPath = app.getPath('userData')
    const dbPath = path.join(userDataPath, 'depgest.db')

    let dbToRestore = srcPath

    // Se for .zip, extrai e localiza o .db dentro
    if (srcPath.toLowerCase().endsWith('.zip')) {
      const tmpDir = path.join(userDataPath, '_restore_tmp')
      try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
      fs.mkdirSync(tmpDir, { recursive: true })
      try {
        execSync(`powershell -command "Expand-Archive -LiteralPath '${srcPath}' -DestinationPath '${tmpDir}' -Force"`)
      } catch (e: any) {
        return { ok: false, error: 'Falha ao extrair o backup (.zip)' }
      }
      const dbFile = fs.readdirSync(tmpDir).find(f => f.toLowerCase().endsWith('.db'))
      if (!dbFile) return { ok: false, error: 'Backup inválido: nenhum arquivo .db encontrado' }
      dbToRestore = path.join(tmpDir, dbFile)
    }

    if (!fs.existsSync(dbToRestore)) {
      return { ok: false, error: 'Arquivo de backup não encontrado' }
    }

    // Valida que é um SQLite do DepGest (tem a tabela licenca) ANTES de sobrescrever
    try {
      const test = new Database(dbToRestore, { readonly: true })
      const ok = test.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='licenca'").get()
      test.close()
      if (!ok) return { ok: false, error: 'Backup inválido: não parece ser um backup do DepGest' }
    } catch {
      return { ok: false, error: 'Backup corrompido ou ilegível' }
    }

    // Salva o banco atual como segurança antes de substituir
    try { fs.copyFileSync(dbPath, dbPath + '.pre-restore') } catch {}

    // Fecha a conexão atual e substitui o arquivo
    try { getDb().close() } catch {}
    fs.copyFileSync(dbToRestore, dbPath)
    // Remove WAL/SHM antigos para não sobrepor dados do banco restaurado
    for (const ext of ['-wal', '-shm']) {
      try { fs.unlinkSync(dbPath + ext) } catch {}
    }

    // Reinicia o app para carregar o banco restaurado
    app.relaunch()
    app.exit(0)
    return { ok: true }
  })
}
