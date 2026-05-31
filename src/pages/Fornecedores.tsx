import { useEffect, useState } from 'react'
import { Search, Plus, X, Edit2, Trash2, ChevronRight, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency, formatDate } from '../lib/utils'

interface Fornecedor {
  id: number
  nome: string
  cnpj: string
  telefone: string
  email: string
  contato: string
  observacoes: string
}
interface Compra {
  id: number
  data?: string
  data_compra?: string
  created_at?: string
  total: number
  status: string
  nota_fiscal?: string
  numero_nf?: string
}

const MOCK_FORNECEDORES: Fornecedor[] = [
  { id: 1, nome: 'Distribuidora BevMax', cnpj: '12.345.678/0001-90', telefone: '(11) 3333-1111', email: 'compras@bevmax.com.br', contato: 'Roberto Alves', observacoes: 'Entrega às terças e quintas' },
  { id: 2, nome: 'Alimentos Supremo Ltda', cnpj: '23.456.789/0001-01', telefone: '(11) 3333-2222', email: 'vendas@supremo.com', contato: 'Fernanda Lima', observacoes: '' },
  { id: 3, nome: 'Limpeza Total Distribuidora', cnpj: '34.567.890/0001-12', telefone: '(11) 3333-3333', email: 'atend@limpezatotal.com', contato: 'Paulo Costa', observacoes: 'Mínimo de R$500 por pedido' },
]
const MOCK_COMPRAS: Compra[] = [
  { id: 1, data: new Date(Date.now() - 86400000 * 5).toISOString(), total: 1240, status: 'recebida', nota_fiscal: 'NF-001234' },
  { id: 2, data: new Date(Date.now() - 86400000 * 12).toISOString(), total: 890, status: 'recebida', nota_fiscal: 'NF-001190' },
  { id: 3, data: new Date(Date.now() - 86400000 * 20).toISOString(), total: 2100, status: 'recebida', nota_fiscal: 'NF-001105' },
]

const EMPTY_FORM = { nome: '', cnpj: '', telefone: '', email: '', contato: '', observacoes: '' }

export default function Fornecedores() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editForn, setEditForn] = useState<Fornecedor | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [detailPanel, setDetailPanel] = useState<Fornecedor | null>(null)
  const [compras, setCompras] = useState<Compra[]>([])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    if (!window.api) { setFornecedores(MOCK_FORNECEDORES); setLoading(false); return }
    try {
      const f = await window.api.fornecedores.list()
      setFornecedores(f)
    } catch { toast.error('Erro ao carregar fornecedores') }
    finally { setLoading(false) }
  }

  async function openDetail(f: Fornecedor) {
    setDetailPanel(f)
    if (!window.api) { setCompras(MOCK_COMPRAS); return }
    try {
      const c = await window.api.fornecedores.get(f.id)
      setCompras(c.compras || [])
    } catch { setCompras([]) }
  }

  function openNew() { setEditForn(null); setForm({ ...EMPTY_FORM }); setModalOpen(true) }
  function openEdit(f: Fornecedor) { setEditForn(f); setForm({ nome: f.nome, cnpj: f.cnpj, telefone: f.telefone, email: f.email, contato: f.contato, observacoes: f.observacoes }); setModalOpen(true) }

  async function save() {
    if (!form.nome.trim()) { toast.error('Nome obrigatório'); return }
    setSaving(true)
    try {
      if (!window.api) {
        if (editForn) setFornecedores(prev => prev.map(f => f.id === editForn.id ? { ...f, ...form } : f))
        else setFornecedores(prev => [...prev, { ...form, id: Date.now() }])
        toast.success(editForn ? 'Fornecedor atualizado' : 'Fornecedor criado')
        setModalOpen(false)
        return
      }
      if (editForn) await window.api.fornecedores.update(editForn.id, form)
      else await window.api.fornecedores.create(form)
      toast.success(editForn ? 'Fornecedor atualizado' : 'Fornecedor criado')
      setModalOpen(false)
      load()
    } catch { toast.error('Erro ao salvar') }
    finally { setSaving(false) }
  }

  async function deleteForn(id: number) {
    if (!confirm('Excluir este fornecedor?')) return
    if (!window.api) { setFornecedores(prev => prev.filter(f => f.id !== id)); toast.success('Excluído'); return }
    try { await window.api.fornecedores.delete(id); toast.success('Excluído'); load() }
    catch { toast.error('Erro ao excluir') }
  }

  const filtered = fornecedores.filter(f =>
    f.nome.toLowerCase().includes(search.toLowerCase()) ||
    f.cnpj?.includes(search) ||
    f.contato?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Fornecedores</h1>
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          <input className="pl-9 pr-4 py-2 rounded-lg text-sm w-64 outline-none" style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            placeholder="Buscar por nome, CNPJ, contato..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#F5A623' }}>
          <Plus className="w-4 h-4" /> Novo Fornecedor
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-10" style={{ color: 'var(--text-secondary)' }}>Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10" style={{ color: 'var(--text-secondary)' }}>Nenhum fornecedor encontrado</div>
          ) : (
            <div className="space-y-3">
              {filtered.map(f => (
                <div key={f.id} className="rounded-xl p-4 flex items-center gap-4" style={{ background: 'var(--card)', border: `1px solid ${detailPanel?.id === f.id ? '#F5A623' : 'var(--border)'}` }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#F5A62322' }}>
                    <Building2 className="w-5 h-5" style={{ color: '#F5A623' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{f.nome}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{f.cnpj} · {f.telefone}</p>
                    {f.contato && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Contato: {f.contato}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(f)} className="p-2 rounded" style={{ color: '#F5A623' }}><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => deleteForn(f.id)} className="p-2 rounded" style={{ color: '#EF4444' }}><Trash2 className="w-4 h-4" /></button>
                    <button onClick={() => openDetail(f)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: '#F5A62322', color: '#F5A623', border: '1px solid #F5A62344' }}>
                      Detalhes <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {detailPanel && (
          <div className="w-80 border-l flex flex-col" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{detailPanel.nome}</p>
              <button onClick={() => setDetailPanel(null)}><X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} /></button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-2 text-sm">
                {[
                  { label: 'CNPJ', value: detailPanel.cnpj },
                  { label: 'Telefone', value: detailPanel.telefone },
                  { label: 'E-mail', value: detailPanel.email },
                  { label: 'Contato', value: detailPanel.contato },
                ].map(row => row.value ? (
                  <div key={row.label} className="flex justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                    <span className="font-medium text-right" style={{ color: 'var(--text-primary)' }}>{row.value}</span>
                  </div>
                ) : null)}
                {detailPanel.observacoes && (
                  <div className="p-2 rounded-lg text-xs" style={{ background: 'var(--bg)', color: 'var(--text-secondary)' }}>{detailPanel.observacoes}</div>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Últimas Compras</p>
                <div className="space-y-2">
                  {compras.map(c => (
                    <div key={c.id} className="flex items-center justify-between py-2 border-b text-xs" style={{ borderColor: 'var(--border)' }}>
                      <div>
                        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{c.numero_nf || c.nota_fiscal || 'Sem NF'}</p>
                        <p style={{ color: 'var(--text-secondary)' }}>{formatDate(c.data_compra || c.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold" style={{ color: '#F5A623' }}>{formatCurrency(c.total)}</p>
                        <span className="px-1.5 py-0.5 rounded-full text-xs" style={{ background: '#22C55E22', color: '#22C55E' }}>Recebida</span>
                      </div>
                    </div>
                  ))}
                  {compras.length === 0 && <p className="text-xs text-center py-4" style={{ color: 'var(--text-secondary)' }}>Nenhuma compra registrada</p>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-xl shadow-2xl" style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>{editForn ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h2>
              <button onClick={() => setModalOpen(false)}><X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} /></button>
            </div>
            <div className="p-4 space-y-3">
              {[
                { label: 'Nome *', field: 'nome' },
                { label: 'CNPJ', field: 'cnpj' },
                { label: 'Telefone', field: 'telefone' },
                { label: 'E-mail', field: 'email' },
                { label: 'Contato', field: 'contato' },
              ].map(({ label, field }) => (
                <div key={field}>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
                  <input className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    value={(form as any)[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Observações</label>
                <textarea rows={2} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
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
