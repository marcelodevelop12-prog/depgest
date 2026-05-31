import { useEffect, useState } from 'react'
import { Plus, X, Search, Upload, Eye, CheckCircle, XCircle, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency, formatDate, formatDateTime } from '../lib/utils'

interface Fornecedor { id: number; nome: string }
interface Produto { id: number; nome: string; ean: string }
interface ItemCompra { produto_id: number; produto_nome?: string; quantidade: number; preco_unitario: number }
interface Compra {
  id: number
  fornecedor_id: number
  fornecedor_nome: string
  data?: string
  data_compra?: string
  created_at?: string
  status: 'pendente' | 'recebida' | 'cancelada'
  total: number
  nota_fiscal?: string
  numero_nf?: string
  total_itens?: number
  itens?: ItemCompra[]
}

const MOCK_FORNECEDORES: Fornecedor[] = [
  { id: 1, nome: 'Distribuidora BevMax' },
  { id: 2, nome: 'Alimentos Supremo Ltda' },
  { id: 3, nome: 'Limpeza Total Distribuidora' },
]
const MOCK_PRODUTOS: Produto[] = [
  { id: 1, nome: 'Cerveja Brahma 350ml', ean: '7891149101171' },
  { id: 2, nome: 'Refrigerante Coca-Cola 2L', ean: '7894900011517' },
  { id: 3, nome: 'Arroz Tio João 5kg', ean: '7896036095053' },
]
const MOCK_COMPRAS: Compra[] = [
  { id: 1, fornecedor_id: 1, fornecedor_nome: 'Distribuidora BevMax', data: new Date(Date.now() - 86400000 * 5).toISOString(), status: 'recebida', total: 1240, nota_fiscal: 'NF-001234', itens: [{ produto_id: 1, produto_nome: 'Cerveja Brahma 350ml', quantidade: 240, preco_unitario: 2.8 }, { produto_id: 2, produto_nome: 'Refrigerante Coca-Cola 2L', quantidade: 48, preco_unitario: 6.5 }] },
  { id: 2, fornecedor_id: 2, fornecedor_nome: 'Alimentos Supremo Ltda', data: new Date(Date.now() - 86400000 * 2).toISOString(), status: 'pendente', total: 580, nota_fiscal: 'NF-000890', itens: [{ produto_id: 3, produto_nome: 'Arroz Tio João 5kg', quantidade: 29, preco_unitario: 20 }] },
  { id: 3, fornecedor_id: 3, fornecedor_nome: 'Limpeza Total Distribuidora', data: new Date(Date.now() - 86400000 * 10).toISOString(), status: 'cancelada', total: 320, nota_fiscal: 'NF-000745', itens: [] },
]

const STATUS_CONFIG = {
  pendente: { label: 'Pendente', color: '#F5A623', bg: '#F5A62322' },
  recebida: { label: 'Recebida', color: '#22C55E', bg: '#22C55E22' },
  cancelada: { label: 'Cancelada', color: '#EF4444', bg: '#EF444422' },
}

const EMPTY_ITEM: ItemCompra = { produto_id: 0, quantidade: 1, preco_unitario: 0 }

export default function Compras() {
  const [compras, setCompras] = useState<Compra[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [fornFilter, setFornFilter] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [detailCompra, setDetailCompra] = useState<Compra | null>(null)
  const [xmlModal, setXmlModal] = useState(false)
  const [xmlData, setXmlData] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ fornecedor_id: 0, data: new Date().toISOString().split('T')[0], nota_fiscal: '' })
  const [itens, setItens] = useState<ItemCompra[]>([{ ...EMPTY_ITEM }])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    if (!window.api) { setCompras(MOCK_COMPRAS); setFornecedores(MOCK_FORNECEDORES); setProdutos(MOCK_PRODUTOS); setLoading(false); return }
    try {
      const [c, f, p] = await Promise.all([window.api.compras.list(), window.api.fornecedores.list(), window.api.produtos.list()])
      setCompras(c); setFornecedores(f); setProdutos(p)
    } catch { toast.error('Erro ao carregar compras') }
    finally { setLoading(false) }
  }

  function addItem() { setItens(prev => [...prev, { ...EMPTY_ITEM }]) }
  function removeItem(i: number) { setItens(prev => prev.filter((_, idx) => idx !== i)) }
  function updateItem(i: number, field: keyof ItemCompra, value: any) {
    setItens(prev => prev.map((it, idx) => {
      if (idx !== i) return it
      const updated = { ...it, [field]: value }
      if (field === 'produto_id') updated.produto_nome = produtos.find(p => p.id === Number(value))?.nome
      return updated
    }))
  }
  const totalCompra = itens.reduce((sum, it) => sum + it.quantidade * it.preco_unitario, 0)

  async function save() {
    if (!form.fornecedor_id) { toast.error('Selecione um fornecedor'); return }
    if (itens.some(it => !it.produto_id || it.quantidade <= 0)) { toast.error('Itens inválidos'); return }
    setSaving(true)
    try {
      const payload = { ...form, itens, total: totalCompra }
      if (!window.api) {
        const forn = fornecedores.find(f => f.id === form.fornecedor_id)
        const nova: Compra = { ...payload, id: Date.now(), fornecedor_nome: forn?.nome || '', status: 'pendente' }
        setCompras(prev => [nova, ...prev])
        toast.success('Compra criada')
        setModalOpen(false)
        return
      }
      await window.api.compras.create(payload)
      toast.success('Compra criada')
      setModalOpen(false)
      load()
    } catch { toast.error('Erro ao criar compra') }
    finally { setSaving(false) }
  }

  async function receber(id: number) {
    if (!confirm('Confirmar recebimento desta compra? O estoque será atualizado.')) return
    if (!window.api) {
      setCompras(prev => prev.map(c => c.id === id ? { ...c, status: 'recebida' } : c))
      toast.success('Compra recebida e estoque atualizado')
      return
    }
    try { await window.api.compras.receber(id); toast.success('Compra recebida'); load() }
    catch { toast.error('Erro ao receber') }
  }

  async function cancelar(id: number) {
    if (!confirm('Cancelar esta compra?')) return
    if (!window.api) { setCompras(prev => prev.map(c => c.id === id ? { ...c, status: 'cancelada' } : c)); toast.success('Cancelada'); return }
    try { await window.api.compras.cancel(id); toast.success('Cancelada'); load() }
    catch { toast.error('Erro ao cancelar') }
  }

  async function importarXml() {
    if (!window.api) { toast('Importação XML não disponível em modo demo'); return }
    try {
      const fileResult = await window.api.system.openDialog({ title: 'Selecionar NF-e', filters: [{ name: 'XML NF-e', extensions: ['xml'] }], properties: ['openFile'] })
      if (fileResult.canceled || !fileResult.filePaths[0]) return
      const result = await window.api.compras.importXml(fileResult.filePaths[0])
      if (result) { setXmlData(result); setXmlModal(true) }
    } catch { toast.error('Erro ao importar XML') }
  }

  async function confirmarXml() {
    if (!window.api || !xmlData) return
    try {
      // Mapeia itens do formato XML para o formato do create
      const itensMapeados = (xmlData.itens || []).map((it: any) => ({
        produto_id: it.produto_id || null,
        produto_unidade_id: it.produto_unidade_id || null,
        descricao: it.descricao || it.nome || '—',
        quantidade: it.quantidade || 0,
        preco_unitario: it.preco_unitario || 0,
        total: it.total || 0,
      }))
      const somaItens = itensMapeados.reduce((acc: number, it: any) => acc + (Number(it.total) || 0), 0)
      const payload = {
        fornecedor_id: xmlData.fornecedor_id || null,
        // Permite o backend criar/vincular o fornecedor pelo CNPJ do emitente
        emitente: xmlData.emitente || null,
        numero_nf: xmlData.numero_nf ? String(xmlData.numero_nf) : null,
        // Usa o total da NF; se vier 0, cai na soma dos itens
        total: Number(xmlData.total) > 0 ? Number(xmlData.total) : somaItens,
        observacoes: xmlData.emitente?.nome || xmlData.emitente?.xNome || null,
        itens: itensMapeados,
      }
      await window.api.compras.create(payload)
      toast.success('Compra importada com sucesso!')
      setXmlModal(false)
      setXmlData(null)
      load()
    } catch (err: any) {
      console.error('Erro ao confirmar XML:', err)
      toast.error(`Erro: ${err?.message || 'Falha ao salvar compra'}`)
    }
  }

  const filtered = compras.filter(c => {
    const matchStatus = !statusFilter || c.status === statusFilter
    const matchForn = !fornFilter || c.fornecedor_id === fornFilter
    return matchStatus && matchForn
  })

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Compras</h1>
        <div className="flex-1" />
        <select className="px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="recebida">Recebida</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <select className="px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          value={fornFilter} onChange={e => setFornFilter(Number(e.target.value))}>
          <option value={0}>Todos os fornecedores</option>
          {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
        <button onClick={importarXml} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
          <Upload className="w-4 h-4" /> Importar XML NF-e
        </button>
        <button onClick={() => { setForm({ fornecedor_id: 0, data: new Date().toISOString().split('T')[0], nota_fiscal: '' }); setItens([{ ...EMPTY_ITEM }]); setModalOpen(true) }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#F5A623' }}>
          <Plus className="w-4 h-4" /> Nova Compra
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? <div className="text-center py-10" style={{ color: 'var(--text-secondary)' }}>Carregando...</div> : (
          <table className="w-full text-sm">
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['NF', 'Fornecedor', 'Data', 'Itens', 'Total', 'Status', ''].map(h => <th key={h} className="pb-2 text-left px-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.map(c => {
                const cfg = STATUS_CONFIG[c.status]
                return (
                  <tr key={c.id} className="border-b hover:opacity-80" style={{ borderColor: 'var(--border)' }}>
                    <td className="py-3 px-2 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{c.numero_nf || c.nota_fiscal || '—'}</td>
                    <td className="py-3 px-2 font-medium" style={{ color: 'var(--text-primary)' }}>{c.fornecedor_nome || '—'}</td>
                    <td className="py-3 px-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{formatDate(c.data_compra || c.created_at)}</td>
                    <td className="py-3 px-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{c.total_itens ?? (Array.isArray(c.itens) ? c.itens.length : 0)} item(ns)</td>
                    <td className="py-3 px-2 font-bold" style={{ color: '#F5A623' }}>{formatCurrency(c.total)}</td>
                    <td className="py-3 px-2">
                      <span className="px-2 py-1 rounded-full text-xs font-medium" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setDetailCompra(c)} className="p-1.5 rounded" style={{ color: '#3B82F6' }}><Eye className="w-4 h-4" /></button>
                        {c.status === 'pendente' && <>
                          <button onClick={() => receber(c.id)} className="p-1.5 rounded" style={{ color: '#22C55E' }} title="Receber"><CheckCircle className="w-4 h-4" /></button>
                          <button onClick={() => cancelar(c.id)} className="p-1.5 rounded" style={{ color: '#EF4444' }} title="Cancelar"><XCircle className="w-4 h-4" /></button>
                        </>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Nova Compra Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl" style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Nova Compra</h2>
              <button onClick={() => setModalOpen(false)}><X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Fornecedor *</label>
                  <select className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    value={form.fornecedor_id} onChange={e => setForm(f => ({ ...f, fornecedor_id: Number(e.target.value) }))}>
                    <option value={0}>Selecione...</option>
                    {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Data</label>
                  <input type="date" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Nota Fiscal</label>
                  <input className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    placeholder="NF-000000" value={form.nota_fiscal} onChange={e => setForm(f => ({ ...f, nota_fiscal: e.target.value }))} />
                </div>
              </div>

              {/* Itens */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Itens</h3>
                  <button onClick={addItem} className="flex items-center gap-1 text-xs px-2 py-1 rounded" style={{ color: '#F5A623', background: '#F5A62322' }}>
                    <Plus className="w-3 h-3" /> Adicionar
                  </button>
                </div>
                <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  <table className="w-full text-xs">
                    <thead><tr style={{ background: 'var(--bg)' }}>
                      {['Produto', 'Quantidade', 'Preço Unit. (R$)', 'Subtotal', ''].map(h => <th key={h} className="p-2 text-left font-semibold" style={{ color: 'var(--text-secondary)' }}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {itens.map((it, i) => (
                        <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                          <td className="p-1">
                            <select className="w-full px-2 py-1 rounded text-xs outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                              value={it.produto_id} onChange={e => updateItem(i, 'produto_id', Number(e.target.value))}>
                              <option value={0}>Selecione...</option>
                              {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                            </select>
                          </td>
                          <td className="p-1 w-24"><input type="number" min="1" className="w-full px-2 py-1 rounded text-xs outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} value={it.quantidade} onChange={e => updateItem(i, 'quantidade', Number(e.target.value))} /></td>
                          <td className="p-1 w-32"><input type="number" step="0.01" className="w-full px-2 py-1 rounded text-xs outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} value={it.preco_unitario} onChange={e => updateItem(i, 'preco_unitario', Number(e.target.value))} /></td>
                          <td className="p-1 font-semibold" style={{ color: '#F5A623' }}>{formatCurrency(it.quantidade * it.preco_unitario)}</td>
                          <td className="p-1">{itens.length > 1 && <button onClick={() => removeItem(i)} style={{ color: '#EF4444' }}><X className="w-3 h-3" /></button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end mt-2">
                  <p className="text-sm font-bold" style={{ color: '#F5A623' }}>Total: {formatCurrency(totalCompra)}</p>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>Cancelar</button>
                <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#F5A623' }}>
                  {saving ? 'Salvando...' : 'Criar Compra'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailCompra && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-lg rounded-xl shadow-2xl" style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Detalhes — {detailCompra.numero_nf || detailCompra.nota_fiscal || 'Sem NF'}</h2>
              <button onClick={() => setDetailCompra(null)}><X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span style={{ color: 'var(--text-secondary)' }}>Fornecedor: </span><strong style={{ color: 'var(--text-primary)' }}>{detailCompra.fornecedor_nome}</strong></div>
                <div><span style={{ color: 'var(--text-secondary)' }}>Data: </span><strong style={{ color: 'var(--text-primary)' }}>{formatDate(detailCompra.data_compra || detailCompra.created_at)}</strong></div>
              </div>
              <table className="w-full text-sm">
                <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Produto', 'Qtd', 'Preço Unit.', 'Subtotal'].map(h => <th key={h} className="pb-2 text-left px-2 font-semibold text-xs" style={{ color: 'var(--text-secondary)' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {(detailCompra.itens || []).map((it, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="py-2 px-2 text-xs" style={{ color: 'var(--text-primary)' }}>{it.produto_nome}</td>
                      <td className="py-2 px-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{it.quantidade}</td>
                      <td className="py-2 px-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(it.preco_unitario)}</td>
                      <td className="py-2 px-2 text-xs font-semibold" style={{ color: '#F5A623' }}>{formatCurrency(it.quantidade * it.preco_unitario)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end">
                <p className="font-bold" style={{ color: '#F5A623' }}>Total: {formatCurrency(detailCompra.total)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* XML Modal */}
      {xmlModal && xmlData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-lg rounded-xl shadow-2xl flex flex-col" style={{ background: 'var(--card)', maxHeight: '85vh' }}>
            <div className="flex items-center justify-between p-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Importar NF-e</h2>
              <button onClick={() => setXmlModal(false)}><X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} /></button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
              <div className="p-3 rounded-lg text-sm" style={{ background: 'var(--bg)' }}>
                <p style={{ color: 'var(--text-secondary)' }}>Emitente: <strong style={{ color: 'var(--text-primary)' }}>{xmlData.emitente?.xNome || xmlData.emitente?.nome || '—'}{xmlData.emitente?.CNPJ ? ` · ${xmlData.emitente.CNPJ}` : ''}</strong></p>
                <p style={{ color: 'var(--text-secondary)' }}>Total: <strong style={{ color: '#F5A623' }}>{formatCurrency(xmlData.total)}</strong></p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{(xmlData.itens || []).length} itens</p>
              </div>
              <table className="w-full text-xs">
                <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['EAN', 'Descrição', 'Qtd', 'Preço Unit.'].map(h => <th key={h} className="pb-2 text-left px-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {(xmlData.itens || []).map((it: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="py-2 px-2 font-mono text-xs">{it.ean || '—'}</td>
                      <td className="py-2 px-2" style={{ color: 'var(--text-primary)' }}>{it.descricao || it.nome || '—'}</td>
                      <td className="py-2 px-2" style={{ color: 'var(--text-secondary)' }}>{it.quantidade}</td>
                      <td className="py-2 px-2" style={{ color: '#F5A623' }}>{formatCurrency(it.preco_unitario)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 p-4 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
              <button onClick={() => setXmlModal(false)} className="flex-1 px-3 py-2 rounded-lg text-sm" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>Cancelar</button>
              <button onClick={confirmarXml} className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#F5A623' }}>Confirmar Importação</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
