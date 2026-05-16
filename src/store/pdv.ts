import { create } from 'zustand'

export interface ItemCarrinho {
  id: string
  produto_id: number
  produto_unidade_id: number
  nome: string
  tipo: string
  quantidade: number
  preco_unitario: number
  desconto: number
  total: number
}

interface PdvState {
  itens: ItemCarrinho[]
  cliente: any | null
  desconto_global: number
  observacao: string
  addItem: (item: Omit<ItemCarrinho, 'id' | 'total'>) => void
  removeItem: (id: string) => void
  updateQuantidade: (id: string, quantidade: number) => void
  updateDesconto: (id: string, desconto: number) => void
  setDescontoGlobal: (desconto: number) => void
  setCliente: (cliente: any | null) => void
  setObservacao: (obs: string) => void
  limpar: () => void
  subtotal: () => number
  total: () => number
}

export const usePdvStore = create<PdvState>((set, get) => ({
  itens: [],
  cliente: null,
  desconto_global: 0,
  observacao: '',

  addItem: (item) => {
    const existing = get().itens.find(
      i => i.produto_unidade_id === item.produto_unidade_id
    )
    if (existing) {
      set(s => ({
        itens: s.itens.map(i =>
          i.produto_unidade_id === item.produto_unidade_id
            ? { ...i, quantidade: i.quantidade + item.quantidade, total: (i.quantidade + item.quantidade) * i.preco_unitario * (1 - i.desconto / 100) }
            : i
        )
      }))
    } else {
      const id = `${item.produto_unidade_id}-${Date.now()}`
      const total = item.quantidade * item.preco_unitario * (1 - (item.desconto || 0) / 100)
      set(s => ({ itens: [...s.itens, { ...item, id, desconto: item.desconto || 0, total }] }))
    }
  },

  removeItem: (id) => set(s => ({ itens: s.itens.filter(i => i.id !== id) })),

  updateQuantidade: (id, quantidade) => {
    if (quantidade <= 0) {
      set(s => ({ itens: s.itens.filter(i => i.id !== id) }))
      return
    }
    set(s => ({
      itens: s.itens.map(i =>
        i.id === id ? { ...i, quantidade, total: quantidade * i.preco_unitario * (1 - i.desconto / 100) } : i
      )
    }))
  },

  updateDesconto: (id, desconto) => {
    set(s => ({
      itens: s.itens.map(i =>
        i.id === id ? { ...i, desconto, total: i.quantidade * i.preco_unitario * (1 - desconto / 100) } : i
      )
    }))
  },

  setDescontoGlobal: (desconto) => set({ desconto_global: desconto }),
  setCliente: (cliente) => set({ cliente }),
  setObservacao: (observacao) => set({ observacao }),

  limpar: () => set({ itens: [], cliente: null, desconto_global: 0, observacao: '' }),

  subtotal: () => get().itens.reduce((s, i) => s + i.total, 0),
  total: () => {
    const sub = get().subtotal()
    const desc = get().desconto_global
    return sub * (1 - desc / 100)
  },
}))
