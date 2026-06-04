import { useEffect, useState } from 'react'
import { Wallet, X, Plus, Minus, Clock, DollarSign, CreditCard, Smartphone, TrendingDown, Printer, History } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency, formatDateTime } from '../lib/utils'

interface SessaoAtiva {
  id: number
  abertura: string
  valor_inicial: number
}
interface Resumo {
  dinheiro: number
  pix: number
  debito: number
  credito: number
  total_entradas: number
  total_sangrias: number
  saldo_esperado: number
}
interface Movimentacao {
  id: number
  tipo: 'entrada' | 'sangria' | 'suprimento'
  forma_pagamento: string
  valor: number
  descricao: string
  created_at: string
}
interface SessaoHistorico {
  id: number
  abertura: string
  fechamento: string
  valor_inicial: number
  total_entradas: number
  total_sangrias: number
}

const MOCK_SESSAO: SessaoAtiva = { id: 1, abertura: new Date(Date.now() - 14400000).toISOString(), valor_inicial: 150 }
const MOCK_RESUMO: Resumo = { dinheiro: 320.5, pix: 180, debito: 95.9, credito: 240, total_entradas: 836.4, total_sangrias: 100, saldo_esperado: 886.4 }
const MOCK_MOVS: Movimentacao[] = [
  { id: 1, tipo: 'entrada', forma_pagamento: 'dinheiro', valor: 73.8, descricao: 'Pedido #001', created_at: new Date(Date.now() - 10800000).toISOString() },
  { id: 2, tipo: 'entrada', forma_pagamento: 'pix', valor: 57.8, descricao: 'Pedido #002', created_at: new Date(Date.now() - 7200000).toISOString() },
  { id: 3, tipo: 'sangria', forma_pagamento: 'dinheiro', valor: 100, descricao: 'Retirada para troco', created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: 4, tipo: 'entrada', forma_pagamento: 'credito', valor: 108, descricao: 'Pedido #004', created_at: new Date(Date.now() - 1800000).toISOString() },
]
const MOCK_HISTORICO: SessaoHistorico[] = [
  { id: 1, abertura: new Date(Date.now() - 86400000 * 2).toISOString(), fechamento: new Date(Date.now() - 86400000 * 2 + 36000000).toISOString(), valor_inicial: 100, total_entradas: 1240, total_sangrias: 200 },
  { id: 2, abertura: new Date(Date.now() - 86400000).toISOString(), fechamento: new Date(Date.now() - 86400000 + 36000000).toISOString(), valor_inicial: 150, total_entradas: 980, total_sangrias: 50 },
]

const PAGAMENTOS = [
  { key: 'dinheiro', label: 'Dinheiro', icon: DollarSign, color: '#22C55E' },
  { key: 'pix', label: 'PIX', icon: Smartphone, color: '#A855F7' },
  { key: 'debito', label: 'Débito', icon: CreditCard, color: '#3B82F6' },
  { key: 'credito', label: 'Crédito', icon: CreditCard, color: '#F5A623' },
]

export default function Caixa() {
  const [sessao, setSessao] = useState<SessaoAtiva | null>(null)
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [movs, setMovs] = useState<Movimentacao[]>([])
  const [historico, setHistorico] = useState<SessaoHistorico[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'atual' | 'historico'>('atual')

  const [abrirModal, setAbrirModal] = useState(false)
  const [valorInicial, setValorInicial] = useState('')
  const [sangriaModa, setSangriaModa] = useState(false)
  const [suprimentoModal, setSuprimentoModal] = useState(false)
  const [fecharModal, setFecharModal] = useState(false)
  const [contagemFisica, setContagemFisica] = useState('')

  const [movForm, setMovForm] = useState({ valor: '', descricao: '' })
  const [saving, setSaving] = useState(false)

  const useMock = !window.api

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    if (useMock) {
      setSessao(MOCK_SESSAO)
      setResumo(MOCK_RESUMO)
      setMovs(MOCK_MOVS)
      setHistorico(MOCK_HISTORICO)
      setLoading(false)
      return
    }
    try {
      const s = await window.api.caixa.getSessaoAtiva()
      setSessao(s)
      if (s) {
        const [r, m] = await Promise.all([window.api.caixa.getResumo(), Promise.resolve([])])
        setResumo(r)
        setMovs(m)
      }
      const hist = await window.api.caixa.getHistorico()
      setHistorico(hist)
    } catch { toast.error('Erro ao carregar caixa') }
    finally { setLoading(false) }
  }

  async function abrir() {
    const v = parseFloat(valorInicial.replace(',', '.'))
    if (isNaN(v) || v < 0) { toast.error('Valor inicial inválido'); return }
    setSaving(true)
    try {
      if (useMock) {
        setSessao({ id: Date.now(), abertura: new Date().toISOString(), valor_inicial: v })
        setResumo({ dinheiro: 0, pix: 0, debito: 0, credito: 0, total_entradas: 0, total_sangrias: 0, saldo_esperado: v })
        setMovs([])
        toast.success('Caixa aberto!')
        setAbrirModal(false)
        return
      }
      await window.api.caixa.abrir(v)
      toast.success('Caixa aberto!')
      setAbrirModal(false)
      load()
    } catch { toast.error('Erro ao abrir caixa') }
    finally { setSaving(false) }
  }

  async function fechar() {
    const v = parseFloat(contagemFisica.replace(',', '.'))
    if (isNaN(v)) { toast.error('Informe a contagem física'); return }
    setSaving(true)
    try {
      if (useMock) {
        setSessao(null)
        toast.success('Caixa fechado!')
        setFecharModal(false)
        return
      }
      await window.api.caixa.fechar({ sessao_id: sessao!.id, contagem_fisica: v })
      toast.success('Caixa fechado!')
      setFecharModal(false)
      load()
    } catch { toast.error('Erro ao fechar caixa') }
    finally { setSaving(false) }
  }

  async function registrarMovimento(tipo: 'sangria' | 'suprimento') {
    const v = parseFloat(movForm.valor.replace(',', '.'))
    if (!v || v <= 0) { toast.error('Valor inválido'); return }
    setSaving(true)
    try {
      if (useMock) {
        const newMov: Movimentacao = { id: Date.now(), tipo, forma_pagamento: 'dinheiro', valor: v, descricao: movForm.descricao, created_at: new Date().toISOString() }
        setMovs(prev => [newMov, ...prev])
        if (tipo === 'sangria') setResumo(r => r ? { ...r, total_sangrias: r.total_sangrias + v, saldo_esperado: r.saldo_esperado - v } : r)
        else setResumo(r => r ? { ...r, saldo_esperado: r.saldo_esperado + v } : r)
        toast.success(tipo === 'sangria' ? 'Sangria registrada' : 'Suprimento registrado')
        setSangriaModa(false)
        setSuprimentoModal(false)
        setMovForm({ valor: '', descricao: '' })
        return
      }
      await window.api.caixa.movimentar({ sessao_id: sessao!.id, tipo, valor: v, descricao: movForm.descricao })
      toast.success(tipo === 'sangria' ? 'Sangria registrada' : 'Suprimento registrado')
      setSangriaModa(false)
      setSuprimentoModal(false)
      setMovForm({ valor: '', descricao: '' })
      load()
    } catch { toast.error('Erro') }
    finally { setSaving(false) }
  }

  const diferenca = resumo ? parseFloat(contagemFisica.replace(',', '.') || '0') - resumo.saldo_esperado : 0

  if (loading) return <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-secondary)' }}>Carregando...</div>

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Caixa</h1>
        <div className="flex-1" />
        {sessao && (
          <>
            <button onClick={() => { setMovForm({ valor: '', descricao: '' }); setSuprimentoModal(true) }} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: '#22C55E22', color: '#22C55E', border: '1px solid #22C55E44' }}>
              <Plus className="w-4 h-4" /> Suprimento
            </button>
            <button onClick={() => { setMovForm({ valor: '', descricao: '' }); setSangriaModa(true) }} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: '#EF444422', color: '#EF4444', border: '1px solid #EF444444' }}>
              <Minus className="w-4 h-4" /> Sangria
            </button>
            <button onClick={() => { setContagemFisica(''); setFecharModal(true) }} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#EF4444' }}>
              Fechar Caixa
            </button>
          </>
        )}
      </div>

      {!sessao ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: '#F5A62322' }}>
            <Wallet className="w-10 h-10" style={{ color: '#F5A623' }} />
          </div>
          <div className="text-center">
            <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Caixa Fechado</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Abra o caixa para começar a registrar vendas</p>
          </div>
          <button onClick={() => { setValorInicial(''); setAbrirModal(true) }} className="flex items-center gap-2 px-8 py-3 rounded-xl text-white font-semibold text-lg" style={{ background: '#F5A623' }}>
            <Wallet className="w-5 h-5" /> Abrir Caixa
          </button>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-1 px-4 border-b" style={{ borderColor: 'var(--border)' }}>
            {[['atual', 'Sessão Atual'], ['historico', 'Histórico']].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k as any)} className="px-4 py-2 text-sm font-medium border-b-2"
                style={{ borderColor: tab === k ? '#F5A623' : 'transparent', color: tab === k ? '#F5A623' : 'var(--text-secondary)' }}>{l}</button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {tab === 'atual' && resumo && (
              <>
                {/* Status bar */}
                <div className="flex items-center gap-4 mb-4 p-3 rounded-xl text-sm" style={{ background: '#22C55E11', border: '1px solid #22C55E33' }}>
                  <Clock className="w-4 h-4" style={{ color: '#22C55E' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>Abertura: <strong style={{ color: 'var(--text-primary)' }}>{formatDateTime(sessao.abertura)}</strong></span>
                  <span style={{ color: 'var(--text-secondary)' }}>Valor inicial: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(sessao.valor_inicial)}</strong></span>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  {PAGAMENTOS.map(p => (
                    <div key={p.key} className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <p.icon className="w-4 h-4" style={{ color: p.color }} />
                        <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{p.label}</p>
                      </div>
                      <p className="text-xl font-bold" style={{ color: p.color }}>{formatCurrency((resumo as any)[p.key])}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  {[
                    { label: 'Total Entradas', value: resumo.total_entradas, color: '#22C55E' },
                    { label: 'Total Sangrias', value: resumo.total_sangrias, color: '#EF4444' },
                    { label: 'Saldo Esperado', value: resumo.saldo_esperado, color: '#F5A623' },
                  ].map(c => (
                    <div key={c.label} className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{c.label}</p>
                      <p className="text-2xl font-bold mt-1" style={{ color: c.color }}>{formatCurrency(c.value)}</p>
                    </div>
                  ))}
                </div>

                {/* Movements */}
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Movimentações da Sessão</h3>
                <table className="w-full text-sm">
                  <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Data/Hora', 'Tipo', 'Forma', 'Descrição', 'Valor'].map(h => <th key={h} className="pb-2 text-left px-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {movs.map(m => (
                      <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td className="py-2 px-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{formatDateTime(m.created_at)}</td>
                        <td className="py-2 px-2">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: m.tipo === 'entrada' ? '#22C55E22' : '#EF444422', color: m.tipo === 'entrada' ? '#22C55E' : '#EF4444' }}>
                            {m.tipo === 'entrada' ? 'Entrada' : m.tipo === 'sangria' ? 'Sangria' : 'Suprimento'}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-xs capitalize" style={{ color: 'var(--text-secondary)' }}>{m.forma_pagamento}</td>
                        <td className="py-2 px-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{m.descricao}</td>
                        <td className="py-2 px-2 font-bold" style={{ color: m.tipo === 'entrada' ? '#22C55E' : '#EF4444' }}>
                          {m.tipo === 'entrada' ? '+' : '-'}{formatCurrency(m.valor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {tab === 'historico' && (
              <table className="w-full text-sm">
                <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Abertura', 'Fechamento', 'Valor Inicial', 'Entradas', 'Sangrias', 'Saldo Final'].map(h => <th key={h} className="pb-2 text-left px-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {historico.map(h => (
                    <tr key={h.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="py-3 px-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{formatDateTime(h.abertura)}</td>
                      <td className="py-3 px-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{formatDateTime(h.fechamento)}</td>
                      <td className="py-3 px-2" style={{ color: 'var(--text-primary)' }}>{formatCurrency(h.valor_inicial)}</td>
                      <td className="py-3 px-2 font-semibold" style={{ color: '#22C55E' }}>{formatCurrency(h.total_entradas)}</td>
                      <td className="py-3 px-2 font-semibold" style={{ color: '#EF4444' }}>{formatCurrency(h.total_sangrias)}</td>
                      <td className="py-3 px-2 font-bold" style={{ color: '#F5A623' }}>{formatCurrency(h.valor_inicial + h.total_entradas - h.total_sangrias)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Abrir Modal */}
      {abrirModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-80 rounded-xl shadow-2xl" style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Abrir Caixa</h2>
              <button onClick={() => setAbrirModal(false)}><X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Valor Inicial (troco)</label>
                <input className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  placeholder="0,00" value={valorInicial} onChange={e => setValorInicial(e.target.value)} autoFocus />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setAbrirModal(false)} className="flex-1 px-3 py-2 rounded-lg text-sm" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>Cancelar</button>
                <button onClick={abrir} disabled={saving} className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#F5A623' }}>Abrir</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sangria/Suprimento Modal */}
      {(sangriaModa || suprimentoModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-80 rounded-xl shadow-2xl" style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>{sangriaModa ? 'Sangria' : 'Suprimento'}</h2>
              <button onClick={() => { setSangriaModa(false); setSuprimentoModal(false) }}><X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Valor (R$)</label>
                <input className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  placeholder="0,00" value={movForm.valor} onChange={e => setMovForm(f => ({ ...f, valor: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Descrição</label>
                <input className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  placeholder="Motivo..." value={movForm.descricao} onChange={e => setMovForm(f => ({ ...f, descricao: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setSangriaModa(false); setSuprimentoModal(false) }} className="flex-1 px-3 py-2 rounded-lg text-sm" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>Cancelar</button>
                <button onClick={() => registrarMovimento(sangriaModa ? 'sangria' : 'suprimento')} disabled={saving}
                  className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-white" style={{ background: sangriaModa ? '#EF4444' : '#22C55E' }}>
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fechar Modal */}
      {fecharModal && resumo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-96 rounded-xl shadow-2xl" style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Fechar Caixa</h2>
              <button onClick={() => setFecharModal(false)}><X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg" style={{ background: 'var(--bg)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Saldo esperado</p>
                  <p className="text-lg font-bold" style={{ color: '#F5A623' }}>{formatCurrency(resumo.saldo_esperado)}</p>
                </div>
                <div className="p-3 rounded-lg" style={{ background: 'var(--bg)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Diferença</p>
                  <p className="text-lg font-bold" style={{ color: diferenca === 0 ? '#22C55E' : diferenca > 0 ? '#3B82F6' : '#EF4444' }}>
                    {diferenca >= 0 ? '+' : ''}{formatCurrency(diferenca)}
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Contagem física (R$)</label>
                <input className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  placeholder="Valor contado em caixa..." value={contagemFisica} onChange={e => setContagemFisica(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setFecharModal(false)} className="flex-1 px-3 py-2 rounded-lg text-sm" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>Cancelar</button>
                <button onClick={fechar} disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#EF4444' }}>
                  <Printer className="w-4 h-4" /> Fechar e Imprimir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
