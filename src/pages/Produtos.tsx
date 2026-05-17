import { useEffect, useState, useRef } from 'react'
import { Plus, Search, Edit2, Trash2, X, Upload, Barcode, ToggleLeft, ToggleRight, Tag } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency } from '../lib/utils'

interface Categoria { id: number; nome: string; ordem: number; ativa: number; exibir_cardapio: number }
interface Unidade {
  id?: number
  tipo: 'unidade' | 'fardo' | 'caixa' | 'barril'
  quantidade_base: number
  preco_custo: number
  preco_venda: number
}
interface Produto {
  id: number
  nome: string
  marca: string
  ean: string
  categoria_id: number
  categoria?: string
  estoque_atual: number
  estoque_minimo: number
  localizacao: string
  controle_validade: boolean
  ativo: boolean
  preco_venda: number
  unidades?: Unidade[]
}

const MOCK_CATEGORIAS: Categoria[] = [
  { id: 1, nome: 'Cervejas', ordem: 1, ativa: 1, exibir_cardapio: 1 },
  { id: 2, nome: 'Refrigerantes', ordem: 2, ativa: 1, exibir_cardapio: 1 },
  { id: 3, nome: 'Águas', ordem: 3, ativa: 1, exibir_cardapio: 1 },
  { id: 4, nome: 'Sucos', ordem: 4, ativa: 1, exibir_cardapio: 1 },
  { id: 5, nome: 'Vinhos', ordem: 5, ativa: 1, exibir_cardapio: 1 },
  { id: 6, nome: 'Destilados', ordem: 6, ativa: 1, exibir_cardapio: 1 },
  { id: 7, nome: 'Energéticos', ordem: 7, ativa: 1, exibir_cardapio: 1 },
  { id: 8, nome: 'Outros', ordem: 8, ativa: 1, exibir_cardapio: 1 },
]

const MOCK_PRODUTOS: Produto[] = [
  { id: 1, nome: 'Cerveja Brahma 350ml', marca: 'Brahma', ean: '7891149101171', categoria_id: 1, categoria: 'Cervejas', estoque_atual: 48, estoque_minimo: 24, localizacao: 'A1', controle_validade: true, ativo: true, preco_venda: 4.5, unidades: [{ tipo: 'unidade', quantidade_base: 1, preco_custo: 2.8, preco_venda: 4.5 }, { tipo: 'fardo', quantidade_base: 24, preco_custo: 60, preco_venda: 96 }] },
  { id: 2, nome: 'Coca-Cola 2L', marca: 'Coca-Cola', ean: '7894900011517', categoria_id: 2, categoria: 'Refrigerantes', estoque_atual: 12, estoque_minimo: 20, localizacao: 'A2', controle_validade: false, ativo: true, preco_venda: 9.9, unidades: [{ tipo: 'unidade', quantidade_base: 1, preco_custo: 6.5, preco_venda: 9.9 }] },
]

const EMPTY_FORM = {
  nome: '', marca: '', ean: '', categoria_id: 0, estoque_minimo: 1, localizacao: '', controle_validade: false, ativo: true,
}
const EMPTY_UNIDADE: Unidade = { tipo: 'unidade', quantidade_base: 1, preco_custo: 0, preco_venda: 0 }

type Aba = 'produtos' | 'categorias'

export default function Produtos() {
  const [aba, setAba] = useState<Aba>('produtos')

  // ── estado de produtos ──────────────────────────────────────────────────
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState(0)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editProduto, setEditProduto] = useState<Produto | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [unidades, setUnidades] = useState<Unidade[]>([{ ...EMPTY_UNIDADE }])
  const [saving, setSaving] = useState(false)
  const [eanLookup, setEanLookup] = useState(false)
  const [xmlModalOpen, setXmlModalOpen] = useState(false)
  const [xmlItems, setXmlItems] = useState<any[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  // ── estado de categorias ────────────────────────────────────────────────
  const [catModal, setCatModal] = useState(false)
  const [editCat, setEditCat] = useState<Categoria | null>(null)
  const [catForm, setCatForm] = useState({ nome: '', ordem: 0 })
  const [savingCat, setSavingCat] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    if (!window.api) {
      setProdutos(MOCK_PRODUTOS)
      setCategorias(MOCK_CATEGORIAS)
      setLoading(false)
      return
    }
    try {
      const [p, c] = await Promise.all([window.api.produtos.list(), window.api.categorias.list()])
      setProdutos(p)
      setCategorias(c)
    } catch { toast.error('Erro ao carregar produtos') }
    finally { setLoading(false) }
  }

  // ── produtos ────────────────────────────────────────────────────────────
  function openNew() {
    setEditProduto(null)
    setForm({ ...EMPTY_FORM })
    setUnidades([{ ...EMPTY_UNIDADE }])
    setModalOpen(true)
  }

  function openEdit(p: Produto) {
    setEditProduto(p)
    setForm({ nome: p.nome, marca: p.marca, ean: p.ean, categoria_id: p.categoria_id, estoque_minimo: p.estoque_minimo, localizacao: p.localizacao, controle_validade: p.controle_validade, ativo: p.ativo })
    setUnidades(p.unidades?.length ? p.unidades : [{ ...EMPTY_UNIDADE }])
    setModalOpen(true)
  }

  async function save() {
    if (!form.nome.trim()) { toast.error('Nome obrigatório'); return }
    if (!form.categoria_id) { toast.error('Selecione uma categoria'); return }
    setSaving(true)
    const payload = { ...form, unidades }
    try {
      if (!window.api) {
        if (editProduto) {
          setProdutos(prev => prev.map(p => p.id === editProduto.id ? { ...p, ...payload } : p))
        } else {
          const newP: Produto = { ...payload, id: Date.now(), estoque_atual: 0, categoria: categorias.find(c => c.id === payload.categoria_id)?.nome, preco_venda: unidades[0]?.preco_venda || 0 }
          setProdutos(prev => [...prev, newP])
        }
        toast.success(editProduto ? 'Produto atualizado' : 'Produto criado')
        setModalOpen(false)
        return
      }
      if (editProduto) {
        await window.api.produtos.update(editProduto.id, payload)
        toast.success('Produto atualizado')
      } else {
        await window.api.produtos.create(payload)
        toast.success('Produto criado')
      }
      setModalOpen(false)
      load()
    } catch { toast.error('Erro ao salvar') }
    finally { setSaving(false) }
  }

  async function deleteProduto(id: number) {
    if (!confirm('Excluir este produto?')) return
    if (!window.api) { setProdutos(prev => prev.filter(p => p.id !== id)); toast.success('Excluído'); return }
    try { await window.api.produtos.delete(id); toast.success('Excluído'); load() }
    catch { toast.error('Erro ao excluir') }
  }

  async function lookupEan() {
    if (!form.ean) { toast.error('Informe o EAN'); return }
    setEanLookup(true)
    try {
      if (!window.api) { toast('API de EAN não disponível em modo demo'); return }
      const result = await window.api.produtos.consultaEan(form.ean)
      if (result) setForm(f => ({ ...f, nome: result.nome || f.nome, marca: result.marca || f.marca }))
    } catch { toast.error('EAN não encontrado') }
    finally { setEanLookup(false) }
  }

  async function importXml() {
    if (!window.api) { toast('Importação XML não disponível em modo demo'); return }
    try {
      const fileResult = await window.api.system.openDialog({ title: 'Selecionar NF-e', filters: [{ name: 'XML NF-e', extensions: ['xml'] }], properties: ['openFile'] })
      if (fileResult.canceled || !fileResult.filePaths[0]) return
      const result = await window.api.produtos.importXml(fileResult.filePaths[0])
      if (result?.preview) { setXmlItems(result.preview); setXmlModalOpen(true) }
    } catch { toast.error('Erro ao importar XML') }
  }

  function addUnidade() { setUnidades(u => [...u, { ...EMPTY_UNIDADE }]) }
  function removeUnidade(i: number) { setUnidades(u => u.filter((_, idx) => idx !== i)) }
  function updateUnidade(i: number, field: keyof Unidade, value: any) {
    setUnidades(u => u.map((un, idx) => idx === i ? { ...un, [field]: value } : un))
  }
  function margem(u: Unidade) {
    if (!u.preco_custo || !u.preco_venda) return 0
    return ((u.preco_venda - u.preco_custo) / u.preco_custo * 100).toFixed(1)
  }

  const filtered = produtos.filter(p => {
    const matchSearch = p.nome.toLowerCase().includes(search.toLowerCase()) || p.ean?.includes(search) || p.marca?.toLowerCase().includes(search.toLowerCase())
    const matchCat = !catFilter || p.categoria_id === catFilter
    return matchSearch && matchCat
  })

  // ── categorias ──────────────────────────────────────────────────────────
  function openNewCat() {
    setEditCat(null)
    const nextOrdem = categorias.length > 0 ? Math.max(...categorias.map(c => c.ordem)) + 1 : 1
    setCatForm({ nome: '', ordem: nextOrdem })
    setCatModal(true)
  }

  function openEditCat(c: Categoria) {
    setEditCat(c)
    setCatForm({ nome: c.nome, ordem: c.ordem })
    setCatModal(true)
  }

  async function saveCat() {
    if (!catForm.nome.trim()) { toast.error('Nome obrigatório'); return }
    setSavingCat(true)
    try {
      if (!window.api) {
        if (editCat) {
          setCategorias(prev => prev.map(c => c.id === editCat.id ? { ...c, ...catForm } : c))
        } else {
          setCategorias(prev => [...prev, { id: Date.now(), nome: catForm.nome, ordem: catForm.ordem, ativa: 1 }])
        }
        toast.success(editCat ? 'Categoria atualizada' : 'Categoria criada')
        setCatModal(false)
        return
      }
      if (editCat) {
        await window.api.categorias.update(editCat.id, { nome: catForm.nome, ordem: catForm.ordem, ativa: editCat.ativa, exibir_cardapio: editCat.exibir_cardapio })
        toast.success('Categoria atualizada')
      } else {
        await window.api.categorias.create({ nome: catForm.nome, ordem: catForm.ordem })
        toast.success('Categoria criada')
      }
      setCatModal(false)
      load()
    } catch { toast.error('Erro ao salvar categoria') }
    finally { setSavingCat(false) }
  }

  async function deleteCat(c: Categoria) {
    const usados = produtos.filter(p => p.categoria_id === c.id).length
    if (usados > 0) { toast.error(`Categoria em uso por ${usados} produto(s). Mova os produtos antes de excluir.`); return }
    if (!confirm(`Excluir a categoria "${c.nome}"?`)) return
    if (!window.api) { setCategorias(prev => prev.filter(x => x.id !== c.id)); return }
    try {
      await window.api.categorias.delete(c.id)
      toast.success('Categoria excluída')
      load()
    } catch { toast.error('Erro ao excluir') }
  }

  async function toggleExibirCardapio(c: Categoria) {
    const novoValor = c.exibir_cardapio ? 0 : 1
    setCategorias(prev => prev.map(x => x.id === c.id ? { ...x, exibir_cardapio: novoValor } : x))
    if (!window.api) return
    try {
      await window.api.categorias.update(c.id, { nome: c.nome, ordem: c.ordem, ativa: c.ativa, exibir_cardapio: novoValor })
    } catch { toast.error('Erro ao atualizar categoria'); load() }
  }

  // ── render ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Produtos</h1>

        {/* Abas */}
        <div className="flex rounded-lg overflow-hidden ml-2" style={{ border: '1px solid var(--border)' }}>
          {(['produtos', 'categorias'] as Aba[]).map(t => (
            <button
              key={t}
              onClick={() => setAba(t)}
              className="px-4 py-1.5 text-sm font-medium capitalize transition-colors"
              style={{
                background: aba === t ? '#F5A623' : 'var(--card)',
                color: aba === t ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {t === 'categorias' ? <span className="flex items-center gap-1"><Tag className="w-3.5 h-3.5" />Categorias</span> : 'Produtos'}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {aba === 'produtos' && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
              <input
                className="pl-9 pr-4 py-2 rounded-lg text-sm w-64 outline-none"
                style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                placeholder="Buscar por nome, EAN, marca..."
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              className="px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              value={catFilter} onChange={e => setCatFilter(Number(e.target.value))}
            >
              <option value={0}>Todas as categorias</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <button onClick={importXml} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <Upload className="w-4 h-4" /> Importar XML
            </button>
            <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#F5A623' }}>
              <Plus className="w-4 h-4" /> Novo Produto
            </button>
          </>
        )}

        {aba === 'categorias' && (
          <button onClick={openNewCat} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#F5A623' }}>
            <Plus className="w-4 h-4" /> Nova Categoria
          </button>
        )}
      </div>

      {/* Conteúdo */}
      {aba === 'produtos' && (
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-40" style={{ color: 'var(--text-secondary)' }}>Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center h-40" style={{ color: 'var(--text-secondary)' }}>Nenhum produto encontrado</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Nome', 'Marca', 'EAN', 'Categoria', 'Estoque', 'Mín.', 'Preço Venda', 'Status', ''].map(h => (
                    <th key={h} className="pb-2 text-left font-semibold px-2" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const estoqueOk = p.estoque_atual >= p.estoque_minimo
                  const estoqueZero = p.estoque_atual === 0
                  return (
                    <tr key={p.id} className="border-b hover:opacity-80 transition-opacity" style={{ borderColor: 'var(--border)' }}>
                      <td className="py-3 px-2 font-medium" style={{ color: 'var(--text-primary)' }}>{p.nome}</td>
                      <td className="py-3 px-2" style={{ color: 'var(--text-secondary)' }}>{p.marca}</td>
                      <td className="py-3 px-2 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{p.ean}</td>
                      <td className="py-3 px-2" style={{ color: 'var(--text-secondary)' }}>{p.categoria}</td>
                      <td className="py-3 px-2">
                        <span className="font-bold" style={{ color: estoqueZero ? '#EF4444' : estoqueOk ? '#22C55E' : '#F5A623' }}>
                          {p.estoque_atual}
                        </span>
                      </td>
                      <td className="py-3 px-2" style={{ color: 'var(--text-secondary)' }}>{p.estoque_minimo}</td>
                      <td className="py-3 px-2 font-medium" style={{ color: 'var(--text-primary)' }}>{formatCurrency(p.preco_venda)}</td>
                      <td className="py-3 px-2">
                        <span className="px-2 py-1 rounded-full text-xs font-medium" style={{ background: p.ativo ? '#22C55E22' : '#EF444422', color: p.ativo ? '#22C55E' : '#EF4444' }}>
                          {p.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:opacity-70" style={{ color: '#F5A623' }}><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => deleteProduto(p.id)} className="p-1.5 rounded hover:opacity-70" style={{ color: '#EF4444' }}><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {aba === 'categorias' && (
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-40" style={{ color: 'var(--text-secondary)' }}>Carregando...</div>
          ) : categorias.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3" style={{ color: 'var(--text-secondary)' }}>
              <Tag className="w-8 h-8 opacity-30" />
              <p>Nenhuma categoria cadastrada</p>
              <button onClick={openNewCat} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#F5A623' }}>
                Criar primeira categoria
              </button>
            </div>
          ) : (
            <div className="max-w-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th className="pb-2 text-left font-semibold px-2" style={{ color: 'var(--text-secondary)' }}>Nome</th>
                    <th className="pb-2 text-center font-semibold px-2 w-20" style={{ color: 'var(--text-secondary)' }}>Ordem</th>
                    <th className="pb-2 text-center font-semibold px-2 w-28" style={{ color: 'var(--text-secondary)' }}>Produtos</th>
                    <th className="pb-2 text-center font-semibold px-2 w-28" style={{ color: 'var(--text-secondary)' }}>Cardápio</th>
                    <th className="pb-2 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {categorias.map(c => {
                    const qtd = produtos.filter(p => p.categoria_id === c.id).length
                    return (
                      <tr key={c.id} className="border-b hover:opacity-80 transition-opacity" style={{ borderColor: 'var(--border)' }}>
                        <td className="py-3 px-2 font-medium" style={{ color: 'var(--text-primary)' }}>
                          <div className="flex items-center gap-2">
                            <Tag className="w-3.5 h-3.5 shrink-0" style={{ color: '#F5A623' }} />
                            {c.nome}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-center" style={{ color: 'var(--text-secondary)' }}>{c.ordem}</td>
                        <td className="py-3 px-2 text-center">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: qtd > 0 ? '#F5A62322' : 'var(--bg)', color: qtd > 0 ? '#F5A623' : 'var(--text-secondary)' }}>
                            {qtd} produto{qtd !== 1 ? 's' : ''}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <button onClick={() => toggleExibirCardapio(c)} title={c.exibir_cardapio ? 'Visível no cardápio' : 'Oculto no cardápio'}>
                            {c.exibir_cardapio
                              ? <ToggleRight className="w-6 h-6 mx-auto" style={{ color: '#22C55E' }} />
                              : <ToggleLeft className="w-6 h-6 mx-auto" style={{ color: 'var(--text-secondary)' }} />}
                          </button>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => openEditCat(c)} className="p-1.5 rounded hover:opacity-70" style={{ color: '#F5A623' }}><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => deleteCat(c)} className="p-1.5 rounded hover:opacity-70" style={{ color: '#EF4444' }}><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Produto */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl" style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{editProduto ? 'Editar Produto' : 'Novo Produto'}</h2>
              <button onClick={() => setModalOpen(false)}><X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Nome *</label>
                  <input className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Marca</label>
                  <input className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    value={form.marca} onChange={e => setForm(f => ({ ...f, marca: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>EAN</label>
                  <div className="flex gap-2">
                    <input className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      value={form.ean} onChange={e => setForm(f => ({ ...f, ean: e.target.value }))} />
                    <button onClick={lookupEan} disabled={eanLookup} className="px-3 py-2 rounded-lg text-sm font-medium" style={{ background: '#F5A62322', color: '#F5A623', border: '1px solid #F5A62344' }}>
                      <Barcode className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Categoria *</label>
                  <select className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    value={form.categoria_id} onChange={e => setForm(f => ({ ...f, categoria_id: Number(e.target.value) }))}>
                    <option value={0}>Selecione...</option>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Estoque Mínimo</label>
                  <input type="number" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    value={form.estoque_minimo} onChange={e => setForm(f => ({ ...f, estoque_minimo: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Localização</label>
                  <input className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    value={form.localizacao} onChange={e => setForm(f => ({ ...f, localizacao: e.target.value }))} />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Controle de Validade</label>
                  <button onClick={() => setForm(f => ({ ...f, controle_validade: !f.controle_validade }))}>
                    {form.controle_validade
                      ? <ToggleRight className="w-7 h-7" style={{ color: '#F5A623' }} />
                      : <ToggleLeft className="w-7 h-7" style={{ color: 'var(--text-secondary)' }} />}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Produto Ativo</label>
                  <button onClick={() => setForm(f => ({ ...f, ativo: !f.ativo }))}>
                    {form.ativo
                      ? <ToggleRight className="w-7 h-7" style={{ color: '#22C55E' }} />
                      : <ToggleLeft className="w-7 h-7" style={{ color: 'var(--text-secondary)' }} />}
                  </button>
                </div>
              </div>

              {/* Unidades */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Unidades de Venda</h3>
                  <button onClick={addUnidade} className="flex items-center gap-1 text-xs px-2 py-1 rounded" style={{ color: '#F5A623', background: '#F5A62322' }}>
                    <Plus className="w-3 h-3" /> Adicionar
                  </button>
                </div>
                <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: 'var(--bg)' }}>
                        {['Tipo', 'Qtd. Base', 'Custo (R$)', 'Venda (R$)', 'Margem', ''].map(h => (
                          <th key={h} className="p-2 text-left font-semibold" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {unidades.map((u, i) => (
                        <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                          <td className="p-1">
                            <select className="w-full px-2 py-1 rounded text-xs outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                              value={u.tipo} onChange={e => updateUnidade(i, 'tipo', e.target.value as any)}>
                              <option value="unidade">Unidade</option>
                              <option value="fardo">Fardo</option>
                              <option value="caixa">Caixa</option>
                              <option value="barril">Barril</option>
                            </select>
                          </td>
                          <td className="p-1"><input type="number" className="w-full px-2 py-1 rounded text-xs outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} value={u.quantidade_base} onChange={e => updateUnidade(i, 'quantidade_base', Number(e.target.value))} /></td>
                          <td className="p-1"><input type="number" step="0.01" className="w-full px-2 py-1 rounded text-xs outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} value={u.preco_custo} onChange={e => updateUnidade(i, 'preco_custo', Number(e.target.value))} /></td>
                          <td className="p-1"><input type="number" step="0.01" className="w-full px-2 py-1 rounded text-xs outline-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} value={u.preco_venda} onChange={e => updateUnidade(i, 'preco_venda', Number(e.target.value))} /></td>
                          <td className="p-1 text-center font-medium" style={{ color: Number(margem(u)) >= 0 ? '#22C55E' : '#EF4444' }}>{margem(u)}%</td>
                          <td className="p-1">
                            {unidades.length > 1 && <button onClick={() => removeUnidade(i)} style={{ color: '#EF4444' }}><X className="w-3 h-3" /></button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>Cancelar</button>
                <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#F5A623' }}>
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Categoria */}
      {catModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-sm rounded-xl shadow-2xl" style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{editCat ? 'Editar Categoria' : 'Nova Categoria'}</h2>
              <button onClick={() => setCatModal(false)}><X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Nome *</label>
                <input
                  autoFocus
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  placeholder="Ex: Cervejas"
                  value={catForm.nome}
                  onChange={e => setCatForm(f => ({ ...f, nome: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && saveCat()}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Ordem de exibição</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  value={catForm.ordem}
                  onChange={e => setCatForm(f => ({ ...f, ordem: Number(e.target.value) }))}
                />
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button onClick={() => setCatModal(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>Cancelar</button>
                <button onClick={saveCat} disabled={savingCat} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#F5A623' }}>
                  {savingCat ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* XML Preview Modal */}
      {xmlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-xl max-h-[80vh] overflow-y-auto rounded-xl shadow-2xl" style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Importar XML — {xmlItems.length} itens</h2>
              <button onClick={() => setXmlModalOpen(false)}><X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} /></button>
            </div>
            <div className="p-4">
              <table className="w-full text-sm">
                <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['EAN', 'Nome', 'Qtd', 'Preço Unit.'].map(h => <th key={h} className="pb-2 text-left px-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {xmlItems.map((it, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="py-2 px-2 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{it.ean}</td>
                      <td className="py-2 px-2" style={{ color: 'var(--text-primary)' }}>{it.nome}</td>
                      <td className="py-2 px-2" style={{ color: 'var(--text-primary)' }}>{it.quantidade}</td>
                      <td className="py-2 px-2" style={{ color: 'var(--text-primary)' }}>{formatCurrency(it.preco_unitario)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end gap-3 mt-4">
                <button onClick={() => setXmlModalOpen(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>Cancelar</button>
                <button onClick={() => { toast.success('Produtos importados!'); setXmlModalOpen(false) }} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#F5A623' }}>Confirmar Importação</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <input ref={fileRef} type="file" accept=".xml" className="hidden" />
    </div>
  )
}
