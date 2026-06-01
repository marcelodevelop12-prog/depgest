import { useEffect, useState } from 'react'
import { ShoppingCart, Package, Clock, CheckCircle, AlertTriangle, TrendingUp, Users, Wallet } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency, formatDateTime, statusLabel } from '../lib/utils'
import { useNavigate } from 'react-router-dom'

interface DashData {
  totalVendasHoje: number
  pedidosHoje: number
  pedidosAbertos: number
  pedidosEntregues: number
  totalFiado: number
  saldoCaixa: number
  vendasSemana: { data: string; total: number }[]
  ultimosPedidos: any[]
  alertas: { estoqueMinimo: any[]; contasVencer: any[] }
}

function resumoItens(itens: any): string {
  try {
    const arr = typeof itens === 'string' ? JSON.parse(itens) : itens
    if (!Array.isArray(arr)) return ''
    return arr
      .filter((i: any) => i && i.nome)
      .map((i: any) => `${i.quantidade}x ${i.nome}`)
      .join(', ')
  } catch {
    return ''
  }
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  async function loadData() {
    if (!window.api) {
      // Dados mock para dev
      setData(mockData)
      setLoading(false)
      return
    }

    try {
      const hoje = new Date().toISOString().split('T')[0]
      const seteDiasAtras = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0]
      const [pedidos, vendas, estoque, caixa, clientes] = await Promise.all([
        window.api.pedidos.list({ data: hoje }),
        window.api.relatorios.vendas({ inicio: seteDiasAtras + ' 00:00:00', fim: hoje + ' 23:59:59' }),
        window.api.estoque.alertas(),
        window.api.caixa.getResumo(),
        window.api.clientes.list({ com_fiado: true }),
      ])

      const abertos = pedidos.filter((p: any) => ['novo', 'separando', 'a_caminho'].includes(p.status))
      const entregues = pedidos.filter((p: any) => p.status === 'entregue')
      const totalHoje = pedidos.filter((p: any) => p.status !== 'cancelado').reduce((s: number, p: any) => s + p.total, 0)
      const totalFiado = clientes.reduce((s: number, c: any) => s + (c.saldo_fiado || 0), 0)

      const vendasSemana = (vendas?.totalPorDia || []).map((d: any) => {
        const [y, m, dia] = String(d.data).split('-')
        return { data: `${dia}/${m}`, total: d.total || 0 }
      })

      setData({
        totalVendasHoje: totalHoje,
        pedidosHoje: pedidos.length,
        pedidosAbertos: abertos.length,
        pedidosEntregues: entregues.length,
        totalFiado,
        saldoCaixa: caixa?.saldo_esperado || 0,
        vendasSemana,
        ultimosPedidos: pedidos.slice(0, 8).map((p: any) => ({ ...p, itens_resumo: resumoItens(p.itens) })),
        alertas: { estoqueMinimo: estoque, contasVencer: [] },
      })
    } catch {
      setData(mockData)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <PageLoading />

  const d = data!

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-6 pt-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto scroll-area p-6 space-y-6">
        {/* Cards métricas */}
        <div className="grid grid-cols-3 xl:grid-cols-6 gap-4">
          <MetricCard icon={TrendingUp} label="Vendas Hoje" value={formatCurrency(d.totalVendasHoje)} color="#22C55E" onClick={() => navigate('/relatorios')} />
          <MetricCard icon={ShoppingCart} label="Pedidos Hoje" value={String(d.pedidosHoje)} color="#3B82F6" onClick={() => navigate('/pedidos')} />
          <MetricCard icon={Clock} label="Em Aberto" value={String(d.pedidosAbertos)} color="#F5A623" onClick={() => navigate('/pedidos')} />
          <MetricCard icon={CheckCircle} label="Entregues" value={String(d.pedidosEntregues)} color="#22C55E" />
          <MetricCard icon={Users} label="Total Fiado" value={formatCurrency(d.totalFiado)} color="#EF4444" onClick={() => navigate('/clientes')} />
          <MetricCard icon={Wallet} label="Saldo Caixa" value={formatCurrency(d.saldoCaixa)} color="#A855F7" onClick={() => navigate('/caixa')} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Gráfico vendas semana */}
          <div className="col-span-2 rounded-2xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <h3 className="font-semibold mb-4">Vendas da Semana</h3>
            {d.vendasSemana.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={d.vendasSemana}>
                  <defs>
                    <linearGradient id="gradVendas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F5A623" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#F5A623" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="data" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v}`} />
                  <Tooltip
                    contentStyle={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 8 }}
                    formatter={(v: number) => [formatCurrency(v), 'Vendas']}
                  />
                  <Area type="monotone" dataKey="total" stroke="#F5A623" strokeWidth={2} fill="url(#gradVendas)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-44 flex items-center justify-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                Nenhum dado de vendas ainda
              </div>
            )}
          </div>

          {/* Alertas */}
          <div className="rounded-2xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle size={16} style={{ color: '#F5A623' }} />
              Alertas
            </h3>

            {d.alertas.estoqueMinimo.length === 0 && d.alertas.contasVencer.length === 0 ? (
              <div className="text-sm text-center py-8" style={{ color: 'var(--text-secondary)' }}>
                ✓ Nenhum alerta no momento
              </div>
            ) : (
              <div className="space-y-2">
                {d.alertas.estoqueMinimo.slice(0, 5).map((p: any) => (
                  <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => navigate('/estoque')}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#EF4444' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{p.nome}</p>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Estoque: {p.saldo} / Mín: {p.estoque_minimo}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Últimos pedidos */}
        <div className="rounded-2xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <h3 className="font-semibold">Últimos Pedidos</h3>
            <button onClick={() => navigate('/pedidos')} className="text-xs px-3 py-1 rounded-lg transition-colors hover:bg-white/10"
              style={{ color: '#F5A623' }}>
              Ver todos
            </button>
          </div>
          <div>
            {d.ultimosPedidos.length === 0 ? (
              <div className="py-12 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                Nenhum pedido ainda hoje
              </div>
            ) : (
              d.ultimosPedidos.map((p: any) => (
                <div key={p.id} className="flex items-center gap-4 px-5 py-3 hover:bg-white/5 transition-colors cursor-pointer"
                  style={{ borderBottom: '1px solid var(--border)' }}
                  onClick={() => navigate('/pedidos')}>
                  <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>#{p.numero}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.cliente_nome || 'Cliente não informado'}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{p.itens_resumo}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full status-${p.status}`}>
                    {statusLabel(p.status)}
                  </span>
                  <span className="text-sm font-semibold">{formatCurrency(p.total)}</span>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{formatDateTime(p.created_at)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, color, onClick }: {
  icon: any; label: string; value: string; color: string; onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl p-4 ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''} transition-transform`}
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg" style={{ background: `${color}20` }}>
          <Icon size={14} style={{ color }} />
        </div>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      </div>
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
    </div>
  )
}

function PageLoading() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent spinner mx-auto mb-3"
          style={{ borderColor: '#F5A62340', borderTopColor: '#F5A623' }} />
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Carregando...</p>
      </div>
    </div>
  )
}

const mockData: DashData = {
  totalVendasHoje: 1240.5,
  pedidosHoje: 8,
  pedidosAbertos: 2,
  pedidosEntregues: 5,
  totalFiado: 380,
  saldoCaixa: 950,
  vendasSemana: [
    { data: 'Seg', total: 850 }, { data: 'Ter', total: 1200 },
    { data: 'Qua', total: 980 }, { data: 'Qui', total: 1450 },
    { data: 'Sex', total: 1800 }, { data: 'Sáb', total: 2200 },
    { data: 'Dom', total: 1240 },
  ],
  ultimosPedidos: [],
  alertas: { estoqueMinimo: [], contasVencer: [] },
}
