import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // Window controls
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  },

  // System
  system: {
    getVersion: () => ipcRenderer.invoke('system:get-version'),
    getUserDataPath: () => ipcRenderer.invoke('system:get-user-data-path'),
    openDialog: (options: Electron.OpenDialogOptions) => ipcRenderer.invoke('system:open-dialog', options),
    saveDialog: (options: Electron.SaveDialogOptions) => ipcRenderer.invoke('system:save-dialog', options),
    readFile: (filePath: string) => ipcRenderer.invoke('system:read-file', filePath),
    writeFile: (filePath: string, data: Buffer | string) => ipcRenderer.invoke('system:write-file', filePath, data),
    openExternal: (url: string) => ipcRenderer.invoke('system:open-external', url),
    checkUpdate: () => ipcRenderer.invoke('system:check-update'),
    onUpdateAvailable: (cb: () => void) => ipcRenderer.on('update:available', cb),
    onUpdateDownloaded: (cb: () => void) => ipcRenderer.on('update:downloaded', cb),
    installUpdate: () => ipcRenderer.send('update:install'),
  },

  // License
  licenca: {
    verificar: (chave: string) => ipcRenderer.invoke('licenca:verificar', chave),
    get: () => ipcRenderer.invoke('licenca:get'),
    getMachineId: () => ipcRenderer.invoke('licenca:get-machine-id'),
  },

  // Config / Loja
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    save: (data: Record<string, unknown>) => ipcRenderer.invoke('config:save', data),
    saveLoja: (data: Record<string, unknown>) => ipcRenderer.invoke('config:save-loja', data),
    getLoja: () => ipcRenderer.invoke('config:get-loja'),
    uploadLogo: (filePath: string) => ipcRenderer.invoke('config:upload-logo', filePath),
    backup: (destPath: string) => ipcRenderer.invoke('config:backup', destPath),
    restore: (srcPath: string) => ipcRenderer.invoke('config:restore', srcPath),
  },

  // Produtos
  produtos: {
    list: (filters?: Record<string, unknown>) => ipcRenderer.invoke('produtos:list', filters),
    get: (id: number) => ipcRenderer.invoke('produtos:get', id),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('produtos:create', data),
    update: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke('produtos:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('produtos:delete', id),
    importXml: (xmlPath: string) => ipcRenderer.invoke('produtos:import-xml', xmlPath),
    consultaEan: (ean: string) => ipcRenderer.invoke('produtos:consulta-ean', ean),
    listUnidades: (produtoId: number) => ipcRenderer.invoke('produtos:list-unidades', produtoId),
    saveUnidades: (produtoId: number, unidades: unknown[]) => ipcRenderer.invoke('produtos:save-unidades', produtoId, unidades),
    syncCardapio: (produtoIds: number[]) => ipcRenderer.invoke('produtos:sync-cardapio', produtoIds),
  },

  // Categorias
  categorias: {
    list: () => ipcRenderer.invoke('categorias:list'),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('categorias:create', data),
    update: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke('categorias:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('categorias:delete', id),
  },

  // Estoque
  estoque: {
    getSaldo: (produtoId?: number) => ipcRenderer.invoke('estoque:get-saldo', produtoId),
    movimentar: (data: Record<string, unknown>) => ipcRenderer.invoke('estoque:movimentar', data),
    listMovimentacoes: (filters?: Record<string, unknown>) => ipcRenderer.invoke('estoque:list-movimentacoes', filters),
    alertas: () => ipcRenderer.invoke('estoque:alertas'),
  },

  // Clientes
  clientes: {
    list: (filters?: Record<string, unknown>) => ipcRenderer.invoke('clientes:list', filters),
    get: (id: number) => ipcRenderer.invoke('clientes:get', id),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('clientes:create', data),
    update: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke('clientes:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('clientes:delete', id),
    getFiado: (clienteId: number) => ipcRenderer.invoke('clientes:get-fiado', clienteId),
    lancarFiado: (data: Record<string, unknown>) => ipcRenderer.invoke('clientes:lancar-fiado', data),
    pagarFiado: (data: Record<string, unknown>) => ipcRenderer.invoke('clientes:pagar-fiado', data),
    extrato: (clienteId: number, periodo?: Record<string, unknown>) => ipcRenderer.invoke('clientes:extrato', clienteId, periodo),
  },

  // Pedidos
  pedidos: {
    list: (filters?: Record<string, unknown>) => ipcRenderer.invoke('pedidos:list', filters),
    get: (id: number) => ipcRenderer.invoke('pedidos:get', id),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('pedidos:create', data),
    updateStatus: (id: number, status: string, extra?: Record<string, unknown>) => ipcRenderer.invoke('pedidos:update-status', id, status, extra),
    cancel: (id: number, motivo: string) => ipcRenderer.invoke('pedidos:cancel', id, motivo),
    getOnline: () => ipcRenderer.invoke('pedidos:get-online'),
    aceitarOnline: (pedidoOnlineId: string) => ipcRenderer.invoke('pedidos:aceitar-online', pedidoOnlineId),
    imprimir: (id: number) => ipcRenderer.invoke('pedidos:imprimir', id),
    getToken: (id: number) => ipcRenderer.invoke('pedidos:get-token', id),
  },

  // Caixa
  caixa: {
    getSessaoAtiva: () => ipcRenderer.invoke('caixa:get-sessao-ativa'),
    abrir: (valorInicial: number) => ipcRenderer.invoke('caixa:abrir', valorInicial),
    fechar: (data: Record<string, unknown>) => ipcRenderer.invoke('caixa:fechar', data),
    movimentar: (data: Record<string, unknown>) => ipcRenderer.invoke('caixa:movimentar', data),
    getResumo: () => ipcRenderer.invoke('caixa:get-resumo'),
    getHistorico: (filters?: Record<string, unknown>) => ipcRenderer.invoke('caixa:get-historico', filters),
  },

  // Motoboys
  motoboys: {
    list: () => ipcRenderer.invoke('motoboys:list'),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('motoboys:create', data),
    update: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke('motoboys:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('motoboys:delete', id),
    getEntregas: (motoboyId: number, data?: string) => ipcRenderer.invoke('motoboys:get-entregas', motoboyId, data),
  },

  // Fornecedores
  fornecedores: {
    list: () => ipcRenderer.invoke('fornecedores:list'),
    get: (id: number) => ipcRenderer.invoke('fornecedores:get', id),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('fornecedores:create', data),
    update: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke('fornecedores:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('fornecedores:delete', id),
  },

  // Compras
  compras: {
    list: (filters?: Record<string, unknown>) => ipcRenderer.invoke('compras:list', filters),
    get: (id: number) => ipcRenderer.invoke('compras:get', id),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('compras:create', data),
    receber: (id: number) => ipcRenderer.invoke('compras:receber', id),
    cancel: (id: number) => ipcRenderer.invoke('compras:cancel', id),
    importXml: (xmlPath: string) => ipcRenderer.invoke('compras:import-xml', xmlPath),
  },

  // Financeiro
  financeiro: {
    listContas: (filters?: Record<string, unknown>) => ipcRenderer.invoke('financeiro:list-contas', filters),
    createConta: (data: Record<string, unknown>) => ipcRenderer.invoke('financeiro:create-conta', data),
    pagarConta: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke('financeiro:pagar-conta', id, data),
    getFluxo: (periodo: Record<string, unknown>) => ipcRenderer.invoke('financeiro:get-fluxo', periodo),
    getDre: (periodo: Record<string, unknown>) => ipcRenderer.invoke('financeiro:get-dre', periodo),
  },

  // Relatórios
  relatorios: {
    vendas: (filters: Record<string, unknown>) => ipcRenderer.invoke('relatorios:vendas', filters),
    estoque: (filters?: Record<string, unknown>) => ipcRenderer.invoke('relatorios:estoque', filters),
    clientes: (filters?: Record<string, unknown>) => ipcRenderer.invoke('relatorios:clientes', filters),
    entregas: (filters?: Record<string, unknown>) => ipcRenderer.invoke('relatorios:entregas', filters),
    exportPdf: (tipo: string, data: unknown) => ipcRenderer.invoke('relatorios:export-pdf', tipo, data),
    exportExcel: (tipo: string, data: unknown) => ipcRenderer.invoke('relatorios:export-excel', tipo, data),
  },

  // Cardápio Online
  cardapio: {
    sync: () => ipcRenderer.invoke('cardapio:sync'),
    getProdutos: () => ipcRenderer.invoke('cardapio:get-produtos'),
    updateProdutos: (produtoIds: number[]) => ipcRenderer.invoke('cardapio:update-produtos', produtoIds),
    initRealtime: () => ipcRenderer.send('cardapio:init-realtime'),
    onPedidoNovo: (cb: (pedido: unknown) => void) => {
      ipcRenderer.on('pedido-online:novo', (_e, pedido) => cb(pedido))
    },
  },
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
