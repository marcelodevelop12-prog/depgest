import { useEffect, useState, Component, ReactNode } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error
      return (
        <div style={{ padding: 32, fontFamily: 'monospace', background: '#1a1a1a', color: '#fff', minHeight: '100vh' }}>
          <h2 style={{ color: '#EF4444', marginBottom: 16 }}>Erro de renderização</h2>
          <pre style={{ background: '#2a2a2a', padding: 16, borderRadius: 8, whiteSpace: 'pre-wrap', color: '#fca5a5' }}>{err.message}</pre>
          <pre style={{ background: '#2a2a2a', padding: 16, borderRadius: 8, whiteSpace: 'pre-wrap', color: '#9ca3af', marginTop: 8, fontSize: 11 }}>{err.stack}</pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 16, padding: '8px 16px', background: '#F5A623', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#000', fontWeight: 'bold' }}>Tentar novamente</button>
        </div>
      )
    }
    return this.props.children
  }
}
import { Toaster } from 'react-hot-toast'
import { useAppStore } from './store/app'
import Ativacao from './pages/Ativacao'
import Onboarding from './pages/Onboarding'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import PDV from './pages/PDV'
import Pedidos from './pages/Pedidos'
import Produtos from './pages/Produtos'
import Estoque from './pages/Estoque'
import Clientes from './pages/Clientes'
import Fornecedores from './pages/Fornecedores'
import Compras from './pages/Compras'
import Caixa from './pages/Caixa'
import Entregas from './pages/Entregas'
import Financeiro from './pages/Financeiro'
import Relatorios from './pages/Relatorios'
import Cardapio from './pages/Cardapio'
import Configuracoes from './pages/Configuracoes'

type AppStatus = 'loading' | 'sem-licenca' | 'onboarding' | 'app'

function UpdateBanner() {
  const [show, setShow] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    if (!window.api) return
    window.api.system.onUpdateDownloaded(() => setShow(true))
  }, [])

  if (!show) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] flex items-center justify-between gap-4 px-6 py-3"
      style={{ background: '#1a3a1a', borderTop: '2px solid #22C55E' }}>
      <div className="flex items-center gap-3">
        <span style={{ fontSize: 20 }}>🎉</span>
        <div>
          <p className="text-sm font-semibold" style={{ color: '#22C55E' }}>Atualização pronta para instalar!</p>
          <p className="text-xs" style={{ color: '#86efac' }}>Uma nova versão do DepGest foi baixada. Reinicie para aplicar.</p>
        </div>
      </div>
      <button
        onClick={() => { setInstalling(true); window.api?.system.installUpdate() }}
        disabled={installing}
        className="flex-shrink-0 px-5 py-2 rounded-xl text-sm font-bold disabled:opacity-60"
        style={{ background: '#22C55E', color: '#000' }}>
        {installing ? 'Reiniciando...' : '⟳ Reiniciar e atualizar'}
      </button>
    </div>
  )
}

export default function App() {
  const [status, setStatus] = useState<AppStatus>('loading')
  const { setTema, setLicenca, setLoja } = useAppStore()

  useEffect(() => {
    async function init() {
      // Se não estiver no Electron (dev web), simula app
      if (!window.api) {
        setStatus('app')
        return
      }

      // Carrega tema
      const config = await window.api.config.get()
      setTema((config.tema as 'dark' | 'light') || 'dark')
      if (config.tema === 'light') {
        document.documentElement.classList.add('light')
      }

      // Verifica licença
      const licenca = await window.api.licenca.get()
      if (!licenca || !licenca.ativa) {
        setStatus('sem-licenca')
        return
      }

      setLicenca(licenca)

      // Verifica se loja está configurada
      const loja = await window.api.config.getLoja()
      if (!loja?.nome) {
        setStatus('onboarding')
        return
      }

      setLoja(loja)
      setStatus('app')
    }

    init()
  }, [setTema, setLicenca, setLoja])

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg)' }}>
        <div className="text-center">
          <div className="text-4xl font-bold mb-2" style={{ color: '#F5A623' }}>DepGest</div>
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Carregando...</div>
        </div>
      </div>
    )
  }

  if (status === 'sem-licenca') {
    return (
      <>
        <Ativacao onSuccess={() => setStatus('onboarding')} />
        <Toaster position="bottom-right" toastOptions={{ style: { background: '#1A1A1A', color: '#fff', border: '1px solid #2A2A2A' } }} />
      </>
    )
  }

  if (status === 'onboarding') {
    return (
      <>
        <Onboarding onComplete={() => setStatus('app')} />
        <Toaster position="bottom-right" toastOptions={{ style: { background: '#1A1A1A', color: '#fff', border: '1px solid #2A2A2A' } }} />
      </>
    )
  }

  return (
    <HashRouter>
      <UpdateBanner />
      <Layout>
        <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/pdv" element={<PDV />} />
          <Route path="/pedidos" element={<Pedidos />} />
          <Route path="/produtos" element={<Produtos />} />
          <Route path="/estoque" element={<Estoque />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/fornecedores" element={<Fornecedores />} />
          <Route path="/compras" element={<Compras />} />
          <Route path="/caixa" element={<Caixa />} />
          <Route path="/entregas" element={<Entregas />} />
          <Route path="/financeiro" element={<Financeiro />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/cardapio" element={<Cardapio />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
        </Routes>
        </ErrorBoundary>
      </Layout>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: { background: '#1A1A1A', color: '#fff', border: '1px solid #2A2A2A' },
          success: { iconTheme: { primary: '#22C55E', secondary: '#fff' } },
          error: { iconTheme: { primary: '#EF4444', secondary: '#fff' } },
        }}
      />
    </HashRouter>
  )
}
