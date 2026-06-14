export interface ElectronAPI {
  window: {
    minimize: () => void
    maximize: () => void
    close: () => void
    isMaximized: () => Promise<boolean>
  }
  system: {
    getVersion: () => Promise<string>
    getUserDataPath: () => Promise<string>
    openDialog: (options: any) => Promise<any>
    saveDialog: (options: any) => Promise<any>
    openExternal: (url: string) => Promise<void>
    checkUpdate: () => Promise<any>
    onUpdateAvailable: (cb: () => void) => void
    onUpdateDownloaded: (cb: () => void) => void
    installUpdate: () => void
  }
  licenca: {
    verificar: (chave: string) => Promise<{ ok: boolean; erro?: string; licenca?: any }>
    validar: () => Promise<{ liberado: boolean; bloqueada?: boolean; offline?: boolean; motivo?: string }>
    get: () => Promise<any>
    getMachineId: () => Promise<string>
  }
  config: {
    get: () => Promise<Record<string, string>>
    save: (data: Record<string, unknown>) => Promise<boolean>
    saveLoja: (data: Record<string, unknown>) => Promise<any>
    getLoja: () => Promise<any>
    uploadLogo: (filePath: string) => Promise<string>
    backup: (destPath: string) => Promise<boolean>
    restore: (srcPath: string) => Promise<boolean | { ok: boolean; error?: string }>
  }
  produtos: {
    list: (filters?: any) => Promise<any[]>
    get: (id: number) => Promise<any>
    create: (data: any) => Promise<{ id: number }>
    update: (id: number, data: any) => Promise<{ ok: boolean; error?: string } | boolean>
    delete: (id: number) => Promise<boolean>
    importXml: (xmlPath: string) => Promise<any>
    confirmarImport: (items: any[]) => Promise<{ ok: boolean; importados: number; atualizados: number }>
    consultaEan: (ean: string) => Promise<any>
    listUnidades: (produtoId: number) => Promise<any[]>
    saveUnidades: (produtoId: number, unidades: any[]) => Promise<boolean>
    syncCardapio: (produtoIds: number[]) => Promise<any>
  }
  categorias: {
    list: () => Promise<any[]>
    create: (data: any) => Promise<{ id: number }>
    update: (id: number, data: any) => Promise<boolean>
    delete: (id: number) => Promise<boolean>
  }
  estoque: {
    getSaldo: (produtoId?: number) => Promise<any>
    movimentar: (data: any) => Promise<any>
    listMovimentacoes: (filters?: any) => Promise<any[]>
    alertas: () => Promise<any[]>
  }
  clientes: {
    list: (filters?: any) => Promise<any[]>
    get: (id: number) => Promise<any>
    create: (data: any) => Promise<{ id: number }>
    update: (id: number, data: any) => Promise<boolean>
    delete: (id: number) => Promise<boolean>
    getFiado: (clienteId: number) => Promise<any>
    lancarFiado: (data: any) => Promise<any>
    pagarFiado: (data: any) => Promise<any>
    extrato: (clienteId: number, periodo?: any) => Promise<any[]>
    fecharCiclo: (data: any) => Promise<any>
    listCiclos: (clienteId: number) => Promise<any[]>
    cicloMovimentacoes: (cicloId: number) => Promise<any[]>
  }
  pedidos: {
    list: (filters?: any) => Promise<any[]>
    get: (id: number) => Promise<any>
    create: (data: any) => Promise<{ id: number; numero: string; token: string }>
    updateStatus: (id: number, status: string, extra?: any) => Promise<boolean>
    cancel: (id: number, motivo: string) => Promise<boolean>
    getOnline: () => Promise<any[]>
    aceitarOnline: (pedidoOnlineId: string) => Promise<any>
    imprimir: (id: number) => Promise<boolean>
    getToken: (id: number) => Promise<string>
  }
  caixa: {
    getSessaoAtiva: () => Promise<any>
    abrir: (valorInicial: number) => Promise<any>
    fechar: (data: any) => Promise<any>
    movimentar: (data: any) => Promise<any>
    getResumo: () => Promise<any>
    getHistorico: (filters?: any) => Promise<any[]>
    listMovimentacoes: (sessaoId?: number) => Promise<any[]>
  }
  motoboys: {
    list: () => Promise<any[]>
    create: (data: any) => Promise<{ id: number }>
    update: (id: number, data: any) => Promise<boolean>
    delete: (id: number) => Promise<boolean>
    getEntregas: (motoboyId: number, data?: string) => Promise<any[]>
  }
  fornecedores: {
    list: () => Promise<any[]>
    get: (id: number) => Promise<any>
    create: (data: any) => Promise<{ id: number }>
    update: (id: number, data: any) => Promise<boolean>
    delete: (id: number) => Promise<boolean>
  }
  compras: {
    list: (filters?: any) => Promise<any[]>
    get: (id: number) => Promise<any>
    create: (data: any) => Promise<{ id: number }>
    receber: (id: number) => Promise<boolean>
    cancel: (id: number) => Promise<boolean>
    importXml: (xmlPath: string) => Promise<any>
  }
  financeiro: {
    listContas: (filters?: any) => Promise<any[]>
    createConta: (data: any) => Promise<{ id: number }>
    pagarConta: (id: number, data: any) => Promise<boolean>
    getFluxo: (periodo: any) => Promise<any>
    getDre: (periodo: any) => Promise<any>
  }
  relatorios: {
    vendas: (filters: any) => Promise<any>
    estoque: (filters?: any) => Promise<any>
    clientes: (filters?: any) => Promise<any>
    entregas: (filters?: any) => Promise<any>
    exportPdf: (tipo: string, data: any) => Promise<any>
    exportExcel: (tipo: string, data: any) => Promise<any>
  }
  cardapio: {
    sync: () => Promise<any>
    getProdutos: () => Promise<any[]>
    updateProdutos: (produtoIds: number[]) => Promise<any>
    getFotos: () => Promise<Record<number, string>>
    uploadFoto: (produtoLocalId: string, filePath: string) => Promise<{ ok: boolean; foto_url?: string; foto_path?: string; erro?: string }>
    initRealtime: () => void
    onPedidoNovo: (cb: (pedido: unknown) => void) => void
  }
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
