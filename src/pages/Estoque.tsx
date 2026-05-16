import { useEffect, useState } from 'react'
import { Package, AlertTriangle, TrendingDown, ArrowUpCircle, ArrowDownCircle, RefreshCw, X, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDateTime } from '../lib/utils'

interface ProdutoSaldo {
  id: number
  nome: string
  categoria: string
  estoque_atual: number
  estoque_minimo: number
}
interface Movimentacao {
  id: number
  produto_nome: string
  tipo: 'entrada' | 'saida' | 'ajuste'
  quantidade: number
  saldo_apos: number
  motivo: string
  created_at: string
}

const MOCK_SALDOS: ProdutoSaldo[] = [
  { id: 1, nome: 'Cerveja Brahma 350ml', categoria: 'Bebidas', estoque_atual: 48, estoque_minimo: 24 },
  { id: 2, nome: 'Refrigerante Coca-Cola 2L', categoria: 'Bebidas', estoque_atual: 8, estoque_minimo: 20 },
  { id: 3, nome: 'Arroz Tio João 5kg', categoria: 'Alimentos', estoque_atual: 30, estoque_minimo: 10 },
  { id: 4, nome: 'Detergente Ypê 500ml', categoria: 'Limpeza', estoque_atual: 0, estoque_minimo: 12 },
  { id: 5, nome: 'Shampoo Clear 400ml', categoria: 'Higiene', estoque_atual: 8, estoque_minimo: 6 },
]
const MOCK_MOV: Movimentacao[] = [
  { id: 1, produto_nome: 'Cerveja Brahma 350ml', tipo: 'entrada', quantidade: 48, saldo_apos: 48, motivo: 'Compra NF 001', created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: 2, produto_nome: 'Refrigerante Coca-Cola 2L', tipo: 'saida', quantidade: 4, saldo_apos: 8, motivo: 'Pedido #42', created_at: new Date(Date.now() - 43200000).toISOString() },
  { id: 3, produto_nome: 'Detergente Ypê 500ml', tipo: 'ajuste', quantidade: -12, saldo_apos: 0, motivo: 'Perda por avaria', created_at: new Date(Date.now() - 3600000).toISOString() },
]

const TIPO_LABELS: Record<string, string> = { entrada: 'Entrada', saida: 'Saída', ajuste: 'Ajuste' }
const TIPO_COLORS: Record<string, string> = { entrada: '#22C55E', saida: '#EF4444', ajuste: '#3B82F6' }

export default function Estoque() {
  const [tab, setTab] = useState<'saldo' | 'movimentacoes'>('saldo')
  const [saldos, setSaldos] = useState<ProdutoSaldo[]>([])
  const [movs, setMovs] = useState<Movimentacao[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [movSearch, setMovSearch] = useState('')
  const [movTipo, setMovTipo] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedProduto, setSelectedProduto] = useState<ProdutoSaldo | null>(null)
  const [movForm, setMovForm] = useState({ tipo: 'entrada', quantidade: 1, motivo: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    if (!window.api) {
      setSaldos(MOCK_SALDOS)
      setMovs(MOCK_MOV)
      setLoading(false)
      return
    }
    try {
      const [s, m] = await Promise.all([window.api.estoque.getSaldo(), window.api.estoque.listMovimentacoes({})])
      setSaldos(s)
      setMovs(m)
    } catch { toast.error('Erro ao carregar estoque') }
    finally { setLoading(false) }
  }

  function openMovimentar(p: ProdutoSaldo) {
    setSelectedProduto(p)
    setMovForm({ tipo: 'entrada', quantidade: 1, motivo: '' })
    setModalOpen(true)
  }

  async function movimentar() {
    if (!movForm.motivo.trim()) { toast.error('Informe o motivo'); return }
    if (movForm.quantidade <= 0) { toast.error('Quantidade inválida'); return }
    setSaving(true)
    try {
      if (!window.api) {
        const qtd = movForm.tipo === 'saida' ? -movForm.quantidade : movForm.quantidade
        setSaldos(prev => prev.map(p => p.id === selectedProduto!.id ? { ...p, estoque_atual: Math.max(0, p.estoque_atual + qtd) } : p))
        const newMov: Movimentacao = { id: Date.now(), produto_nome: selectedProduto!.nome, tipo: movForm.tipo as any, quantidade: movForm.quantidade, saldo_apos: Math.max(0, selectedProduto!.estoque_atual + qtd), motivo: movForm.motivo, created_at: new Date().toISOString() }
        setMovs(prev => [newMov, ...prev])
        toast.success('Movimentação registrada')
        setModalOpen(false)
        return
      }
      await window.api.estoque.movimentar({ produto_id: selectedProduto!.id, ...movForm })
      toast.success('Movimentação registrada')
      setModalOpen(false)
      load()
    } catch { toast.error('Erro ao movimentar') }
    finally { setSaving(false) }
  }

  const abaixoMin = saldos.filter(p => p.estoque_atual < p.estoque_minimo).length
  const zerados = saldos.filter(p => p.estoque_atual === 0).length

  const filteredSaldos = saldos.filter(p =>
    p.nome.toLowerCase().includes(search.toLowerCase()) || p.categoria.toLowerCase().includes(search.toLowerCase())
  )
  const filteredMovs = movs.filter(m => {
    const matchSearch = m.produto_nome.toLowerCase().includes(movSearch.toLowerCase())
    const matchTipo = !movTipo || m.tipo === movTipo
    return matchSearch && matchTipo
  })

  function statusInfo(p: ProdutoSaldo) {
    if (p.estoque_atual === 0) return { label: 'Zerado', color: '#EF4444', pct: 0 }
    if (p.estoque_atual < p.estoque_minimo) return { label: 'Baixo', color: '#F5A623', pct: (p.estoque_atual / p.estoque_minimo) * 100 }
    return { label: 'OK', color: '#22C55E', pct: Math.min(100, (p.estoque_atual / (p.estoque_minimo * 2)) * 100) }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Estoque</h1>
        <div className="flex-1" />
        <button onClick={load} className="p-2 rounded-lg" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}><RefreshCw className="w-4 h-4" /></button>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-3 gap-4 p-4">
        {[
          { icon: Package, label: 'Total de Produtos', value: saldos.length, color: '#3B82F6' },
          { icon: AlertTriangle, label: 'Abaixo do Mínimo', value: abaixoMin, color: '#F5A623' },
          { icon: TrendingDown, label: 'Estoque Zerado', value: zerados, color: '#EF4444' },
        ].map(card => (
          <div key={card.label} className="rounded-xl p-4 flex items-center gap-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="p-3 rounded-xl" style={{ background: `${card.color}22` }}>
              <card.icon className="w-6 h-6" style={{ color: card.color }} />
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{card.label}</p>
              <p className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 border-b" style={{ borderColor: 'var(--border)' }}>
        {[['saldo', 'Saldo Atual'], ['movimentacoes', 'Movimentações']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key as any)} className="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
            style={{ borderColor: tab === key ? '#F5A623' : 'transparent', color: tab === key ? '#F5A623' : 'var(--text-secondary)' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {tab === 'saldo' && (
          <>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
              <input className="pl-9 pr-4 py-2 rounded-lg text-sm w-64 outline-none" style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {loading ? <div className="text-center py-10" style={{ color: 'var(--text-secondary)' }}>Carregando...</div> : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Produto', 'Categoria', 'Estoque Atual', 'Mínimo', 'Status', ''].map(h => (
                      <th key={h} className="pb-2 text-left font-semibold px-2" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSaldos.map(p => {
                    const info = statusInfo(p)
                    return (
                      <tr key={p.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                        <td className="py-3 px-2 font-medium" style={{ color: 'var(--text-primary)' }}>{p.nome}</td>
                        <td className="py-3 px-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{p.categoria}</td>
                        <td className="py-3 px-2 font-bold" style={{ color: info.color }}>{p.estoque_atual}</td>
                        <td className="py-3 px-2" style={{ color: 'var(--text-secondary)' }}>{p.estoque_minimo}</td>
                        <td className="py-3 px-2 w-40">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--bg)' }}>
                              <div className="h-2 rounded-full transition-all" style={{ background: info.color, width: `${Math.min(100, info.pct)}%` }} />
                            </div>
                            <span className="text-xs font-medium w-10" style={{ color: info.color }}>{info.label}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <button onClick={() => openMovimentar(p)} className="px-3 py-1 rounded-lg text-xs font-medium" style={{ background: '#F5A62322', color: '#F5A623', border: '1px solid #F5A62344' }}>
                            Movimentar
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </>
        )}

        {tab === 'movimentacoes' && (
          <>
            <div className="flex gap-3 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                <input className="pl-9 pr-4 py-2 rounded-lg text-sm w-56 outline-none" style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  placeholder="Buscar produto..." value={movSearch} onChange={e => setMovSearch(e.target.value)} />
              </div>
              <select className="px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                value={movTipo} onChange={e => setMovTipo(e.target.value)}>
                <option value="">Todos os tipos</option>
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
                <option value="ajuste">Ajuste</option>
              </select>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Data/Hora', 'Produto', 'Tipo', 'Quantidade', 'Saldo Após', 'Motivo'].map(h => (
                    <th key={h} className="pb-2 text-left font-semibold px-2" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredMovs.map(m => (
                  <tr key={m.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                    <td className="py-3 px-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{formatDateTime(m.created_at)}</td>
                    <td className="py-3 px-2 font-medium" style={{ color: 'var(--text-primary)' }}>{m.produto_nome}</td>
                    <td className="py-3 px-2">
                      <span className="px-2 py-1 rounded-full text-xs font-medium" style={{ background: `${TIPO_COLORS[m.tipo]}22`, color: TIPO_COLORS[m.tipo] }}>
                        {TIPO_LABELS[m.tipo]}
                      </span>
                    </td>
                    <td className="py-3 px-2 font-bold" style={{ color: m.tipo === 'saida' ? '#EF4444' : '#22C55E' }}>
                      {m.tipo === 'saida' ? '-' : '+'}{Math.abs(m.quantidade)}
                    </td>
                    <td className="py-3 px-2" style={{ color: 'var(--text-primary)' }}>{m.saldo_apos}</td>
                    <td className="py-3 px-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{m.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Movimentar Modal */}
      {modalOpen && selectedProduto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-xl shadow-2xl" style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Movimentar Estoque</h2>
              <button onClick={() => setModalOpen(false)}><X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="p-3 rounded-lg" style={{ background: 'var(--bg)' }}>
                <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{selectedProduto.nome}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Estoque atual: <strong>{selectedProduto.estoque_atual}</strong></p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Tipo de Movimentação</label>
                <div className="flex gap-2">
                  {[
                    { value: 'entrada', label: 'Entrada', icon: ArrowUpCircle, color: '#22C55E' },
                    { value: 'saida', label: 'Saída', icon: ArrowDownCircle, color: '#EF4444' },
                    { value: 'ajuste', label: 'Ajuste', icon: RefreshCw, color: '#3B82F6' },
                  ].map(opt => (
                    <button key={opt.value} onClick={() => setMovForm(f => ({ ...f, tipo: opt.value }))}
                      className="flex-1 flex flex-col items-center gap-1 py-3 rounded-lg transition-all text-xs font-medium"
                      style={{ border: `2px solid ${movForm.tipo === opt.value ? opt.color : 'var(--border)'}`, color: movForm.tipo === opt.value ? opt.color : 'var(--text-secondary)', background: movForm.tipo === opt.value ? `${opt.color}11` : 'transparent' }}>
                      <opt.icon className="w-4 h-4" />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Quantidade</label>
                <input type="number" min="1" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  value={movForm.quantidade} onChange={e => setMovForm(f => ({ ...f, quantidade: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Motivo *</label>
                <input className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  placeholder="Ex: Compra NF 001, Pedido #42, Perda..." value={movForm.motivo} onChange={e => setMovForm(f => ({ ...f, motivo: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>Cancelar</button>
                <button onClick={movimentar} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#F5A623' }}>
                  {saving ? 'Salvando...' : 'Registrar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
