import { ReactNode, useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, Package, PackageSearch, Users, Truck,
  Store, ShoppingBag, Wallet, BarChart3, Globe, Settings, ChevronLeft,
  ChevronRight, Minus, Maximize2, X, Bell, Box
} from 'lucide-react'
import { useAppStore } from '../store/app'
import { cn } from '../lib/utils'

const NAV = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/pdv', icon: ShoppingCart, label: 'PDV', highlight: true },
  { path: '/pedidos', icon: Box, label: 'Pedidos' },
  { path: '/produtos', icon: Package, label: 'Produtos' },
  { path: '/estoque', icon: PackageSearch, label: 'Estoque' },
  { path: '/clientes', icon: Users, label: 'Clientes' },
  { path: '/entregas', icon: Truck, label: 'Entregas' },
  { path: '/fornecedores', icon: Store, label: 'Fornecedores' },
  { path: '/compras', icon: ShoppingBag, label: 'Compras' },
  { path: '/caixa', icon: Wallet, label: 'Caixa' },
  { path: '/financeiro', icon: BarChart3, label: 'Financeiro' },
  { path: '/relatorios', icon: BarChart3, label: 'Relatórios' },
  { path: '/cardapio', icon: Globe, label: 'Cardápio Online' },
  { path: '/configuracoes', icon: Settings, label: 'Configurações' },
]

interface Props { children: ReactNode }

export default function Layout({ children }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const { loja, alertas } = useAppStore()
  const [collapsed, setCollapsed] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)

  const isElectron = !!window.api

  useEffect(() => {
    if (!isElectron) return
    window.api.window.isMaximized().then(setIsMaximized)
  }, [isElectron])

  function navTo(path: string) {
    navigate(path)
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Titlebar */}
      <div className="titlebar-drag flex-shrink-0 flex items-center h-9 px-3 gap-3"
        style={{ background: 'var(--sidebar)', borderBottom: '1px solid var(--border)' }}>
        <span className="font-bold text-sm titlebar-nodrag" style={{ color: '#F5A623' }}>DepGest</span>
        {loja?.loja_nome && (
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            — {loja.loja_nome}
          </span>
        )}

        {/* Alertas */}
        {alertas.pedidosOnline > 0 && (
          <div className="titlebar-nodrag flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer"
            style={{ background: '#F5A62320', color: '#F5A623' }}
            onClick={() => navTo('/pedidos')}>
            <Bell size={10} />
            {alertas.pedidosOnline} online
          </div>
        )}

        <div className="ml-auto titlebar-nodrag flex items-center gap-1">
          {isElectron && (
            <>
              <button onClick={() => window.api.window.minimize()}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
                style={{ color: 'var(--text-secondary)' }}>
                <Minus size={14} />
              </button>
              <button onClick={() => { window.api.window.maximize(); setIsMaximized(m => !m) }}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
                style={{ color: 'var(--text-secondary)' }}>
                <Maximize2 size={14} />
              </button>
              <button onClick={() => window.api.window.close()}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 transition-colors"
                style={{ color: 'var(--text-secondary)' }}>
                <X size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div
          className="flex-shrink-0 flex flex-col transition-all duration-200 overflow-hidden"
          style={{
            width: collapsed ? 56 : 200,
            background: 'var(--sidebar)',
            borderRight: '1px solid var(--border)',
          }}>
          <div className="flex-1 py-2 overflow-y-auto scroll-area">
            {NAV.map(item => {
              const Icon = item.icon
              const active = location.pathname === item.path
              const badge = item.path === '/pedidos' && alertas.pedidosOnline > 0
                ? alertas.pedidosOnline : null

              return (
                <button
                  key={item.path}
                  onClick={() => navTo(item.path)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors relative',
                    active ? 'text-white' : 'hover:text-white'
                  )}
                  style={{
                    color: active ? '#fff' : 'var(--text-secondary)',
                    background: active ? '#F5A62318' : 'transparent',
                    borderRight: active ? '2px solid #F5A623' : '2px solid transparent',
                  }}
                  title={collapsed ? item.label : undefined}>
                  <div className="flex-shrink-0">
                    <Icon size={18} style={{ color: active ? '#F5A623' : undefined }} />
                  </div>
                  {!collapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                  {badge && (
                    <div className="ml-auto w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: '#F5A623', color: '#000' }}>
                      {badge}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="flex items-center justify-center h-10 transition-colors hover:text-white"
            style={{ color: 'var(--text-secondary)', borderTop: '1px solid var(--border)' }}>
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  )
}
