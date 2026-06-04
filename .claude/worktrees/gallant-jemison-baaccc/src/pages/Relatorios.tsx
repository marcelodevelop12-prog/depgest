import { useEffect, useState } from 'react'
import { Download, TrendingUp, Package, Users, Truck } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import toast from 'react-hot-toast'
import { formatCurrency, formatDate } from '../lib/utils'

type Aba = 'vendas' | 'estoque' | 'clientes' | 'entregas'

const hojeStr = new Date().toISOString().split('T')[0]
const inicioMes = hojeStr.slice(0, 8) + '01'

const COLORS = ['#F5A623', '#22C55E', '#3B82F6', '#A855F7', '#EF4444', '#F59E0B']

export default function Relatorios() {
  const [aba, setAba] = useState<Aba>('vendas')
  const [periodo, setPeriodo] = useState({ inicio: inicioMes, fim: hojeStr })
  const [dados, setDados] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadDados()
  }, [aba, periodo])

  async function loadDados() {
    setLoading(true)
    try {
      if (!window.api) { setDados(mockDados[aba]); setLoading(false); return }
      const filters = { inicio: periodo.inicio, fim: periodo.fim }
      let result
      if (aba === 'vendas') result = await window.api.relatorios.vendas(filters)
      else if (aba === 'estoque') result = await window.api.relatorios.estoque(filters)
      else if (aba === 'clientes') result = await window.api.relatorios.clientes(filters)
      else result = await window.api.relatorios.entregas(filters)
      setDados(result)
    } catch {
      setDados(mockDados[aba])
    } finally {
      setLoading(false)
    }
  }

  async function exportarPdf() {
    if (!window.api) { toast.success('Exportar PDF (mock)'); return }
    const result = await window.api.relatorios.exportPdf(aba, dados)
    toast.success(result.message || 'PDF gerado!')
  }

  async function exportarExcel() {
    if (!window.api) { toast.success('Exportar Excel (mock)'); return }
    const result = await window.api.relatorios.exportExcel(aba, dados)
    toast.success(result.message || 'Excel gerado!')
  }

  const abas = [
    { id: 'vendas', icon: TrendingUp, label: 'Vendas' },
    { id: 'estoque', icon: Package, label: 'Estoque' },
    { id: 'clientes', icon: Users, label: 'Clientes' },
    { id: 'entregas', icon: Truck, label: 'Entregas' },
  ] as { id: Aba; icon: any; label: string }[]

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Relatórios</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Análises e exportações</p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportarExcel}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors hover:bg-white/10"
              style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              <Download size={14} /> Excel
            </button>
            <button onClick={exportarPdf}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium"
              style={{ background: '#F5A623', color: '#000' }}>
              <Download size={14} /> PDF
            </button>
          </div>
        </div>

        {/* Abas */}
        <div className="flex gap-1 mt-4">
          {abas.map(t => {
            const Icon = t.icon
            return (
              <button key={t.id} onClick={() => setAba(t.id)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: aba === t.id ? '#F5A62320' : 'transparent',
                  color: aba === t.id ? '#F5A623' : 'var(--text-secondary)',
                  border: `1px solid ${aba === t.id ? '#F5A62340' : 'transparent'}`,
                }}>
                <Icon size={14} /> {t.label}
              </button>
            )
          })}
        </div>

        {/* Filtro período */}
        {(aba === 'vendas' || aba === 'entregas') && (
          <div className="flex items-center gap-3 mt-3">
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Período:</span>
            <input type="date" value={periodo.inicio} onChange={e => setPeriodo(p => ({ ...p, inicio: e.target.value }))}
              className="px-3 py-1.5 rounded-lg text-xs"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>até</span>
            <input type="date" value={periodo.fim} onChange={e => setPeriodo(p => ({ ...p, fim: e.target.value }))}
              className="px-3 py-1.5 rounded-lg text-xs"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scroll-area p-6">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-6 h-6 rounded-full border-2 spinner" style={{ borderColor: '#F5A62340', borderTopColor: '#F5A623' }} />
          </div>
        ) : !dados ? null : (
          <>
            {/* VENDAS */}
            {aba === 'vendas' && (
              <div className="space-y-5">
                {/* Métricas top */}
                <div className="grid grid-cols-3 gap-4">
                  <MetricCard label="Total de Vendas" value={formatCurrency(dados.totais?.total_vendas || 0)} color="#22C55E" />
                  <MetricCard label="Pedidos" value={String(dados.totais?.total_pedidos || 0)} color="#3B82F6" />
                  <MetricCard label="Ticket Médio" value={formatCurrency(dados.totais?.ticket_medio || 0)} color="#F5A623" />
                </div>

                <div className="grid grid-cols-2 gap-5">
                  {/* Vendas por dia */}
                  <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                    <h3 className="font-semibold mb-4 text-sm">Vendas por Dia</h3>
                    {dados.totalPorDia?.length > 0 ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={dados.totalPorDia}>
                          <XAxis dataKey="data" tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v}`} />
                          <Tooltip contentStyle={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 8 }}
                            formatter={(v: number) => [formatCurrency(v), 'Vendas']} />
                          <Bar dataKey="total" fill="#F5A623" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <EmptyChart />}
                  </div>

                  {/* Por forma de pagamento */}
                  <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                    <h3 className="font-semibold mb-4 text-sm">Por Forma de Pagamento</h3>
                    {dados.porFormaPagamento?.length > 0 ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={dados.porFormaPagamento} dataKey="total" nameKey="forma_pagamento" cx="50%" cy="50%" outerRadius={70} label={({ forma_pagamento, percent }) => `${forma_pagamento} ${(percent * 100).toFixed(0)}%`}>
                            {dados.porFormaPagamento.map((_: any, i: number) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 8 }}
                            formatter={(v: number) => formatCurrency(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : <EmptyChart />}
                  </div>
                </div>

                {/* Top produtos */}
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  <div className="px-4 py-3 text-xs font-medium" style={{ background: 'var(--card)', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                    PRODUTOS MAIS VENDIDOS
                  </div>
                  {(dados.topProdutos || []).map((p: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5" style={{ borderBottom: '1px solid var(--border)' }}>
                      <span className="w-6 text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>#{i + 1}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{p.nome}</p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{p.quantidade} unidades</p>
                      </div>
                      <span className="font-semibold text-sm">{formatCurrency(p.total)}</span>
                    </div>
                  ))}
                  {(!dados.topProdutos || dados.topProdutos.length === 0) && (
                    <div className="py-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>Sem dados no período</div>
                  )}
                </div>
              </div>
            )}

            {/* ESTOQUE */}
            {aba === 'estoque' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-5">
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                    <div className="px-4 py-3 text-xs font-medium" style={{ background: '#EF444420', color: '#EF4444', borderBottom: '1px solid var(--border)' }}>
                      ABAIXO DO MÍNIMO ({(dados.produtos || []).filter((p: any) => p.saldo <= p.estoque_minimo && p.estoque_minimo > 0).length})
                    </div>
                    {(dados.produtos || []).filter((p: any) => p.saldo <= p.estoque_minimo && p.estoque_minimo > 0).map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/5" style={{ borderBottom: '1px solid var(--border)' }}>
                        <p className="text-sm">{p.nome}</p>
                        <div className="text-right">
                          <span className="text-sm font-bold" style={{ color: '#EF4444' }}>{p.saldo}</span>
                          <span className="text-xs ml-1" style={{ color: 'var(--text-secondary)' }}>/ mín {p.estoque_minimo}</span>
                        </div>
                      </div>
                    ))}
                    {(dados.produtos || []).filter((p: any) => p.saldo <= p.estoque_minimo && p.estoque_minimo > 0).length === 0 && (
                      <div className="py-6 text-center text-sm" style={{ color: '#22C55E' }}>✓ Todos acima do mínimo</div>
                    )}
                  </div>

                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                    <div className="px-4 py-3 text-xs font-medium" style={{ background: 'var(--card)', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                      PRODUTOS PARADOS (+30 dias)
                    </div>
                    {(dados.parados || []).map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/5" style={{ borderBottom: '1px solid var(--border)' }}>
                        <p className="text-sm">{p.nome}</p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {p.ultima_movimentacao ? `Última mov: ${formatDate(p.ultima_movimentacao)}` : 'Sem movimentação'}
                        </p>
                      </div>
                    ))}
                    {(!dados.parados || dados.parados.length === 0) && (
                      <div className="py-6 text-center text-sm" style={{ color: '#22C55E' }}>✓ Sem produtos parados</div>
                    )}
                  </div>
                </div>

                {/* Todos os produtos */}
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  <div className="px-4 py-3 text-xs font-medium" style={{ background: 'var(--card)', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                    TODOS OS PRODUTOS
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {(dados.produtos || []).map((p: any) => (
                      <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5" style={{ borderBottom: '1px solid var(--border)' }}>
                        <div className="flex-1">
                          <p className="text-sm">{p.nome}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                            <div className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, p.estoque_minimo > 0 ? (p.saldo / p.estoque_minimo) * 100 : 100)}%`,
                                background: p.saldo <= 0 ? '#EF4444' : p.saldo <= p.estoque_minimo ? '#F5A623' : '#22C55E',
                              }} />
                          </div>
                          <span className="text-sm font-mono w-8 text-right">{p.saldo}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* CLIENTES */}
            {aba === 'clientes' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-5">
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                    <div className="px-4 py-3 text-xs font-medium" style={{ background: 'var(--card)', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                      TOP COMPRADORES
                    </div>
                    {(dados.maioresCompradores || []).map((c: any, i: number) => (
                      <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5" style={{ borderBottom: '1px solid var(--border)' }}>
                        <span className="text-xs font-bold w-5" style={{ color: 'var(--text-secondary)' }}>#{i + 1}</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{c.nome}</p>
                          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{c.total_pedidos} pedidos</p>
                        </div>
                        <span className="text-sm font-semibold" style={{ color: '#22C55E' }}>{formatCurrency(c.total_compras)}</span>
                      </div>
                    ))}
                    {(!dados.maioresCompradores?.length) && <div className="py-6 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>Sem dados</div>}
                  </div>

                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                    <div className="px-4 py-3 text-xs font-medium" style={{ background: '#EF444420', color: '#EF4444', borderBottom: '1px solid var(--border)' }}>
                      INADIMPLENTES (FIADO)
                    </div>
                    {(dados.inadimplentes || []).map((c: any) => (
                      <div key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/5" style={{ borderBottom: '1px solid var(--border)' }}>
                        <div>
                          <p className="text-sm font-medium">{c.nome}</p>
                          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{c.telefone}</p>
                        </div>
                        <span className="text-sm font-bold" style={{ color: '#EF4444' }}>{formatCurrency(c.saldo_fiado)}</span>
                      </div>
                    ))}
                    {(!dados.inadimplentes?.length) && <div className="py-6 text-center text-sm" style={{ color: '#22C55E' }}>✓ Sem inadimplentes</div>}
                  </div>
                </div>

                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  <div className="px-4 py-3 text-xs font-medium" style={{ background: 'var(--card)', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                    CLIENTES INATIVOS (+60 dias)
                  </div>
                  {(dados.inativos || []).map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/5" style={{ borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <p className="text-sm">{c.nome}</p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{c.telefone}</p>
                      </div>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {c.ultima_compra ? `Última compra: ${formatDate(c.ultima_compra)}` : 'Nunca comprou'}
                      </p>
                    </div>
                  ))}
                  {(!dados.inativos?.length) && <div className="py-6 text-center text-sm" style={{ color: '#22C55E' }}>✓ Sem clientes inativos</div>}
                </div>
              </div>
            )}

            {/* ENTREGAS */}
            {aba === 'entregas' && (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                <div className="px-4 py-3 text-xs font-medium" style={{ background: 'var(--card)', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                  DESEMPENHO POR MOTOBOY
                </div>
                {(dados.porMotoboy || []).map((m: any) => (
                  <div key={m.id} className="flex items-center gap-4 px-4 py-3 hover:bg-white/5" style={{ borderBottom: '1px solid var(--border)' }}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
                      style={{ background: '#F5A62320', color: '#F5A623' }}>
                      {m.nome[0]}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{m.nome}</p>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{m.total_entregas} entregas no período</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold" style={{ color: '#22C55E' }}>{m.entregues} entregues</p>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {m.total_entregas > 0 ? ((m.entregues / m.total_entregas) * 100).toFixed(0) : 0}% taxa
                      </p>
                    </div>
                  </div>
                ))}
                {(!dados.porMotoboy?.length) && <div className="py-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>Sem entregas no período</div>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="p-4 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</div>
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="h-48 flex items-center justify-center text-sm" style={{ color: 'var(--text-secondary)' }}>
      Sem dados no período
    </div>
  )
}

const mockDados: Record<Aba, any> = {
  vendas: {
    totais: { total_vendas: 24500, total_pedidos: 48, ticket_medio: 510.4 },
    totalPorDia: [
      { data: '01/05', total: 800 }, { data: '02/05', total: 1200 }, { data: '03/05', total: 950 },
      { data: '04/05', total: 1400 }, { data: '05/05', total: 1800 }, { data: '06/05', total: 2200 },
      { data: '07/05', total: 1150 },
    ],
    porFormaPagamento: [
      { forma_pagamento: 'dinheiro', total: 8500 }, { forma_pagamento: 'pix', total: 9200 },
      { forma_pagamento: 'debito', total: 3800 }, { forma_pagamento: 'credito', total: 3000 },
    ],
    topProdutos: [
      { nome: 'Brahma 600ml', quantidade: 240, total: 1800 },
      { nome: 'Skol Lata 350ml', quantidade: 480, total: 1920 },
      { nome: 'Heineken Long Neck', quantidade: 96, total: 950.4 },
    ],
    porOrigem: [{ origem: 'balcao', total: 18000 }, { origem: 'online', total: 6500 }],
  },
  estoque: {
    produtos: [
      { id: 1, nome: 'Brahma 600ml', saldo: 48, estoque_minimo: 24 },
      { id: 2, nome: 'Skol Lata 350ml', saldo: 3, estoque_minimo: 24 },
      { id: 3, nome: 'Heineken Long Neck', saldo: 0, estoque_minimo: 12 },
    ],
    parados: [{ id: 4, nome: 'Whisky Old Parr 1L', ultima_movimentacao: '2026-03-10' }],
  },
  clientes: {
    maioresCompradores: [
      { id: 1, nome: 'João Silva', total_pedidos: 12, total_compras: 3400 },
      { id: 2, nome: 'Bar do Zé', total_pedidos: 8, total_compras: 2800 },
    ],
    inadimplentes: [
      { id: 1, nome: 'Maria Souza', telefone: '(11) 99999-0001', saldo_fiado: 145 },
    ],
    inativos: [
      { id: 3, nome: 'Pedro Alves', telefone: '(11) 99999-0003', ultima_compra: '2026-02-15' },
    ],
  },
  entregas: {
    porMotoboy: [
      { id: 1, nome: 'Carlos Moto', total_entregas: 28, entregues: 27 },
      { id: 2, nome: 'Bruno Rápido', total_entregas: 20, entregues: 19 },
    ],
  },
}
