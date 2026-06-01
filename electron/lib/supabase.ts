import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import path from 'path'
import fs from 'fs'

// Carrega .env.electron do diretório raiz do projeto (apenas em dev)
// __dirname em dev = dist-electron/lib/ → ../../ chega na raiz do projeto
function loadEnvElectron() {
  const candidates = [
    path.join(__dirname, '..', '..', '.env.electron'),   // dist-electron/lib/ → raiz
    path.join(__dirname, '..', '.env.electron'),          // dist-electron/ → raiz (fallback)
    path.join(process.cwd(), '.env.electron'),            // cwd (fallback)
  ]
  for (const envPath of candidates) {
    try {
      if (!fs.existsSync(envPath)) continue
      for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
        const t = line.trim()
        if (!t || t.startsWith('#')) continue
        const i = t.indexOf('=')
        if (i === -1) continue
        const k = t.slice(0, i).trim()
        const v = t.slice(i + 1).trim()
        if (k && !process.env[k]) process.env[k] = v
      }
      return // carregou com sucesso, para no primeiro candidato válido
    } catch {}
  }
}
loadEnvElectron()

const SUPABASE_URL = 'https://vxrhlljvjqdbpfngpzro.supabase.co'
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4cmhsbGp2anFkYnBmbmdwenJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NzQ1MDAsImV4cCI6MjA5NDQ1MDUwMH0.UTzP5lf2x7GnEw8nsuoe_qnywe-JpO1ApDtfS1RLjD0'

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

// true quando o app está usando a service_role (admin); false = fallback anon (sem permissão de escrita/storage)
export const hasServiceKey = !!SERVICE_KEY

if (!SERVICE_KEY) {
  console.warn(
    '[supabase] SUPABASE_SERVICE_ROLE_KEY não definida — ' +
      'usando anon key como fallback. Adicione a chave em .env.electron antes de ir a produção.'
  )
}

// Usado apenas pelo cardápio público (vercel-app) via anon
export const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  realtime: { transport: ws as any },
})

// Usado pelo processo main do Electron para todas as operações admin.
// Service_role bypassa RLS completamente — nunca expor no renderer/browser.
export const supabaseAdmin = SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
      realtime: { transport: ws as any },
    })
  : supabase
