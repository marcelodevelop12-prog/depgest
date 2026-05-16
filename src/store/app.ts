import { create } from 'zustand'

interface AppState {
  tema: 'dark' | 'light'
  licenca: any | null
  loja: any | null
  caixaAtivo: boolean
  alertas: { estoqueMinimo: number; contasVencer: number; fiadoAlto: number; pedidosOnline: number }
  setTema: (tema: 'dark' | 'light') => void
  setLicenca: (licenca: any) => void
  setLoja: (loja: any) => void
  setCaixaAtivo: (ativo: boolean) => void
  setAlertas: (alertas: Partial<AppState['alertas']>) => void
}

export const useAppStore = create<AppState>((set) => ({
  tema: 'dark',
  licenca: null,
  loja: null,
  caixaAtivo: false,
  alertas: { estoqueMinimo: 0, contasVencer: 0, fiadoAlto: 0, pedidosOnline: 0 },

  setTema: (tema) => {
    set({ tema })
    if (tema === 'dark') {
      document.documentElement.classList.remove('light')
    } else {
      document.documentElement.classList.add('light')
    }
  },

  setLicenca: (licenca) => set({ licenca }),
  setLoja: (loja) => set({ loja }),
  setCaixaAtivo: (caixaAtivo) => set({ caixaAtivo }),
  setAlertas: (alertas) => set(s => ({ alertas: { ...s.alertas, ...alertas } })),
}))
