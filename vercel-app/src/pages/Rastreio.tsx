import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Package, CheckCircle, Truck, Clock, XCircle, RefreshCw } from 'lucide-react'
import { supabase, formatCurrency } from '../lib/supabase'

type Status = 'novo' | 'separando' | 'a_caminho' | 'entregue' | 'cancelado'

const ETAPAS: { status: Status; icon: any; label: string; desc: string }[] = [
  { status: 'novo', icon: Clock, label: 'Pedido Recebido', desc: 'Aguardando confirmação do depósito' },
  { status: 'separando', icon: Package, label: 'Separando', desc: 'Estamos preparando seu pedido' },
  { status: 'a_caminho', icon: Truck, label: 'A Caminho', desc: 'Pedido saiu para entrega' },
  { status: 'entregue', icon: CheckCircle, label: 'Entregue', desc: 'Pedido entregue com sucesso!' },
]

const STATUS_COLORS: Record<Status, string> = {
  novo: '#F5A623',
  separando: '#A855F7',
  a_caminho: '#3B82F6',
  entregue: '#22C55E',
  cancelado: '#EF4444',
}

function statusIndex(status: Status): number {
  const map: Record<Status, number> = { novo: 0, separando: 1, a_caminho: 2, entregue: 3, cancelado: -1 }
  return map[status] ?? 0
}

export default function Rastreio() {
  const { token } = useParams<{ token: string }>()
  const [pedido, setPedido] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [ultimaAtt, setUltimaAtt] = useState(new Date())

  useEffect(() => {
    loadPedido()

    // Realtime subscription
    const channel = supabase
      .channel(`rastreio:${token}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'pedidos_rastreio',
        filter: `token=eq.${token}`,
      }, (payload) => {
        setPedido((prev: any) => ({ ...prev, ...payload.new }))
        setUltimaAtt(new Date())
      })
      .subscribe()

    const interval = setInterval(loadPedido, 30000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [token])

  async function loadPedido() {
    const { data } = await supabase
      .from('pedidos_rastreio')
      .select('*')
      .eq('token', token)
      .single()

    setPedido(data)
    setLoading(false)
    if (data) setUltimaAtt(new Date())
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0a' }}>
      <div className="text-center">
        <div className="w-10 h-10 rounded-full border-2 mx-auto mb-3"
          style={{ borderColor: '#F5A62340', borderTopColor: '#F5A623', animation: 'spin 0.8s linear infinite' }} />
        <p className="text-gray-400 text-sm">Buscando pedido...</p>
      </div>
    </div>
  )

  if (!pedido) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0a0a0a' }}>
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">🔍</div>
        <h1 className="text-xl font-bold mb-2">Pedido não encontrado</h1>
        <p className="text-gray-400 text-sm">Token inválido ou pedido expirado.</p>
        <p className="font-mono text-xs mt-3 px-3 py-1.5 rounded-lg inline-block" style={{ background: '#1a1a1a', color: '#F5A623' }}>
          {token}
        </p>
      </div>
    </div>
  )

  const status = pedido.status as Status
  const isCancelado = status === 'cancelado'
  const currentIndex = statusIndex(status)
  const cor = STATUS_COLORS[status]

  const itens: any[] = pedido.itens_resumo || []

  return (
    <div className="min-h-screen pb-10" style={{ background: '#0a0a0a' }}>
      {/* Header */}
      <div style={{ background: '#111', borderBottom: '1px solid #1e1e1e' }}>
        <div className="max-w-lg mx-auto px-4 py-5">
          <p className="text-xs text-gray-500 mb-1">ACOMPANHAR PEDIDO</p>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Inter, sans-serif' }}>
              <span style={{ color: '#F5A623' }}>Dep</span>Gest
            </h1>
            <button onClick={loadPedido} className="p-2 rounded-xl transition-colors hover:bg-white/10">
              <RefreshCw size={16} className="text-gray-500" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">
        {/* Status principal */}
        <div className="rounded-2xl p-6 text-center fade-up" style={{ background: '#111', border: `1px solid ${cor}30` }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: `${cor}20`, border: `2px solid ${cor}40` }}>
            {isCancelado
              ? <XCircle size={28} style={{ color: cor }} />
              : status === 'entregue'
                ? <CheckCircle size={28} style={{ color: cor }} />
                : status === 'a_caminho'
                  ? <Truck size={28} style={{ color: cor }} />
                  : <Package size={28} style={{ color: cor }} />
            }
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold mb-3"
            style={{ background: `${cor}20`, color: cor, border: `1px solid ${cor}40` }}>
            {!isCancelado && status !== 'entregue' && (
              <span className="w-2 h-2 rounded-full pulse" style={{ background: cor }} />
            )}
            {ETAPAS.find(e => e.status === status)?.label || status}
          </div>

          <p className="text-gray-400 text-sm">
            {isCancelado
              ? `Pedido cancelado${pedido.motivo_cancelamento ? `: ${pedido.motivo_cancelamento}` : ''}`
              : ETAPAS.find(e => e.status === status)?.desc
            }
          </p>

          {status === 'a_caminho' && pedido.motoboy_nome && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm">
              <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold"
                style={{ background: '#3B82F620', color: '#3B82F6', fontSize: 12 }}>
                {pedido.motoboy_nome[0]}
              </div>
              <span style={{ color: '#3B82F6' }}>{pedido.motoboy_nome} está a caminho</span>
            </div>
          )}
        </div>

        {/* Timeline */}
        {!isCancelado && (
          <div className="rounded-2xl p-5" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
            <h3 className="text-xs font-medium text-gray-500 mb-4">PROGRESSO</h3>
            <div className="space-y-0">
              {ETAPAS.map((etapa, i) => {
                const done = i <= currentIndex
                const active = i === currentIndex
                const Icon = etapa.icon
                const etapaCor = done ? STATUS_COLORS[etapa.status] : '#333'
                return (
                  <div key={etapa.status} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                        style={{ background: done ? `${etapaCor}20` : '#1a1a1a', border: `2px solid ${done ? etapaCor : '#2a2a2a'}` }}>
                        <Icon size={14} style={{ color: done ? etapaCor : '#555' }} />
                      </div>
                      {i < ETAPAS.length - 1 && (
                        <div className="w-0.5 flex-1 my-1 min-h-[24px] transition-all"
                          style={{ background: i < currentIndex ? STATUS_COLORS[ETAPAS[i + 1].status] : '#2a2a2a' }} />
                      )}
                    </div>
                    <div className="pb-5 flex-1">
                      <p className="text-sm font-medium" style={{ color: done ? '#fff' : '#555' }}>{etapa.label}</p>
                      {active && <p className="text-xs mt-0.5" style={{ color: etapaCor }}>{etapa.desc}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Detalhes do pedido */}
        <div className="rounded-2xl p-5" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
          <h3 className="text-xs font-medium text-gray-500 mb-3">DETALHES DO PEDIDO</h3>

          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Cliente</span>
              <span className="font-medium">{pedido.cliente_nome}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Origem</span>
              <span className="font-medium capitalize">{pedido.origem === 'online' ? '📱 Online' : '🏪 Balcão'}</span>
            </div>
          </div>

          {itens.length > 0 && (
            <div className="space-y-2 pt-3" style={{ borderTop: '1px solid #1e1e1e' }}>
              {itens.map((item: any, i: number) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-300">{item.nome}</span>
                  <span className="text-gray-400">x{item.quantidade}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between font-bold text-base mt-4 pt-3" style={{ borderTop: '1px solid #1e1e1e' }}>
            <span>Total</span>
            <span style={{ color: '#F5A623' }}>{formatCurrency(pedido.total)}</span>
          </div>
        </div>

        {/* Token */}
        <div className="text-center">
          <p className="text-xs text-gray-600 mb-1">Token do pedido</p>
          <p className="font-mono text-sm font-bold" style={{ color: '#F5A623' }}>{token}</p>
          <p className="text-xs text-gray-700 mt-2">
            Última atualização: {ultimaAtt.toLocaleTimeString('pt-BR')}
          </p>
        </div>
      </div>
    </div>
  )
}
