import { useEffect, useState } from 'react'
import { Plus, X, ChevronDown, ChevronRight, Truck, CheckCircle, Clock, Edit2, ToggleLeft, ToggleRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDateTime } from '../lib/utils'

interface Motoboy {
  id: number
  nome: string
  telefone: string
  veiculo: string
  placa: string
  ativo: boolean
}
interface Entrega {
  id: number
  pedido_numero: string
  cliente_nome: string
  endereco: string
  saiu_em: string
  chegou_em: string | null
  status: 'em_andamento' | 'entregue'
  motoboy_id: number
}

const MOCK_MOTOBOYS: Motoboy[] = [
  { id: 1, nome: 'Carlos Motoboy', telefone: '(11) 98888-0001', veiculo: 'Moto', placa: 'ABC-1234', ativo: true },
  { id: 2, nome: 'Rafael Entregador', telefone: '(11) 98888-0002', veiculo: 'Moto', placa: 'DEF-5678', ativo: true },
  { id: 3, nome: 'Bruno Inativo', telefone: '(11) 98888-0003', veiculo: 'Bicicleta', placa: '', ativo: false },
]
const MOCK_ENTREGAS: Entrega[] = [
  { id: 1, pedido_numero: '#003', cliente_nome: 'Pedro Santos', endereco: 'Rua da Paz, 7 - Jardins', saiu_em: new Date(Date.now() - 2400000).toISOString(), chegou_em: null, status: 'em_andamento', motoboy_id: 1 },
  { id: 2, pedido_numero: '#001', cliente_nome: 'João Silva', endereco: 'Rua das Flores, 10 - Centro', saiu_em: new Date(Date.now() - 7200000).toISOString(), chegou_em: new Date(Date.now() - 6000000).toISOString(), status: 'entregue', motoboy_id: 1 },
  { id: 3, pedido_numero: '#002', cliente_nome: 'Ana Costa', endereco: 'Av. Principal, 45 - Vila Nova', saiu_em: new Date(Date.now() - 3600000).toISOString(), chegou_em: new Date(Date.now() - 3000000).toISOString(), status: 'entregue', motoboy_id: 2 },
]

const EMPTY_FORM = { nome: '', telefone: '', veiculo: '', placa: '', ativo: true }

export default function Entregas() {
  const [tab, setTab] = useState<'entregas' | 'motoboys'>('entregas')
  const [motoboys, setMotoboys] = useState<Motoboy[]>([])
  const [entregas, setEntregas] = useState<Entrega[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [modalOpen, setModalOpen] = useState(false)
  const [editMotoboy, setEditMotoboy] = useState<Motoboy | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    if (!window.api) { setMotoboys(MOCK_MOTOBOYS); setEntregas(MOCK_ENTREGAS); setLoading(false); return }
    try {
      const [m, e] = await Promise.all([window.api.motoboys.list(), window.api.motoboys.getEntregas(0)])
      setMotoboys(m)
      setEntregas(e)
    } catch { toast.error('Erro ao carregar entregas') }
    finally { setLoading(false) }
  }

  function toggleExpanded(id: number) {
    setExpanded(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }

  function openNew() { setEditMotoboy(null); setForm({ ...EMPTY_FORM }); setModalOpen(true) }
  function openEdit(m: Motoboy) { setEditMotoboy(m); setForm({ nome: m.nome, telefone: m.telefone, veiculo: m.veiculo, placa: m.placa, ativo: m.ativo }); setModalOpen(true) }

  async function save() {
    if (!form.nome.trim()) { toast.error('Nome obrigatório'); return }
    setSaving(true)
    try {
      if (!window.api) {
        if (editMotoboy) setMotoboys(prev => prev.map(m => m.id === editMotoboy.id ? { ...m, ...form } : m))
        else setMotoboys(prev => [...prev, { ...form, id: Date.now() }])
        toast.success(editMotoboy ? 'Motoboy atualizado' : 'Motoboy criado')
        setModalOpen(false)
        return
      }
      if (editMotoboy) await window.api.motoboys.update(editMotoboy.id, form)
      else await window.api.motoboys.create(form)
      toast.success(editMotoboy ? 'Motoboy atualizado' : 'Motoboy criado')
      setModalOpen(false)
      load()
    } catch { toast.error('Erro ao salvar') }
    finally { setSaving(false) }
  }

  async function deleteMotoboy(id: number) {
    if (!confirm('Remover este motoboy?')) return
    if (!window.api) { setMotoboys(prev => prev.filter(m => m.id !== id)); toast.success('Removido'); return }
    try { await window.api.motoboys.delete(id); toast.success('Removido'); load() }
    catch { toast.error('Erro ao remover') }
  }

  const hoje = new Date().toDateString()
  const entregasHoje = entregas.filter(e => new Date(e.saiu_em).toDateString() === hoje)
  const emAndamento = entregas.filter(e => e.status === 'em_andamento')
  const entregues = entregas.filter(e => e.status === 'entregue' && new Date(e.saiu_em).toDateString() === hoje)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Entregas</h1>
        <div className="flex-1" />
        {tab === 'motoboys' && (
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#F5A623' }}>
            <Plus className="w-4 h-4" /> Novo Motoboy
          </button>
        )}
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-3 gap-4 p-4">
        {[
          { label: 'Entregas Hoje', value: entregasHoje.length, color: '#F5A623', icon: Truck },
          { label: 'Em Andamento', value: emAndamento.length, color: '#3B82F6', icon: Clock },
          { label: 'Concluídas', value: entregues.length, color: '#22C55E', icon: CheckCircle },
        ].map(c => (
          <div key={c.label} className="rounded-xl p-4 flex items-center gap-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="p-3 rounded-xl" style={{ background: `${c.color}22` }}>
              <c.icon className="w-6 h-6" style={{ color: c.color }} />
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{c.label}</p>
              <p className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 border-b" style={{ borderColor: 'var(--border)' }}>
        {[['entregas', 'Entregas'], ['motoboys', 'Motoboys']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as any)} className="px-4 py-2 text-sm font-medium border-b-2"
            style={{ borderColor: tab === k ? '#F5A623' : 'transparent', color: tab === k ? '#F5A623' : 'var(--text-secondary)' }}>{l}</button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? <div className="text-center py-10" style={{ color: 'var(--text-secondary)' }}>Carregando...</div> : (
          <>
            {tab === 'entregas' && (
              <div className="space-y-3">
                {motoboys.filter(m => m.ativo).map(mb => {
                  const mbEntregas = entregas.filter(e => e.motoboy_id === mb.id)
                  const mbEmAndamento = mbEntregas.find(e => e.status === 'em_andamento')
                  const mbConcluidas = mbEntregas.filter(e => e.status === 'entregue' && new Date(e.saiu_em).toDateString() === hoje)
                  const isOpen = expanded.has(mb.id)
                  return (
                    <div key={mb.id} className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                      <button className="w-full flex items-center gap-3 p-4 text-left" onClick={() => toggleExpanded(mb.id)}>
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ background: '#F5A623' }}>
                          {mb.nome.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{mb.nome}</p>
                          <p className="text-xs" style={{ color: mbEmAndamento ? '#3B82F6' : 'var(--text-secondary)' }}>
                            {mbEmAndamento ? `Em entrega: Pedido ${mbEmAndamento.pedido_numero}` : 'Disponível'}
                          </p>
                        </div>
                        <div className="text-center px-4">
                          <p className="text-xl font-bold" style={{ color: '#22C55E' }}>{mbConcluidas.length}</p>
                          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>hoje</p>
                        </div>
                        {isOpen ? <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} /> : <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />}
                      </button>
                      {isOpen && (
                        <div style={{ borderTop: '1px solid var(--border)' }}>
                          <table className="w-full text-sm">
                            <thead><tr style={{ background: 'var(--bg)' }}>
                              {['Pedido', 'Cliente', 'Endereço', 'Saiu', 'Chegou', 'Status'].map(h => <th key={h} className="py-2 px-4 text-left text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{h}</th>)}
                            </tr></thead>
                            <tbody>
                              {mbEntregas.map(e => (
                                <tr key={e.id} style={{ borderTop: '1px solid var(--border)' }}>
                                  <td className="py-2 px-4 font-mono text-xs" style={{ color: 'var(--text-primary)' }}>{e.pedido_numero}</td>
                                  <td className="py-2 px-4 text-xs" style={{ color: 'var(--text-primary)' }}>{e.cliente_nome}</td>
                                  <td className="py-2 px-4 text-xs" style={{ color: 'var(--text-secondary)' }}>{e.endereco}</td>
                                  <td className="py-2 px-4 text-xs" style={{ color: 'var(--text-secondary)' }}>{new Date(e.saiu_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                                  <td className="py-2 px-4 text-xs" style={{ color: 'var(--text-secondary)' }}>{e.chegou_em ? new Date(e.chegou_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                                  <td className="py-2 px-4">
                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: e.status === 'entregue' ? '#22C55E22' : '#3B82F622', color: e.status === 'entregue' ? '#22C55E' : '#3B82F6' }}>
                                      {e.status === 'entregue' ? 'Entregue' : 'Em andamento'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                              {mbEntregas.length === 0 && (
                                <tr><td colSpan={6} className="py-4 px-4 text-center text-xs" style={{ color: 'var(--text-secondary)' }}>Nenhuma entrega registrada</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {tab === 'motoboys' && (
              <div className="space-y-3">
                {motoboys.map(m => (
                  <div key={m.id} className="rounded-xl p-4 flex items-center gap-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ background: m.ativo ? '#F5A623' : 'var(--text-secondary)' }}>
                      {m.nome.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{m.nome}</p>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{m.telefone} · {m.veiculo}{m.placa ? ` · ${m.placa}` : ''}</p>
                    </div>
                    <span className="px-2 py-1 rounded-full text-xs font-medium" style={{ background: m.ativo ? '#22C55E22' : '#EF444422', color: m.ativo ? '#22C55E' : '#EF4444' }}>
                      {m.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                    <button onClick={() => openEdit(m)} className="p-2 rounded" style={{ color: '#F5A623' }}><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => deleteMotoboy(m.id)} className="p-2 rounded" style={{ color: '#EF4444' }}><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Motoboy Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-96 rounded-xl shadow-2xl" style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>{editMotoboy ? 'Editar Motoboy' : 'Novo Motoboy'}</h2>
              <button onClick={() => setModalOpen(false)}><X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} /></button>
            </div>
            <div className="p-4 space-y-3">
              {[
                { label: 'Nome *', field: 'nome' },
                { label: 'Telefone', field: 'telefone' },
                { label: 'Veículo', field: 'veiculo' },
                { label: 'Placa', field: 'placa' },
              ].map(({ label, field }) => (
                <div key={field}>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
                  <input className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    value={(form as any)[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
                </div>
              ))}
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Ativo</label>
                <button onClick={() => setForm(f => ({ ...f, ativo: !f.ativo }))}>
                  {form.ativo ? <ToggleRight className="w-7 h-7" style={{ color: '#22C55E' }} /> : <ToggleLeft className="w-7 h-7" style={{ color: 'var(--text-secondary)' }} />}
                </button>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setModalOpen(false)} className="flex-1 px-3 py-2 rounded-lg text-sm" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>Cancelar</button>
                <button onClick={save} disabled={saving} className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#F5A623' }}>
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
