import { useEffect, useState } from 'react'
import { Search, Plus, X, MessageCircle, ChevronRight, ChevronLeft, CreditCard, ArrowUpCircle, ArrowDownCircle, Archive, BookCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency, formatDate, formatDateTime, whatsappUrl } from '../lib/utils'

interface Cliente {
  id: number
  nome: string
  cpf: string
  telefone: string
  endereco: string
  bairro: string
  cidade: string
  limite_fiado: number
  observacoes: string
  saldo_fiado: number
  total_compras: number
}
interface FiadoMov {
  id: number
  tipo: 'debito' | 'credito'
  valor: number
  descricao: string
  created_at: string
}

const MOCK_CLIENTES: Cliente[] = [
  { id: 1, nome: 'João Silva', cpf: '123.456.789-00', telefone: '(11) 99999-0001', endereco: 'Rua das Flores, 10', bairro: 'Centro', cidade: 'São Paulo', limite_fiado: 200, observacoes: '', saldo_fiado: 85.5, total_compras: 1240 },
  { id: 2, nome: 'Maria Souza', cpf: '234.567.890-11', telefone: '(11) 99999-0002', endereco: 'Av. Principal, 45', bairro: 'Vila Nova', cidade: 'São Paulo', limite_fiado: 500, observacoes: 'Cliente preferencial', saldo_fiado: 0, total_compras: 3800 },
  { id: 3, nome: 'Pedro Santos', cpf: '345.678.901-22', telefone: '(11) 99999-0003', endereco: 'Rua da Paz, 7', bairro: 'Jardins', cidade: 'São Paulo', limite_fiado: 150, observacoes: '', saldo_fiado: 142.0, total_compras: 680 },
  { id: 4, nome: 'Ana Oliveira', cpf: '456.789.012-33', telefone: '(11) 99999-0004', endereco: 'Travessa do Sol, 22', bairro: 'Boa Vista', cidade: 'São Paulo', limite_fiado: 300, observacoes: '', saldo_fiado: 0, total_compras: 2100 },
]
const MOCK_FIADO_MOVS: FiadoMov[] = [
  { id: 1, tipo: 'debito', valor: 50, descricao: 'Pedido #38', created_at: new Date(Date.now() - 86400000 * 3).toISOString() },
  { id: 2, tipo: 'debito', valor: 35.5, descricao: 'Pedido #40', created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: 3, tipo: 'credito', valor: 0, descricao: '', created_at: '' },
]

const EMPTY_FORM = { nome: '', cpf: '', telefone: '', endereco: '', bairro: '', cidade: '', limite_fiado: 0, observacoes: '' }

// Semáforo do fiado: verde (confortável) → amarelo (se aproximando do limite) → vermelho (atingiu/passou)
function fiadoCor(saldo: number, limite: number): string {
  if (!saldo || saldo <= 0) return '#22C55E'           // sem dívida
  if (!limite || limite <= 0) return '#EF4444'          // tem dívida e sem limite definido
  const pct = saldo / limite
  if (pct >= 1) return '#EF4444'                         // chegou/passou o limite
  if (pct >= 0.8) return '#F5A623'                       // se aproximando
  return '#22C55E'                                       // confortável
}

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editCliente, setEditCliente] = useState<Cliente | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [fiadoPanel, setFiadoPanel] = useState<Cliente | null>(null)
  const [fiadoMovs, setFiadoMovs] = useState<FiadoMov[]>([])
  const [fiadoTab, setFiadoTab] = useState<'resumo' | 'extrato' | 'fechamentos'>('resumo')
  const [pagamentoModal, setPagamentoModal] = useState(false)
  const [debitoModal, setDebitoModal] = useState(false)
  const [pagValor, setPagValor] = useState('')
  const [debDescricao, setDebDescricao] = useState('')
  const [debValor, setDebValor] = useState('')
  const [ciclos, setCiclos] = useState<any[]>([])
  const [cicloView, setCicloView] = useState<any | null>(null)
  const [cicloMovs, setCicloMovs] = useState<any[]>([])
  const [fecharModal, setFecharModal] = useState(false)
  const [fechando, setFechando] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    if (!window.api) { setClientes(MOCK_CLIENTES); setLoading(false); return }
    try {
      const c = await window.api.clientes.list()
      setClientes(c)
    } catch { toast.error('Erro ao carregar clientes') }
    finally { setLoading(false) }
  }

  async function openFiado(c: Cliente) {
    setFiadoPanel(c)
    setFiadoTab('resumo')
    setCicloView(null)
    if (!window.api) {
      setFiadoMovs(MOCK_FIADO_MOVS.filter(m => m.descricao).map(m => ({ ...m })))
      setCiclos([])
      return
    }
    try {
      const res = await window.api.clientes.getFiado(c.id)
      const movs = Array.isArray(res) ? res : (res?.movimentacoes ?? [])
      setFiadoMovs(movs)
      if (res && typeof res === 'object' && 'saldo' in res) {
        setFiadoPanel(prev => prev ? { ...prev, saldo_fiado: res.saldo, limite_fiado: res.limite } : prev)
      }
    } catch { toast.error('Erro ao carregar fiado') }
    // Fechamentos: carrega à parte, não deve bloquear/quebrar o painel de fiado
    try {
      setCiclos(await window.api.clientes.listCiclos(c.id))
    } catch { setCiclos([]) }
  }

  async function verCiclo(ciclo: any) {
    setCicloView(ciclo)
    if (!window.api) { setCicloMovs([]); return }
    try { setCicloMovs(await window.api.clientes.cicloMovimentacoes(ciclo.id)) } catch { setCicloMovs([]) }
  }

  async function fecharConta() {
    if (!fiadoPanel) return
    setFechando(true)
    try {
      if (!window.api) { toast.success('Conta fechada (demo)'); setFecharModal(false); return }
      const r = await window.api.clientes.fecharCiclo({ cliente_id: fiadoPanel.id })
      toast.success(`Fechamento #${r.numero} concluído`)
      setFecharModal(false)
      await load()
      await openFiado(fiadoPanel)
      setFiadoTab('fechamentos')
    } catch (e: any) { toast.error(e?.message || 'Erro ao fechar conta') }
    finally { setFechando(false) }
  }

  function openNew() { setEditCliente(null); setForm({ ...EMPTY_FORM }); setModalOpen(true) }
  function openEdit(c: Cliente) { setEditCliente(c); setForm({ nome: c.nome, cpf: c.cpf, telefone: c.telefone, endereco: c.endereco, bairro: c.bairro, cidade: c.cidade, limite_fiado: c.limite_fiado, observacoes: c.observacoes }); setModalOpen(true) }

  async function save() {
    if (!form.nome.trim()) { toast.error('Nome obrigatório'); return }
    setSaving(true)
    try {
      if (!window.api) {
        if (editCliente) setClientes(prev => prev.map(c => c.id === editCliente.id ? { ...c, ...form } : c))
        else setClientes(prev => [...prev, { ...form, id: Date.now(), saldo_fiado: 0, total_compras: 0 }])
        toast.success(editCliente ? 'Cliente atualizado' : 'Cliente criado')
        setModalOpen(false)
        return
      }
      if (editCliente) await window.api.clientes.update(editCliente.id, form)
      else await window.api.clientes.create(form)
      toast.success(editCliente ? 'Cliente atualizado' : 'Cliente criado')
      setModalOpen(false)
      load()
    } catch { toast.error('Erro ao salvar') }
    finally { setSaving(false) }
  }

  async function registrarPagamento() {
    const v = parseFloat(pagValor.replace(',', '.'))
    if (!v || v <= 0) { toast.error('Valor inválido'); return }
    if (!window.api) {
      setClientes(prev => prev.map(c => c.id === fiadoPanel!.id ? { ...c, saldo_fiado: Math.max(0, c.saldo_fiado - v) } : c))
      setFiadoPanel(p => p ? { ...p, saldo_fiado: Math.max(0, p.saldo_fiado - v) } : p)
      setFiadoMovs(prev => [{ id: Date.now(), tipo: 'credito', valor: v, descricao: 'Pagamento recebido', created_at: new Date().toISOString() }, ...prev])
      toast.success('Pagamento registrado')
      setPagamentoModal(false)
      return
    }
    try {
      await window.api.clientes.pagarFiado({ cliente_id: fiadoPanel!.id, valor: v })
      toast.success('Pagamento registrado')
      setPagamentoModal(false)
      openFiado(fiadoPanel!)
    } catch { toast.error('Erro ao registrar pagamento') }
  }

  async function lancarDebito() {
    const v = parseFloat(debValor.replace(',', '.'))
    if (!v || v <= 0) { toast.error('Valor inválido'); return }
    if (!debDescricao.trim()) { toast.error('Informe a descrição'); return }
    if (!window.api) {
      setClientes(prev => prev.map(c => c.id === fiadoPanel!.id ? { ...c, saldo_fiado: c.saldo_fiado + v } : c))
      setFiadoPanel(p => p ? { ...p, saldo_fiado: p.saldo_fiado + v } : p)
      setFiadoMovs(prev => [{ id: Date.now(), tipo: 'debito', valor: v, descricao: debDescricao, created_at: new Date().toISOString() }, ...prev])
      toast.success('Débito lançado')
      setDebitoModal(false)
      return
    }
    try {
      await window.api.clientes.lancarFiado({ cliente_id: fiadoPanel!.id, valor: v, descricao: debDescricao })
      toast.success('Débito lançado')
      setDebitoModal(false)
      openFiado(fiadoPanel!)
    } catch { toast.error('Erro ao lançar débito') }
  }

  function openWhatsapp(c: Cliente) {
    const msg = `Olá ${c.nome}! Seu saldo devedor na loja é de *${formatCurrency(c.saldo_fiado)}*. Por favor, entre em contato para regularizar. Obrigado! 😊`
    window.open(whatsappUrl(c.telefone, msg), '_blank')
  }

  const filtered = clientes.filter(c =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    c.cpf?.includes(search) ||
    c.telefone?.includes(search)
  )

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Clientes</h1>
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          <input className="pl-9 pr-4 py-2 rounded-lg text-sm w-64 outline-none" style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            placeholder="Buscar por nome, CPF, telefone..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#F5A623' }}>
          <Plus className="w-4 h-4" /> Novo Cliente
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-10" style={{ color: 'var(--text-secondary)' }}>Carregando...</div>
          ) : (
            <div className="space-y-3">
              {filtered.map(c => (
                <div key={c.id} className="rounded-xl p-4 flex items-center gap-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ background: '#F5A623' }}>
                    {c.nome.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{c.nome}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{c.telefone} · {c.cpf}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Fiado</p>
                    <p className="font-bold text-sm" style={{ color: fiadoCor(c.saldo_fiado, c.limite_fiado) }}>
                      {formatCurrency(c.saldo_fiado)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Total compras</p>
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{formatCurrency(c.total_compras)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openWhatsapp(c)} disabled={!c.saldo_fiado} className="p-2 rounded-lg" style={{ color: '#22C55E', opacity: c.saldo_fiado ? 1 : 0.3 }}>
                      <MessageCircle className="w-4 h-4" />
                    </button>
                    <button onClick={() => openEdit(c)} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--bg)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>Editar</button>
                    <button onClick={() => openFiado(c)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: '#F5A62322', color: '#F5A623', border: '1px solid #F5A62344' }}>
                      Ver Fiado <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fiado Panel */}
        {fiadoPanel && (
          <div className="w-96 border-l flex flex-col" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div>
                <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{fiadoPanel.nome}</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Fiado</p>
              </div>
              <button onClick={() => setFiadoPanel(null)}><X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} /></button>
            </div>
            <div className="p-4 space-y-3">
              {(() => { const cor = fiadoCor(fiadoPanel.saldo_fiado, fiadoPanel.limite_fiado); return (
              <div className="rounded-xl p-4 text-center" style={{ background: `${cor}11`, border: `1px solid ${cor}33` }}>
                <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Saldo Devedor</p>
                <p className="text-3xl font-bold mt-1" style={{ color: cor }}>
                  {formatCurrency(fiadoPanel.saldo_fiado)}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Limite: {formatCurrency(fiadoPanel.limite_fiado)}</p>
              </div>
              ) })()}
              <div className="flex gap-2">
                <button onClick={() => { setPagValor(''); setPagamentoModal(true) }} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium" style={{ background: '#22C55E22', color: '#22C55E', border: '1px solid #22C55E44' }}>
                  <ArrowDownCircle className="w-4 h-4" /> Receber Pagamento
                </button>
                <button onClick={() => { setDebValor(''); setDebDescricao(''); setDebitoModal(true) }} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium" style={{ background: '#EF444422', color: '#EF4444', border: '1px solid #EF444444' }}>
                  <ArrowUpCircle className="w-4 h-4" /> Lançar Débito
                </button>
              </div>
              {fiadoPanel.telefone && (
                <button onClick={() => openWhatsapp(fiadoPanel)} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium" style={{ background: '#22C55E22', color: '#22C55E', border: '1px solid #22C55E44' }}>
                  <MessageCircle className="w-4 h-4" /> Cobrar via WhatsApp
                </button>
              )}
              <button onClick={() => setFecharModal(true)} disabled={fiadoMovs.filter(m => m.descricao).length === 0}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
                style={{ background: '#F5A62318', color: '#F5A623', border: '1px solid #F5A62340', opacity: fiadoMovs.filter(m => m.descricao).length === 0 ? 0.4 : 1 }}>
                <Archive className="w-4 h-4" /> Fechar conta (virar página)
              </button>
              <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
                {[['resumo', 'Resumo'], ['extrato', 'Extrato'], ['fechamentos', 'Fechamentos']].map(([k, l]) => (
                  <button key={k} onClick={() => { setFiadoTab(k as any); setCicloView(null) }} className="px-3 py-1.5 text-xs font-medium border-b-2"
                    style={{ borderColor: fiadoTab === k ? '#F5A623' : 'transparent', color: fiadoTab === k ? '#F5A623' : 'var(--text-secondary)' }}>
                    {l}
                  </button>
                ))}
              </div>
              {fiadoTab !== 'fechamentos' ? (
                <div className="space-y-2 overflow-y-auto max-h-64">
                  {fiadoMovs.filter(m => m.descricao).length === 0 && (
                    <p className="text-xs text-center py-4" style={{ color: 'var(--text-secondary)' }}>Página em branco — sem lançamentos no ciclo atual.</p>
                  )}
                  {fiadoMovs.filter(m => m.descricao).map(m => (
                    <div key={m.id} className="flex items-center justify-between py-2 border-b text-xs" style={{ borderColor: 'var(--border)' }}>
                      <div>
                        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{m.descricao}</p>
                        {m.created_at && <p style={{ color: 'var(--text-secondary)' }}>{formatDate(m.created_at)}</p>}
                      </div>
                      <span className="font-bold" style={{ color: m.tipo === 'debito' ? '#EF4444' : '#22C55E' }}>
                        {m.tipo === 'debito' ? '+' : '-'}{formatCurrency(m.valor)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : cicloView ? (
                <div className="space-y-2 overflow-y-auto max-h-64">
                  <button onClick={() => setCicloView(null)} className="flex items-center gap-1 text-xs font-medium" style={{ color: '#F5A623' }}>
                    <ChevronLeft className="w-3 h-3" /> Voltar aos fechamentos
                  </button>
                  <div className="rounded-lg p-3 text-xs space-y-1" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Fechamento #{cicloView.numero}</p>
                    <p style={{ color: 'var(--text-secondary)' }}>Fechado em {cicloView.fechado_em ? formatDate(cicloView.fechado_em) : '-'}</p>
                    <div className="flex justify-between pt-1"><span style={{ color: 'var(--text-secondary)' }}>Comprado (fiado)</span><span style={{ color: '#EF4444' }}>{formatCurrency(cicloView.total_debitos)}</span></div>
                    <div className="flex justify-between"><span style={{ color: 'var(--text-secondary)' }}>Pago</span><span style={{ color: '#22C55E' }}>{formatCurrency(cicloView.total_creditos)}</span></div>
                    <div className="flex justify-between font-semibold"><span style={{ color: 'var(--text-secondary)' }}>Saldo ao fechar</span><span style={{ color: fiadoCor(cicloView.saldo_final, fiadoPanel.limite_fiado) }}>{formatCurrency(cicloView.saldo_final)}</span></div>
                  </div>
                  {cicloMovs.filter(m => m.descricao).map(m => (
                    <div key={m.id} className="flex items-center justify-between py-2 border-b text-xs" style={{ borderColor: 'var(--border)' }}>
                      <div>
                        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{m.descricao}</p>
                        {m.created_at && <p style={{ color: 'var(--text-secondary)' }}>{formatDate(m.created_at)}</p>}
                      </div>
                      <span className="font-bold" style={{ color: m.tipo === 'debito' ? '#EF4444' : '#22C55E' }}>
                        {m.tipo === 'debito' ? '+' : '-'}{formatCurrency(m.valor)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2 overflow-y-auto max-h-64">
                  {ciclos.length === 0 && (
                    <p className="text-xs text-center py-4" style={{ color: 'var(--text-secondary)' }}>Nenhuma conta fechada ainda.</p>
                  )}
                  {ciclos.map(c => (
                    <button key={c.id} onClick={() => verCiclo(c)} className="w-full flex items-center justify-between py-2 px-2 rounded-lg border text-xs text-left" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                      <div className="flex items-center gap-2">
                        <BookCheck className="w-4 h-4" style={{ color: '#F5A623' }} />
                        <div>
                          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Fechamento #{c.numero}</p>
                          <p style={{ color: 'var(--text-secondary)' }}>{c.fechado_em ? formatDate(c.fechado_em) : '-'} · pago {formatCurrency(c.total_creditos)}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-3 h-3" style={{ color: 'var(--text-secondary)' }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal Cliente */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-lg rounded-xl shadow-2xl" style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{editCliente ? 'Editar Cliente' : 'Novo Cliente'}</h2>
              <button onClick={() => setModalOpen(false)}><X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} /></button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              {[
                { label: 'Nome *', field: 'nome', span: 2 },
                { label: 'CPF', field: 'cpf', span: 1 },
                { label: 'Telefone', field: 'telefone', span: 1 },
                { label: 'Endereço', field: 'endereco', span: 2 },
                { label: 'Bairro', field: 'bairro', span: 1 },
                { label: 'Cidade', field: 'cidade', span: 1 },
              ].map(({ label, field, span }) => (
                <div key={field} className={span === 2 ? 'col-span-2' : ''}>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
                  <input className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    value={(form as any)[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Limite Fiado (R$)</label>
                <input type="number" step="0.01" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  value={form.limite_fiado} onChange={e => setForm(f => ({ ...f, limite_fiado: Number(e.target.value) }))} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Observações</label>
                <textarea rows={2} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
              </div>
              <div className="col-span-2 flex justify-end gap-3">
                <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>Cancelar</button>
                <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#F5A623' }}>
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pagamento Modal */}
      {pagamentoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-80 rounded-xl shadow-2xl" style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Registrar Pagamento</h2>
              <button onClick={() => setPagamentoModal(false)}><X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} /></button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Saldo atual: <strong style={{ color: '#EF4444' }}>{formatCurrency(fiadoPanel?.saldo_fiado || 0)}</strong></p>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Valor recebido (R$)</label>
                <input className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  placeholder="0,00" value={pagValor} onChange={e => setPagValor(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setPagamentoModal(false)} className="flex-1 px-3 py-2 rounded-lg text-sm" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>Cancelar</button>
                <button onClick={registrarPagamento} className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#22C55E' }}>Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Débito Modal */}
      {debitoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-80 rounded-xl shadow-2xl" style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Lançar Débito</h2>
              <button onClick={() => setDebitoModal(false)}><X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Descrição *</label>
                <input className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  placeholder="Ex: Pedido #50" value={debDescricao} onChange={e => setDebDescricao(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Valor (R$) *</label>
                <input className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  placeholder="0,00" value={debValor} onChange={e => setDebValor(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setDebitoModal(false)} className="flex-1 px-3 py-2 rounded-lg text-sm" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>Cancelar</button>
                <button onClick={lancarDebito} className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#EF4444' }}>Lançar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fechar Conta Modal */}
      {fecharModal && fiadoPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-96 rounded-xl shadow-2xl" style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><Archive className="w-4 h-4" style={{ color: '#F5A623' }} /> Fechar conta</h2>
              <button onClick={() => setFecharModal(false)}><X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} /></button>
            </div>
            <div className="p-4 space-y-3 text-sm" style={{ color: 'var(--text-primary)' }}>
              <p style={{ color: 'var(--text-secondary)' }}>
                Fechar a conta de <strong style={{ color: 'var(--text-primary)' }}>{fiadoPanel.nome}</strong> significa que ele <strong style={{ color: 'var(--text-primary)' }}>acertou tudo</strong>. O resumo vai para o histórico de fechamentos, o valor recebido entra no Financeiro e a página abre nova, zerada.
              </p>
              <div className="rounded-lg p-3 text-xs space-y-1" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <div className="flex justify-between"><span style={{ color: 'var(--text-secondary)' }}>Saldo a quitar</span><span className="font-bold" style={{ color: fiadoCor(fiadoPanel.saldo_fiado, fiadoPanel.limite_fiado) }}>{formatCurrency(fiadoPanel.saldo_fiado)}</span></div>
              </div>
              {fiadoPanel.saldo_fiado > 0 ? (
                <p className="text-xs rounded-lg p-2" style={{ background: '#22C55E18', color: '#22C55E' }}>
                  Ao confirmar, o saldo de {formatCurrency(fiadoPanel.saldo_fiado)} é registrado como <strong>pago</strong> e a conta zera. Só feche se o cliente realmente acertou.
                </p>
              ) : (
                <p className="text-xs rounded-lg p-2" style={{ background: '#22C55E18', color: '#22C55E' }}>
                  Conta já quitada. A nova página começa zerada.
                </p>
              )}
              <div className="flex gap-2">
                <button onClick={() => setFecharModal(false)} className="flex-1 px-3 py-2 rounded-lg text-sm" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>Cancelar</button>
                <button onClick={fecharConta} disabled={fechando} className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#F5A623' }}>
                  {fechando ? 'Fechando...' : 'Confirmar fechamento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
