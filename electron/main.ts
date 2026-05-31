import { app, BrowserWindow, ipcMain, shell, dialog, Notification, protocol, net } from 'electron'
import { autoUpdater } from 'electron-updater'
import path from 'path'
import { initDatabase, getDb } from './database'
import { supabaseAdmin as supabase } from './lib/supabase'
import { registerLicenseHandlers } from './ipc/licenca'
import { registerProdutoHandlers } from './ipc/produtos'
import { registerClienteHandlers } from './ipc/clientes'
import { registerPedidoHandlers } from './ipc/pedidos'
import { registerCaixaHandlers } from './ipc/caixa'
import { registerEstoqueHandlers } from './ipc/estoque'
import { registerFornecedorHandlers } from './ipc/fornecedores'
import { registerMotoboyHandlers } from './ipc/motoboys'
import { registerFinanceiroHandlers } from './ipc/financeiro'
import { registerConfigHandlers } from './ipc/config'
import { registerRelatorioHandlers } from './ipc/relatorios'
import { registerCardapioHandlers } from './ipc/cardapio'
import { startLocalServer } from './server'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// Deve ser chamado ANTES do app.whenReady()
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-image', privileges: { secure: true, standard: true, supportFetchAPI: true } },
])

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0D0D0D',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: path.join(__dirname, '../public/icon.ico'),
    show: false,
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(async () => {
  // Protocolo para servir imagens locais sem restrições de CSP/origem
  protocol.handle('local-image', (request) => {
    // URL: local-image://C:/Users/.../foto.jpg
    const filePath = decodeURIComponent(request.url.slice('local-image://'.length))
    return net.fetch('file:///' + filePath.replace(/\\/g, '/'))
  })

  const userDataPath = app.getPath('userData')
  const dbPath = path.join(userDataPath, 'depgest.db')

  initDatabase(dbPath)
  startLocalServer()

  registerLicenseHandlers()
  registerProdutoHandlers()
  registerClienteHandlers()
  registerPedidoHandlers()
  registerCaixaHandlers()
  registerEstoqueHandlers()
  registerFornecedorHandlers()
  registerMotoboyHandlers()
  registerFinanceiroHandlers()
  registerConfigHandlers()
  registerRelatorioHandlers()
  registerCardapioHandlers()

  registerWindowHandlers()
  registerSystemHandlers()

  createWindow()

  // Inicia listener de pedidos online (se licença já ativa)
  tryStartPedidosRealtime()

  // Permite re-inicializar após ativação de licença
  ipcMain.on('cardapio:init-realtime', () => tryStartPedidosRealtime())

  if (!isDev) {
    autoUpdater.checkForUpdates()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

let realtimeStarted = false

function tryStartPedidosRealtime() {
  if (realtimeStarted) return
  try {
    const licenca = getDb().prepare('SELECT supabase_loja_id, ativa FROM licenca LIMIT 1').get() as any
    if (!licenca?.ativa || !licenca.supabase_loja_id) return

    const lojaId = licenca.supabase_loja_id
    realtimeStarted = true

    supabase
      .channel('pedidos-online-desktop')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pedidos_online', filter: `loja_id=eq.${lojaId}` },
        (payload) => {
          const pedido = payload.new as any

          // Envia para o renderer (atualiza badge/contador na UI)
          mainWindow?.webContents.send('pedido-online:novo', pedido)

          // Notificação nativa do Windows
          if (Notification.isSupported()) {
            const total = Number(pedido.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
            new Notification({
              title: 'Novo pedido online!',
              body: `${pedido.cliente_nome} · ${total}`,
              icon: path.join(__dirname, '../public/icon.ico'),
            }).show()
          }
        }
      )
      .subscribe()
  } catch {
    // BD ainda não inicializado ou licença inexistente — silencioso
  }
}

function registerWindowHandlers() {
  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })
  ipcMain.on('window:close', () => mainWindow?.close())
  ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized())
}

function registerSystemHandlers() {
  ipcMain.handle('system:get-version', () => app.getVersion())
  ipcMain.handle('system:get-user-data-path', () => app.getPath('userData'))

  ipcMain.handle('system:open-dialog', async (_, options) => {
    const result = await dialog.showOpenDialog(mainWindow!, options)
    return result
  })

  ipcMain.handle('system:save-dialog', async (_, options) => {
    const result = await dialog.showSaveDialog(mainWindow!, options)
    return result
  })

  ipcMain.handle('system:open-external', async (_, url: string) => {
    await shell.openExternal(url)
  })

  ipcMain.handle('system:check-update', async () => {
    if (!isDev) {
      return await autoUpdater.checkForUpdates()
    }
    return null
  })

  autoUpdater.on('update-available', () => {
    mainWindow?.webContents.send('update:available')
  })

  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('update:downloaded')
  })

  ipcMain.on('update:install', () => {
    autoUpdater.quitAndInstall()
  })
}
