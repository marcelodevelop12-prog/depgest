import { useEffect, useState, useCallback } from 'react'
import { MessageCircle, X, RefreshCw, Clock, CheckCircle, Truck, XCircle, ShoppingBag, Wifi, MapPin, CreditCard, FileText, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency, formatDateTime, statusLabel, whatsappUrl, gerarLinkRastreio } from '../lib/utils'

interface Item { nome: string; quantidade: number; preco_unitario: number }
interface Pedido {
  id: number
  numero: string
  status: 'novo' | 'separando' | 'a_caminho' | 'entregue' | 'cancelado'
  cliente_nome: string
  cliente_telefone: string
  itens: Item[]
  total: number
  origem: 'balcao' | 'online'
  created_at: string
  token_rastreio?: string
  motoboy_nome?: string
}
interface Motoboy { id: number; nome: string; telefone: string; ativo: boolean }

const MOCK_PEDIDOS: Pedido[] = [
  { id: 1, numero: '#001', status: 'novo', cliente_nome: 'João Silva', cliente_telefone: '11999990001', itens: [{ nome: 'Cerveja Brahma 350ml', quantidade: 12, preco_unitario: 4.5 }, { nome: 'Coca-Cola 2L', quantidade: 2, preco_unitario: 9.9 }], total: 73.8, origem: 'online', created_at: new Date(Date.now() - 600000).toISOString() },
  { id: 2, numero: '#002', status: 'separando', cliente_nome: 'Maria Souza', cliente_telefone: '11999990002', itens: [{ nome: 'Arroz Tio João 5kg', quantidade: 2, preco_unitario: 28.9 }], total: 57.8, origem: 'balcao', created_at: new Date(Date.now() - 1200000).toISOString() },
  { id: 3, numero: '#003', status: 'a_caminho', cliente_nome: 'Pedro Santos', cliente_telefone: '11999990003', itens: [{ nome: 'Detergente Ypê 500ml', quantidade: 3, preco_unitario: 3.5 }], total: 10.5, origem: 'online', created_at: new Date(Date.now() - 3600000).toISOString(), token_rastreio: 'tok123', motoboy_nome: 'Carlos Motoboy' },
  { id: 4, numero: '#004', status: 'entregue', cliente_nome: 'Ana Oliveira', cliente_telefone: '11999990004', itens: [{ nome: 'Cerveja Brahma 350ml', quantidade: 24, preco_unitario: 4.5 }], total: 108, origem: 'balcao', created_at: new Date(Date.now() - 7200000).toISOString() },
  { id: 5, numero: '#005', status: 'cancelado', cliente_nome: 'Lucas Lima', cliente_telefone: '11999990005', itens: [{ nome: 'Coca-Cola 2L', quantidade: 1, preco_unitario: 9.9 }], total: 9.9, origem: 'online', created_at: new Date(Date.now() - 10800000).toISOString() },
]
const MOCK_MOTOBOYS: Motoboy[] = [
  { id: 1, nome: 'Carlos Motoboy', telefone: '11988880001', ativo: true },
  { id: 2, nome: 'Rafael Entregador', telefone: '11988880002', ativo: true },
]

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: any }> = {
  novo: { color: '#F5A623', bg: '#F5A62322', icon: Clock },
  separando: { color: '#A855F7', bg: '#A855F722', icon: ShoppingBag },
  a_caminho: { color: '#3B82F6', bg: '#3B82F622', icon: Truck },
  entregue: { color: '#22C55E', bg: '#22C55E22', icon: CheckCircle },
  cancelado: { color: '#EF4444', bg: '#EF444422', icon: XCircle },
}
const STATUS_FALLBACK = { color: '#6B7280', bg: '#6B728022', icon: Clock }
const ALL_STATUS = ['novo', 'separando', 'a_caminho', 'entregue', 'cancelado'] as const
type StatusType = typeof ALL_STATUS[number]

export default function Pedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [motoboys, setMotoboys] = useState<Motoboy[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusType | 'todos'>('todos')
  const [cancelModal, setCancelModal] = useState<Pedido | null>(null)
  const [cancelMotivo, setCancelMotivo] = useState('')
  const [motoboyModal, setMotoboyModal] = useState<Pedido | null>(null)
  const [selectedMotoboy, setSelectedMotoboy] = useState<number | null>(null)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [detalhe, setDetalhe] = useState<any | null>(null)
  const [loadingDetalhe, setLoadingDetalhe] = useState(false)

  const load = useCallback(async () => {
    if (!window.api) { setPedidos(MOCK_PEDIDOS); setMotoboys(MOCK_MOTOBOYS); setLoading(false); return }
    try {
      const [rawPedidos, m] = await Promise.all([window.api.pedidos.list(), window.api.motoboys.list()])
      const p = rawPedidos.map((r: any) => ({
        ...r,
        itens: (() => {
          const arr = typeof r.itens === 'string' ? JSON.parse(r.itens) : (r.itens ?? [])
          return Array.isArray(arr) ? arr.filter((i: any) => i.nome != null) : []
        })(),
      }))
      setPedidos(p)
      setMotoboys(m)
    } catch { toast.error('Erro ao carregar pedidos') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [load])

  async function updateStatus(pedido: Pedido, novoStatus: StatusType, extra?: any) {
    setActionLoading(pedido.id)
    try {
      if (!window.api) {
        setPedidos(prev => prev.map(p => p.id === pedido.id ? { ...p, status: novoStatus, ...extra } : p))
        toast.success(`Pedido ${novoStatus === 'entregue' ? 'entregue' : 'atualizado'}`)
        return
      }
      await window.api.pedidos.updateStatus(pedido.id, novoStatus, extra)
      toast.success('Status atualizado')
      load()
    } catch { toast.error('Erro ao atualizar status') }
    finally { setActionLoading(null) }
  }

  async function cancelar() {
    if (!cancelMotivo.trim()) { toast.error('Informe o motivo'); return }
    await updateStatus(cancelModal!, 'cancelado', { motivo_cancelamento: cancelMotivo })
    setCancelModal(null)
    setCancelMotivo('')
  }

  async function confirmarSaiu() {
    if (!selectedMotoboy) { toast.error('Selecione um motoboy'); return }
    const mb = motoboys.find(m => m.id === selectedMotoboy)
    await updateStatus(motoboyModal!, 'a_caminho', { motoboy_id: selectedMotoboy, motoboy_nome: mb?.nome })
    setMotoboyModal(null)
    setSelectedMotoboy(null)
  }

  async function abrirDetalhe(p: Pedido) {
    setDetalhe(p)
    setLoadingDetalhe(true)
    try {
      if (window.api) {
        const full = await window.api.pedidos.get(p.id)
        if (full) setDetalhe(full)
      }
    } catch { /* mantém dados da lista */ }
    finally { setLoadingDetalhe(false) }
  }

  function openWhatsApp(p: Pedido) {
    let msg = `Olá ${p.cliente_nome}! Seu pedido ${p.numero} `
    if (p.status === 'a_caminho' && p.token_rastreio) {
      msg += `está a caminho! Acompanhe em tempo real: ${gerarLinkRastreio(p.token_rastreio)}`
    } else if (p.status === 'entregue') {
      msg += `foi entregue! Obrigado pela preferência. 😊`
    } else {
      msg += `está sendo preparado e em breve sairá para entrega.`
    }
    window.open(whatsappUrl(p.cliente_telefone, msg), '_blank')
  }

  const counts = ALL_STATUS.reduce((acc, s) => ({ ...acc, [s]: pedidos.filter(p => p.status === s).length }), {} as Record<string, number>)
  const filtered = statusFilter === 'todos' ? pedidos : pedidos.filter(p => p.status === statusFilter)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Pedidos</h1>
        <div className="flex items-center gap-1 text-xs px-2 py-1 rounded-full" style={{ background: '#22C55E22', color: '#22C55E' }}>
          <Wifi className="w-3 h-3" /> Ao vivo
        </div>
        <div className="flex-1" />
        <button onClick={load} className="p-2 rounded-lg" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}><RefreshCw className="w-4 h-4" /></button>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 px-4 pt-3 overflow-x-auto">
        <button onClick={() => setStatusFilter('todos')}
          className="flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium whitespace-nowrap border-b-2"
          style={{ borderColor: statusFilter === 'todos' ? '#F5A623' : 'transparent', color: statusFilter === 'todos' ? '#F5A623' : 'var(--text-secondary)' }}>
          Todos <span className="px-1.5 py-0.5 rounded-full text-xs" style={{ background: 'var(--bg)' }}>{pedidos.length}</span>
        </button>
        {ALL_STATUS.map(s => {
          const cfg = STATUS_CONFIG[s]
          return (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium whitespace-nowrap border-b-2"
              style={{ borderColor: statusFilter === s ? cfg.color : 'transparent', color: statusFilter === s ? cfg.color : 'var(--text-secondary)' }}>
              {statusLabel(s)} <span className="px-1.5 py-0.5 rounded-full text-xs" style={{ background: cfg.bg, color: cfg.color }}>{counts[s]}</span>
            </button>
          )
        })}
      </div>
      <div style={{ borderBottom: '1px solid var(--border)' }} />

      {/* Cards Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center py-10" style={{ color: 'var(--text-secondary)' }}>Carregando pedidos...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10" style={{ color: 'var(--text-secondary)' }}>Nenhum pedido encontrado</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(p => {
              const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG['novo']
              const Icon = cfg.icon
              const isLoading = actionLoading === p.id
              const itens = Array.isArray(p.itens) ? p.itens : []
              return (
                <div key={p.id} className="rounded-xl overflow-hidden cursor-pointer hover:ring-1 hover:ring-white/10 transition-all"
                  style={{ background: 'var(--card)', border: `1px solid var(--border)` }}
                  onClick={() => abrirDetalhe(p)}>
                  {/* Card header */}
                  <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{p.numero}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1" style={{ background: cfg.bg, color: cfg.color }}>
                        <Icon className="w-3 h-3" /> {statusLabel(p.status)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: p.origem === 'online' ? '#3B82F622' : '#6B728022', color: p.origem === 'online' ? '#3B82F6' : '#6B7280' }}>
                        {p.origem === 'online' ? 'Online' : 'Balcão'}
                      </span>
                      <button onClick={e => { e.stopPropagation(); openWhatsApp(p) }} className="p-1 rounded" style={{ color: '#22C55E' }}><MessageCircle className="w-4 h-4" /></button>
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="px-4 py-3">
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{p.cliente_nome}</p>
                    <p className="text-xs mt-0.5 mb-2" style={{ color: 'var(--text-secondary)' }}>{formatDateTime(p.created_at)}</p>
                    <div className="space-y-1 mb-3">
                      {itens.slice(0, 2).map((it: any, i: number) => (
                        <p key={i} className="text-xs" style={{ color: 'var(--text-secondary)' }}>{it.quantidade}x {it.nome}</p>
                      ))}
                      {itens.length > 2 && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>+{itens.length - 2} item(ns)</p>}
                    </div>
                    {p.motoboy_nome && (
                      <p className="text-xs mb-2" style={{ color: '#3B82F6' }}>Motoboy: {p.motoboy_nome}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="font-bold" style={{ color: '#F5A623' }}>{formatCurrency(p.total)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  {p.status !== 'entregue' && p.status !== 'cancelado' && (
                    <div className="px-4 pb-3 flex flex-wrap gap-2" onClick={e => e.stopPropagation()}>
                      {p.status === 'novo' && (
                        <button onClick={() => updateStatus(p, 'separando')} disabled={isLoading}
                          className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: '#A855F7' }}>
                          Aceitar
                        </button>
                      )}
                      {p.status === 'separando' && (
                        <button onClick={() => { setMotoboyModal(p); setSelectedMotoboy(null) }} disabled={isLoading}
                          className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: '#3B82F6' }}>
                          Saiu para Entrega
                        </button>
                      )}
                      {p.status === 'a_caminho' && (
                        <button onClick={() => updateStatus(p, 'entregue')} disabled={isLoading}
                          className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: '#22C55E' }}>
                          Entregue
                        </button>
                      )}
                      <button onClick={() => { setCancelModal(p); setCancelMotivo('') }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: '#EF444422', color: '#EF4444', border: '1px solid #EF444444' }}>
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Painel de Detalhe */}
      {detalhe && (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setDetalhe(null)}>
          <div className="w-full max-w-md h-full flex flex-col shadow-2xl overflow-hidden"
            style={{ background: 'var(--card)' }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                  Pedido {detalhe.numero}
                </span>
                {(() => {
                  const cfg = STATUS_CONFIG[detalhe.status] ?? STATUS_CONFIG['novo']
                  const Icon = cfg.icon
                  return (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1"
                      style={{ background: cfg.bg, color: cfg.color }}>
                      <Icon className="w-3 h-3" /> {statusLabel(detalhe.status ?? 'novo')}
                    </span>
                  )
                })()}
              </div>
              <button onClick={() => setDetalhe(null)}>
                <X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>

            {/* Corpo */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {loadingDetalhe && (
                <p className="text-xs text-center" style={{ color: 'var(--text-secondary)' }}>Carregando detalhes...</p>
              )}

              {/* Cliente */}
              <div className="rounded-xl p-4 space-y-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-secondary)' }}>Cliente</p>
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{detalhe.cliente_nome || '—'}</p>
                {detalhe.cliente_telefone && (
                  <button onClick={() => openWhatsApp(detalhe)}
                    className="flex items-center gap-1.5 text-xs" style={{ color: '#22C55E' }}>
                    <MessageCircle className="w-3.5 h-3.5" /> {detalhe.cliente_telefone}
                  </button>
                )}
                {detalhe.cliente_endereco && (
                  <p className="flex items-start gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {detalhe.cliente_endereco}
                  </p>
                )}
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {formatDateTime(detalhe.created_at)}
                  {detalhe.origem && <span className="ml-2 opacity-60">• {detalhe.origem === 'online' ? 'Online' : 'Balcão'}</span>}
                </p>
              </div>

              {/* Itens */}
              <div className="rounded-xl p-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-secondary)' }}>Itens</p>
                <div className="space-y-2">
                  {(Array.isArray(detalhe.itens) ? detalhe.itens : []).map((it: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span style={{ color: 'var(--text-primary)' }}>{it.quantidade}x {it.nome}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {it.preco_unitario != null ? formatCurrency(it.preco_unitario * it.quantidade) : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totais */}
              <div className="rounded-xl p-4 space-y-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-secondary)' }}>Pagamento</p>
                {(detalhe.subtotal ?? 0) !== (detalhe.total ?? 0) && (
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
                    <span>{formatCurrency(detalhe.subtotal ?? 0)}</span>
                  </div>
                )}
                {(detalhe.desconto ?? 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--text-secondary)' }}>Desconto</span>
                    <span style={{ color: '#22C55E' }}>- {formatCurrency(detalhe.desconto)}</span>
                  </div>
                )}
                {(detalhe.taxa_entrega ?? 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--text-secondary)' }}>Taxa de entrega</span>
                    <span>{formatCurrency(detalhe.taxa_entrega)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base pt-2"
                  style={{ borderTop: '1px solid var(--border)' }}>
                  <span>Total</span>
                  <span style={{ color: '#F5A623' }}>{formatCurrency(detalhe.total ?? 0)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs pt-1" style={{ color: 'var(--text-secondary)' }}>
                  <CreditCard className="w-3.5 h-3.5" />
                  {detalhe.forma_pagamento || '—'}
                  {detalhe.forma_pagamento2 && ` + ${detalhe.forma_pagamento2}`}
                  {(detalhe.troco ?? 0) > 0 && ` • Troco: ${formatCurrency(detalhe.troco)}`}
                </div>
              </div>

              {/* Observação */}
              {detalhe.observacao && (
                <div className="rounded-xl p-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>Observação</p>
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{detalhe.observacao}</p>
                </div>
              )}

              {/* Rastreio */}
              {detalhe.token_rastreio && (
                <button onClick={() => window.api?.system.openExternal(gerarLinkRastreio(detalhe.token_rastreio))}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  <ExternalLink className="w-4 h-4" /> Ver rastreio do cliente
                </button>
              )}

              {/* Cancelamento */}
              {detalhe.status === 'cancelado' && detalhe.motivo_cancelamento && (
                <div className="rounded-xl p-4" style={{ background: '#EF444410', border: '1px solid #EF444430' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#EF4444' }}>Motivo do cancelamento</p>
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{detalhe.motivo_cancelamento}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-96 rounded-xl shadow-2xl" style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Cancelar Pedido {cancelModal.numero}</h2>
              <button onClick={() => setCancelModal(null)}><X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Motivo do cancelamento *</label>
                <textarea rows={3} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  placeholder="Informe o motivo..." value={cancelMotivo} onChange={e => setCancelMotivo(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setCancelModal(null)} className="flex-1 px-3 py-2 rounded-lg text-sm" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>Voltar</button>
                <button onClick={cancelar} className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#EF4444' }}>Confirmar Cancelamento</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Motoboy Modal */}
      {motoboyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-96 rounded-xl shadow-2xl" style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Selecionar Motoboy</h2>
              <button onClick={() => setMotoboyModal(null)}><X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} /></button>
            </div>
            <div className="p-4 space-y-2">
              {motoboys.filter(m => m.ativo).map(m => (
                <label key={m.id} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer" style={{ border: `2px solid ${selectedMotoboy === m.id ? '#F5A623' : 'var(--border)'}`, background: selectedMotoboy === m.id ? '#F5A62311' : 'transparent' }}>
                  <input type="radio" name="motoboy" value={m.id} checked={selectedMotoboy === m.id} onChange={() => setSelectedMotoboy(m.id)} className="accent-amber-500" />
                  <div>
                    <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{m.nome}</p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{m.telefone}</p>
                  </div>
                </label>
              ))}
              <div className="flex gap-2 pt-2">
                <button onClick={() => setMotoboyModal(null)} className="flex-1 px-3 py-2 rounded-lg text-sm" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>Cancelar</button>
                <button onClick={confirmarSaiu} className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#3B82F6' }}>Confirmar Saída</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
