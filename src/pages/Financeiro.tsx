import { useEffect, useState } from 'react'
import { Plus, X, Check, AlertCircle, TrendingUp, TrendingDown, BarChart3, DollarSign } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import toast from 'react-hot-toast'
import { formatCurrency, formatDate } from '../lib/utils'

type Aba = 'pagar' | 'receber' | 'fluxo' | 'dre'

const hojeStr = new Date().toISOString().split('T')[0]
const inicioMes = hojeStr.slice(0, 8) + '01'

export default function Financeiro() {
  const [aba, setAba] = useState<Aba>('pagar')
  const [contas, setContas] = useState<any[]>([])
  const [fluxo, setFluxo] = useState<any>(null)
  const [dre, setDre] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showPagar, setShowPagar] = useState<any>(null)
  const [pagarData, setPagarData] = useState({ valor_pago: '', data_pagamento: hojeStr, observacao: '' })
  const [periodo, setPeriodo] = useState({ inicio: inicioMes, fim: hojeStr })

  useEffect(() => {
    if (aba === 'pagar' || aba === 'receber') loadContas()
    if (aba === 'fluxo') loadFluxo()
    if (aba === 'dre') loadDre()
  }, [aba, periodo])

  async function loadContas() {
    setLoading(true)
    if (!window.api) { setContas(mockContas.filter(c => c.tipo === aba)); setLoading(false); return }
    const result = await window.api.financeiro.listContas({ tipo: aba })
    setContas(result)
    setLoading(false)
  }

  async function loadFluxo() {
    setLoading(true)
    if (!window.api) { setFluxo(mockFluxo); setLoading(false); return }
    const result = await window.api.financeiro.getFluxo(periodo)
    setFluxo(result)
    setLoading(false)
  }

  async function loadDre() {
    setLoading(true)
    if (!window.api) { setDre(mockDre); setLoading(false); return }
    const result = await window.api.financeiro.getDre(periodo)
    setDre(result)
    setLoading(false)
  }

  async function pagarConta(id: number) {
    const valorPago = parseFloat(pagarData.valor_pago) || showPagar.valor
    if (!window.api) { toast.success('Conta paga (mock)'); loadContas(); return }
    await window.api.financeiro.pagarConta(id, {
      data_pagamento: pagarData.data_pagamento || hojeStr,
      valor_pago: valorPago,
      observacoes: pagarData.observacao || undefined,
    })
    toast.success('Conta marcada como paga!')
    setShowPagar(null)
    loadContas()
  }

  const contasPendentes = contas.filter(c => !c.pago)
  const contasPagas = contas.filter(c => c.pago)
  const totalPendente = contasPendentes.reduce((s, c) => s + c.valor, 0)
  const hoje = new Date().toISOString().split('T')[0]
  const vencendoHoje = contasPendentes.filter(c => c.vencimento === hoje)

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Financeiro</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Gestão de contas e fluxo de caixa</p>
          </div>
          {(aba === 'pagar' || aba === 'receber') && (
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: '#F5A623', color: '#000' }}>
              <Plus size={16} /> Nova Conta
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {([
            { id: 'pagar', label: 'Contas a Pagar' },
            { id: 'receber', label: 'Contas a Receber' },
            { id: 'fluxo', label: 'Fluxo de Caixa' },
            { id: 'dre', label: 'DRE' },
          ] as { id: Aba; label: string }[]).map(t => (
            <button key={t.id} onClick={() => setAba(t.id)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: aba === t.id ? '#F5A62320' : 'transparent',
                color: aba === t.id ? '#F5A623' : 'var(--text-secondary)',
                border: `1px solid ${aba === t.id ? '#F5A62340' : 'transparent'}`,
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-area p-6">
        {/* Filtro de período */}
        {(aba === 'fluxo' || aba === 'dre') && (
          <div className="flex items-center gap-3 mb-5">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Período:</span>
            <input type="date" value={periodo.inicio} onChange={e => setPeriodo(p => ({ ...p, inicio: e.target.value }))}
              className="px-3 py-1.5 rounded-lg text-sm"
              style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>até</span>
            <input type="date" value={periodo.fim} onChange={e => setPeriodo(p => ({ ...p, fim: e.target.value }))}
              className="px-3 py-1.5 rounded-lg text-sm"
              style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
        )}

        {/* Contas a Pagar / Receber */}
        {(aba === 'pagar' || aba === 'receber') && (
          <div className="space-y-4">
            {/* Resumo */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Total Pendente</div>
                <div className="text-xl font-bold" style={{ color: '#EF4444' }}>{formatCurrency(totalPendente)}</div>
              </div>
              <div className="p-4 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Vencendo Hoje</div>
                <div className="text-xl font-bold" style={{ color: vencendoHoje.length > 0 ? '#F5A623' : '#22C55E' }}>
                  {vencendoHoje.length}
                </div>
              </div>
              <div className="p-4 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Contas Pagas</div>
                <div className="text-xl font-bold" style={{ color: '#22C55E' }}>
                  {formatCurrency(contasPagas.reduce((s, c) => s + (c.valor_pago || c.valor), 0))}
                </div>
              </div>
            </div>

            {/* Lista contas pendentes */}
            {contasPendentes.length > 0 && (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                <div className="px-4 py-3 text-xs font-medium" style={{ background: 'var(--card)', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                  PENDENTES ({contasPendentes.length})
                </div>
                {contasPendentes.map(c => {
                  const vencido = c.vencimento && c.vencimento < hoje
                  return (
                    <div key={c.id} className="flex items-center gap-4 px-4 py-3 hover:bg-white/5 transition-colors"
                      style={{ borderBottom: '1px solid var(--border)' }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{c.descricao}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {c.fornecedor_nome && <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{c.fornecedor_nome}</span>}
                          {c.categoria && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg)', color: 'var(--text-secondary)' }}>{c.categoria}</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{formatCurrency(c.valor)}</div>
                        {c.vencimento && (
                          <div className="text-xs mt-0.5" style={{ color: vencido ? '#EF4444' : 'var(--text-secondary)' }}>
                            {vencido ? '⚠ ' : ''}Vence {formatDate(c.vencimento)}
                          </div>
                        )}
                      </div>
                      <button onClick={() => { setShowPagar(c); setPagarData({ valor_pago: String(c.valor), data_pagamento: hojeStr, observacao: '' }) }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        style={{ background: '#22C55E20', color: '#22C55E', border: '1px solid #22C55E40' }}>
                        <Check size={12} className="inline mr-1" />Pagar
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Lista contas pagas */}
            {contasPagas.length > 0 && (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                <div className="px-4 py-3 text-xs font-medium" style={{ background: 'var(--card)', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                  PAGAS ({contasPagas.length})
                </div>
                {contasPagas.map(c => (
                  <div key={c.id} className="flex items-center gap-4 px-4 py-3" style={{ borderBottom: '1px solid var(--border)', opacity: 0.6 }}>
                    <div className="flex-1">
                      <p className="text-sm">{c.descricao}</p>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Pago em {c.data_pagamento ? formatDate(c.data_pagamento) : '—'}</p>
                    </div>
                    <span className="text-sm font-semibold">{formatCurrency(c.valor_pago || c.valor)}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#22C55E20', color: '#22C55E' }}>Pago</span>
                  </div>
                ))}
              </div>
            )}

            {contas.length === 0 && !loading && (
              <div className="py-16 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                Nenhuma conta cadastrada
              </div>
            )}
          </div>
        )}

        {/* Fluxo de Caixa */}
        {aba === 'fluxo' && fluxo && (
          <div className="space-y-4">
            <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <h3 className="font-semibold mb-4">Entradas vs Saídas por Dia</h3>
              {(fluxo.entradas?.length || 0) > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={buildFluxoData(fluxo)}>
                    <XAxis dataKey="data" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v}`} />
                    <Tooltip
                      contentStyle={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 8 }}
                      formatter={(v: number, name: string) => [formatCurrency(v), name]}
                    />
                    <Legend />
                    <Bar dataKey="entradas" name="Entradas" fill="#22C55E" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="saidas" name="Saídas" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-52 flex items-center justify-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Nenhum dado no período selecionado
                </div>
              )}
            </div>
          </div>
        )}

        {/* DRE */}
        {aba === 'dre' && dre && (
          <div className="max-w-xl space-y-3">
            <h3 className="font-semibold text-lg">Demonstrativo de Resultado</h3>
            <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
              {formatDate(periodo.inicio)} a {formatDate(periodo.fim)}
            </p>

            <DreRow label="Receita Bruta" value={dre.receitaBruta} color="#22C55E" bold />
            <DreRow label="(-) Custo das Mercadorias Vendidas (CMV)" value={dre.cmv} color="#EF4444" negative />
            <DreRow label="= Lucro Bruto" value={dre.lucrobruto} color="#3B82F6" bold />
            <DreRow label="(-) Despesas Operacionais" value={dre.totalDespesas} color="#EF4444" negative />
            <div style={{ borderTop: '2px solid var(--border)', paddingTop: 12, marginTop: 8 }}>
              <DreRow label="= Lucro Líquido" value={dre.lucroLiquido} color={dre.lucroLiquido >= 0 ? '#22C55E' : '#EF4444'} bold />
            </div>
            <div className="p-4 rounded-xl mt-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Margem Líquida</div>
              <div className="text-3xl font-bold" style={{ color: dre.margem >= 0 ? '#22C55E' : '#EF4444' }}>
                {dre.margem.toFixed(1)}%
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Nova Conta */}
      {showModal && (
        <NovaContaModal tipo={aba === 'receber' ? 'receber' : 'pagar'} onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); loadContas() }} />
      )}

      {/* Modal Pagar */}
      {showPagar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 animate-in space-y-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Registrar Pagamento</h3>
              <button onClick={() => setShowPagar(null)}><X size={16} /></button>
            </div>
            <div>
              <p className="text-sm font-medium">{showPagar.descricao}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Valor original: {formatCurrency(showPagar.valor)}</p>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Valor pago (R$)</label>
              <input type="number" step="0.01" value={pagarData.valor_pago}
                onChange={e => setPagarData(d => ({ ...d, valor_pago: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Data do pagamento</label>
              <input type="date" value={pagarData.data_pagamento}
                onChange={e => setPagarData(d => ({ ...d, data_pagamento: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Observação (opcional)</label>
              <textarea value={pagarData.observacao}
                onChange={e => setPagarData(d => ({ ...d, observacao: e.target.value }))}
                rows={2} placeholder="Ex: pago via PIX"
                className="w-full px-3 py-2.5 rounded-xl text-sm resize-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>
            <button onClick={() => pagarConta(showPagar.id)}
              className="w-full py-3 rounded-xl font-semibold text-sm"
              style={{ background: '#22C55E', color: '#fff' }}>
              ✓ Confirmar Pagamento
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function DreRow({ label, value, color, bold, negative }: { label: string; value: number; color: string; bold?: boolean; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className={`text-sm ${bold ? 'font-semibold' : ''}`}>{label}</span>
      <span className={`text-sm font-mono ${bold ? 'font-bold' : ''}`} style={{ color }}>
        {negative ? '-' : ''}{formatCurrency(Math.abs(value))}
      </span>
    </div>
  )
}

function NovaContaModal({ tipo, onClose, onSave }: { tipo: 'pagar' | 'receber'; onClose: () => void; onSave: () => void }) {
  const [data, setData] = useState({ descricao: '', valor: '', vencimento: '', categoria: '', observacoes: '' })

  async function salvar() {
    if (!data.descricao || !data.valor) { toast.error('Preencha descrição e valor'); return }
    if (!window.api) { toast.success('Conta criada (mock)'); onSave(); return }
    await window.api.financeiro.createConta({ tipo, ...data, valor: parseFloat(data.valor) })
    toast.success('Conta cadastrada!')
    onSave()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-md rounded-2xl p-6 animate-in space-y-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Nova Conta a {tipo === 'pagar' ? 'Pagar' : 'Receber'}</h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        {[
          { key: 'descricao', label: 'Descrição *', placeholder: 'Ex: Fornecedor ABC' },
          { key: 'valor', label: 'Valor *', placeholder: '0,00', type: 'number' },
          { key: 'vencimento', label: 'Vencimento', placeholder: '', type: 'date' },
        ].map(f => (
          <div key={f.key}>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{f.label}</label>
            <input type={f.type || 'text'} value={(data as any)[f.key]} onChange={e => setData(d => ({ ...d, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              className="w-full px-3 py-2.5 rounded-xl text-sm"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
        ))}
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Categoria</label>
          <select
            value={data.categoria}
            onChange={e => setData(d => ({ ...d, categoria: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl text-sm"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            <option value="">— Selecione —</option>
            {(tipo === 'pagar'
              ? ['Aluguel', 'Energia Elétrica', 'Água', 'Internet', 'Telefone', 'Contador', 'IPTU', 'Salários', 'Outros']
              : ['Vendas', 'Fiado', 'Outros']
            ).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button onClick={salvar} className="w-full py-3 rounded-xl font-semibold text-sm" style={{ background: '#F5A623', color: '#000' }}>
          Salvar Conta
        </button>
      </div>
    </div>
  )
}

function buildFluxoData(fluxo: any) {
  const map: Record<string, { data: string; entradas: number; saidas: number }> = {}
  for (const e of fluxo.entradas || []) {
    if (!map[e.data]) map[e.data] = { data: e.data, entradas: 0, saidas: 0 }
    map[e.data].entradas += e.total
  }
  for (const s of fluxo.saidas || []) {
    if (!map[s.data]) map[s.data] = { data: s.data, entradas: 0, saidas: 0 }
    map[s.data].saidas += s.total
  }
  return Object.values(map).sort((a, b) => a.data.localeCompare(b.data))
}

const mockContas = [
  { id: 1, tipo: 'pagar', descricao: 'Aluguel Depósito', valor: 2500, vencimento: new Date().toISOString().split('T')[0], pago: false, categoria: 'Aluguel' },
  { id: 2, tipo: 'pagar', descricao: 'Energia Elétrica', valor: 380, vencimento: '2026-05-20', pago: false, categoria: 'Utilities' },
  { id: 3, tipo: 'pagar', descricao: 'Ambev — Fatura', valor: 8400, vencimento: '2026-05-25', pago: false, fornecedor_nome: 'Ambev Distribuidora' },
  { id: 4, tipo: 'pagar', descricao: 'Internet', valor: 150, vencimento: '2026-04-30', pago: true, data_pagamento: '2026-04-28', valor_pago: 150, categoria: 'Utilities' },
  { id: 5, tipo: 'receber', descricao: 'Fiado João Silva', valor: 45, pago: false, categoria: 'Fiado' },
]
const mockFluxo = { entradas: [], saidas: [] }
const mockDre = { receitaBruta: 24500, cmv: 14700, lucrobruto: 9800, totalDespesas: 3200, lucroLiquido: 6600, margem: 26.9 }
