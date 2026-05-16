import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'
import path from 'path'
import fs from 'fs'
import { initDatabase } from './database'
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

  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

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

  ipcMain.handle('system:read-file', async (_, filePath: string) => {
    return fs.readFileSync(filePath)
  })

  ipcMain.handle('system:write-file', async (_, filePath: string, data: Buffer | string) => {
    fs.writeFileSync(filePath, data)
    return true
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
