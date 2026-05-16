import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
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
      if (!loja?.loja_nome) {
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
      <Layout>
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
