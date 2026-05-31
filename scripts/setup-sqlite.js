/**
 * setup-sqlite.js
 * Baixa o binário pré-compilado do better-sqlite3 para o Electron instalado,
 * sem precisar de Visual Studio Build Tools.
 *
 * Executado automaticamente via `postinstall` no package.json.
 * Pode ser rodado manualmente com: node scripts/setup-sqlite.js
 */

const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const ROOT = path.resolve(__dirname, '..')
const SQLITE_DIR = path.join(ROOT, 'node_modules', 'better-sqlite3')
const PREBUILD_BIN = path.join(ROOT, 'node_modules', '.bin', 'prebuild-install')

// Lê a versão do Electron instalado
let electronVersion
try {
  electronVersion = require(path.join(ROOT, 'node_modules', 'electron', 'package.json')).version
} catch {
  console.error('[setup-sqlite] Electron não encontrado em node_modules. Rode npm install primeiro.')
  process.exit(1)
}

console.log(`[setup-sqlite] Electron ${electronVersion} detectado`)
console.log('[setup-sqlite] Baixando prebuilt do better-sqlite3 para Electron...')

const cmd = [
  `"${PREBUILD_BIN}"`,
  `--runtime electron`,
  `--target ${electronVersion}`,
  `--arch x64`,
  `--tag-prefix v`,
].join(' ')

try {
  execSync(cmd, {
    cwd: SQLITE_DIR,
    stdio: 'inherit',
    shell: true,
  })
  console.log('[setup-sqlite] ✓ Prebuilt instalado com sucesso — sem necessidade de compilação.')
} catch (e) {
  console.warn('[setup-sqlite] ⚠ Download do prebuilt falhou. Tentando electron-rebuild...')
  try {
    execSync('npx electron-rebuild -w better-sqlite3 -f', {
      cwd: ROOT,
      stdio: 'inherit',
      shell: true,
    })
    console.log('[setup-sqlite] ✓ electron-rebuild concluído.')
  } catch (e2) {
    console.error('[setup-sqlite] ✗ Falha ao preparar better-sqlite3.')
    console.error('  Solução: instale o Visual Studio Build Tools em https://visualstudio.microsoft.com/visual-cpp-build-tools/')
    // Não encerra com erro para não bloquear npm install dos demais pacotes
  }
}
