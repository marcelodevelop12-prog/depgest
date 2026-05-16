import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ShoppingCart, Plus, Minus, X, MapPin, Clock, Truck, Phone, ChevronRight, Package } from 'lucide-react'
import { supabase, formatCurrency } from '../lib/supabase'

interface ItemCarrinho {
  id: string
  produto_id: string
  unidade_id: string
  nome: string
  tipo: string
  quantidade: number
  preco: number
  total: number
}

type Etapa = 'cardapio' | 'checkout' | 'confirmado'

export default function Loja() {
  const { codigo } = useParams<{ codigo: string }>()
  const [loja, setLoja] = useState<any>(null)
  const [produtos, setProdutos] = useState<any[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [categoriaAtiva, setCategoriaAtiva] = useState<string | null>(null)
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([])
  const [etapa, setEtapa] = useState<Etapa>('cardapio')
  const [showCarrinho, setShowCarrinho] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tokenRastreio, setTokenRastreio] = useState('')
  const [form, setForm] = useState({
    nome: '', telefone: '', endereco: '', bairro: '',
    tipo_entrega: 'entrega' as 'entrega' | 'retirada',
    forma_pagamento: 'pix' as string,
    troco_para: '', observacao: '',
  })
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    loadLoja()
  }, [codigo])

  async function loadLoja() {
    setLoading(true)
    const { data: lojaData } = await supabase
      .from('lojas')
      .select('*')
      .eq('codigo', codigo)
      .eq('cardapio_ativo', true)
      .single()

    if (!lojaData) { setLoading(false); return }
    setLoja(lojaData)

    const { data: cats } = await supabase
      .from('cardapio_categorias')
      .select('*')
      .eq('loja_id', lojaData.id)
      .eq('ativa', true)
      .order('ordem')

    const { data: prods } = await supabase
      .from('cardapio_produtos')
      .select('*, cardapio_unidades(*)')
      .eq('loja_id', lojaData.id)
      .eq('ativo', true)
      .order('ordem')

    setCategorias(cats || [])
    setProdutos(prods || [])
    setLoading(false)
  }

  function addAoCarrinho(produto: any, unidade: any) {
    const key = `${produto.id}-${unidade.id}`
    const existing = carrinho.find(i => i.id === key)
    if (existing) {
      setCarrinho(c => c.map(i => i.id === key
        ? { ...i, quantidade: i.quantidade + 1, total: (i.quantidade + 1) * i.preco }
        : i
      ))
    } else {
      setCarrinho(c => [...c, {
        id: key, produto_id: produto.id, unidade_id: unidade.id,
        nome: `${produto.nome}${unidade.tipo !== 'unidade' ? ` (${unidade.tipo})` : ''}`,
        tipo: unidade.tipo, quantidade: 1, preco: unidade.preco, total: unidade.preco,
      }])
    }
  }

  function updateQtd(id: string, delta: number) {
    setCarrinho(c => c
      .map(i => i.id === id ? { ...i, quantidade: i.quantidade + delta, total: (i.quantidade + delta) * i.preco } : i)
      .filter(i => i.quantidade > 0)
    )
  }

  const subtotal = carrinho.reduce((s, i) => s + i.total, 0)
  const taxaEntrega = form.tipo_entrega === 'entrega' ? (loja?.taxa_entrega || 0) : 0
  const total = subtotal + taxaEntrega

  async function finalizarPedido() {
    if (!form.nome || !form.telefone) { alert('Preencha seu nome e telefone'); return }
    if (form.tipo_entrega === 'entrega' && !form.endereco) { alert('Informe o endereço de entrega'); return }
    if (total < (loja?.pedido_minimo || 0)) {
      alert(`Pedido mínimo: ${formatCurrency(loja.pedido_minimo)}`); return
    }

    setEnviando(true)
    try {
      const itens = carrinho.map(i => ({
        produto_id: i.produto_id, unidade_id: i.unidade_id,
        nome: i.nome, tipo: i.tipo, quantidade: i.quantidade,
        preco_unitario: i.preco, total: i.total,
      }))

      const token = Math.random().toString(36).slice(2, 10).toUpperCase()

      const { error } = await supabase.from('pedidos_online').insert({
        loja_id: loja.id,
        token_rastreio: token,
        cliente_nome: form.nome,
        cliente_telefone: form.telefone,
        cliente_endereco: form.tipo_entrega === 'entrega' ? `${form.endereco}, ${form.bairro}` : null,
        tipo_entrega: form.tipo_entrega,
        forma_pagamento: form.forma_pagamento,
        itens,
        subtotal,
        taxa_entrega: taxaEntrega,
        total,
        troco_para: form.forma_pagamento === 'dinheiro' && form.troco_para ? parseFloat(form.troco_para) : null,
        observacao: form.observacao || null,
        status: 'novo',
        sincronizado: false,
      })

      if (error) throw error
      setTokenRastreio(token)
      setEtapa('confirmado')
    } catch (err) {
      alert('Erro ao enviar pedido. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0a' }}>
      <div className="text-center">
        <div className="w-10 h-10 rounded-full border-2 border-t-transparent mx-auto mb-3"
          style={{ borderColor: '#F5A62340', borderTopColor: '#F5A623', animation: 'spin 0.8s linear infinite' }} />
        <p className="text-gray-400 text-sm">Carregando cardápio...</p>
      </div>
    </div>
  )

  if (!loja) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0a' }}>
      <div className="text-center max-w-sm px-4">
        <div className="text-5xl mb-4">🍺</div>
        <h1 className="text-xl font-bold mb-2">Cardápio não encontrado</h1>
        <p className="text-gray-400 text-sm">Este cardápio não está disponível ou foi desativado.</p>
      </div>
    </div>
  )

  if (etapa === 'confirmado') return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0a0a0a' }}>
      <div className="text-center max-w-sm fade-up">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ background: '#22C55E20', border: '2px solid #22C55E40' }}>
          <span className="text-4xl">✓</span>
        </div>
        <h1 className="text-2xl font-bold mb-2">Pedido Enviado!</h1>
        <p className="text-gray-400 mb-6">Aguarde a confirmação do depósito</p>
        <div className="rounded-2xl p-4 mb-6 text-left" style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
          <p className="text-xs text-gray-500 mb-1">TOKEN DE RASTREIO</p>
          <p className="font-mono font-bold text-lg" style={{ color: '#F5A623' }}>{tokenRastreio}</p>
        </div>
        <a href={`/rastreio/${tokenRastreio}`}
          className="block w-full py-3 rounded-xl font-semibold text-sm text-center"
          style={{ background: '#F5A623', color: '#000' }}>
          Acompanhar Pedido →
        </a>
      </div>
    </div>
  )

  const prodsFiltrados = categoriaAtiva
    ? produtos.filter(p => p.categoria_id === categoriaAtiva)
    : produtos

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0a' }}>
      {/* Header */}
      <div className="sticky top-0 z-30" style={{ background: '#111', borderBottom: '1px solid #222' }}>
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            {loja.logo_url && <img src={loja.logo_url} className="w-10 h-10 rounded-full object-cover" />}
            <div className="flex-1">
              <h1 className="font-bold">{loja.nome}</h1>
              <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                {loja.taxa_entrega > 0 ? (
                  <span className="flex items-center gap-1"><Truck size={10} />{formatCurrency(loja.taxa_entrega)} entrega</span>
                ) : (
                  <span className="flex items-center gap-1"><Truck size={10} />Entrega grátis</span>
                )}
                {loja.pedido_minimo > 0 && (
                  <span>Mín. {formatCurrency(loja.pedido_minimo)}</span>
                )}
              </div>
            </div>
            {carrinho.length > 0 && (
              <button onClick={() => setShowCarrinho(true)}
                className="relative flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm"
                style={{ background: '#F5A623', color: '#000' }}>
                <ShoppingCart size={16} />
                {formatCurrency(subtotal)}
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center"
                  style={{ background: '#EF4444', color: '#fff' }}>
                  {carrinho.reduce((s, i) => s + i.quantidade, 0)}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Categorias */}
        {categorias.length > 0 && (
          <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-none">
            <button onClick={() => setCategoriaAtiva(null)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
              style={{
                background: !categoriaAtiva ? '#F5A623' : '#1a1a1a',
                color: !categoriaAtiva ? '#000' : '#888',
              }}>
              Todos
            </button>
            {categorias.map(c => (
              <button key={c.id} onClick={() => setCategoriaAtiva(c.id)}
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                style={{
                  background: categoriaAtiva === c.id ? '#F5A623' : '#1a1a1a',
                  color: categoriaAtiva === c.id ? '#000' : '#888',
                }}>
                {c.nome}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Produtos */}
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3 pb-32">
        {prodsFiltrados.map(p => (
          <div key={p.id} className="rounded-2xl overflow-hidden fade-up" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
            <div className="flex gap-3 p-4">
              {p.foto_url ? (
                <img src={p.foto_url} alt={p.nome} className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
              ) : (
                <div className="w-20 h-20 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#1a1a1a' }}>
                  <Package size={24} className="text-gray-700" />
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-semibold">{p.nome}</h3>
                {p.descricao && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.descricao}</p>}
              </div>
            </div>

            {/* Unidades */}
            <div style={{ borderTop: '1px solid #1e1e1e' }}>
              {(p.cardapio_unidades || []).filter((u: any) => u.ativo).map((u: any) => {
                const noCarrinho = carrinho.find(i => i.id === `${p.id}-${u.id}`)
                return (
                  <div key={u.id} className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #1a1a1a' }}>
                    <div>
                      <span className="text-sm font-medium capitalize">{u.tipo}</span>
                      {u.quantidade_base > 1 && <span className="text-xs text-gray-500 ml-1">({u.quantidade_base} un)</span>}
                      <div className="text-sm font-bold mt-0.5" style={{ color: '#F5A623' }}>{formatCurrency(u.preco)}</div>
                    </div>
                    {noCarrinho ? (
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQtd(noCarrinho.id, -1)}
                          className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                          style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
                          <Minus size={14} />
                        </button>
                        <span className="w-6 text-center font-bold">{noCarrinho.quantidade}</span>
                        <button onClick={() => updateQtd(noCarrinho.id, 1)}
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ background: '#F5A623', color: '#000' }}>
                          <Plus size={14} />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => addAoCarrinho(p, u)}
                        className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                        style={{ background: '#F5A623', color: '#000' }}>
                        <Plus size={14} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {prodsFiltrados.length === 0 && (
          <div className="py-20 text-center text-gray-600">
            <Package size={48} className="mx-auto mb-3 opacity-30" />
            <p>Nenhum produto disponível</p>
          </div>
        )}
      </div>

      {/* Botão carrinho fixo */}
      {carrinho.length > 0 && !showCarrinho && (
        <div className="fixed bottom-0 left-0 right-0 p-4" style={{ background: 'linear-gradient(to top, #0a0a0a, transparent)' }}>
          <div className="max-w-2xl mx-auto">
            <button onClick={() => setShowCarrinho(true)}
              className="w-full flex items-center justify-between py-4 px-5 rounded-2xl font-semibold"
              style={{ background: '#F5A623', color: '#000' }}>
              <span className="w-7 h-7 rounded-full bg-black/20 flex items-center justify-center text-sm">
                {carrinho.reduce((s, i) => s + i.quantidade, 0)}
              </span>
              <span>Ver Carrinho</span>
              <span>{formatCurrency(subtotal)}</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal Carrinho / Checkout */}
      {showCarrinho && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div className="w-full max-w-lg rounded-t-3xl md:rounded-2xl max-h-[90vh] flex flex-col fade-up"
            style={{ background: '#111', border: '1px solid #222' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1e1e1e' }}>
              <h2 className="font-bold text-lg">{etapa === 'cardapio' ? 'Seu Carrinho' : 'Finalizar Pedido'}</h2>
              <button onClick={() => { setShowCarrinho(false); setEtapa('cardapio') }}>
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Itens */}
              {etapa === 'cardapio' && (
                <>
                  {carrinho.map(i => (
                    <div key={i.id} className="flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{i.nome}</p>
                        <p className="text-xs text-gray-500">{formatCurrency(i.preco)} cada</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQtd(i.id, -1)}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
                          style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
                          <Minus size={12} />
                        </button>
                        <span className="w-5 text-center text-sm font-bold">{i.quantidade}</span>
                        <button onClick={() => updateQtd(i.id, 1)}
                          className="w-7 h-7 rounded-full flex items-center justify-center"
                          style={{ background: '#F5A623', color: '#000' }}>
                          <Plus size={12} />
                        </button>
                      </div>
                      <span className="text-sm font-bold w-20 text-right">{formatCurrency(i.total)}</span>
                    </div>
                  ))}

                  <div className="pt-3" style={{ borderTop: '1px solid #1e1e1e' }}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Subtotal</span><span>{formatCurrency(subtotal)}</span>
                    </div>
                    {loja.taxa_entrega > 0 && (
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">Taxa de entrega</span><span>{formatCurrency(loja.taxa_entrega)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg pt-2" style={{ borderTop: '1px solid #1e1e1e' }}>
                      <span>Total</span><span style={{ color: '#F5A623' }}>{formatCurrency(subtotal + loja.taxa_entrega)}</span>
                    </div>
                  </div>

                  <button onClick={() => setEtapa('checkout')}
                    className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                    style={{ background: '#F5A623', color: '#000' }}>
                    Continuar <ChevronRight size={16} />
                  </button>
                </>
              )}

              {/* Checkout */}
              {etapa === 'checkout' && (
                <div className="space-y-4">
                  {/* Tipo de entrega */}
                  <div className="grid grid-cols-2 gap-2">
                    {(['entrega', 'retirada'] as const).map(t => (
                      <button key={t} onClick={() => setForm(f => ({ ...f, tipo_entrega: t }))}
                        className="py-3 rounded-xl text-sm font-medium capitalize transition-colors"
                        style={{
                          background: form.tipo_entrega === t ? '#F5A62320' : '#1a1a1a',
                          border: `1px solid ${form.tipo_entrega === t ? '#F5A623' : '#2a2a2a'}`,
                          color: form.tipo_entrega === t ? '#F5A623' : '#888',
                        }}>
                        {t === 'entrega' ? '🚚 Entrega' : '🏪 Retirada'}
                      </button>
                    ))}
                  </div>

                  {/* Dados pessoais */}
                  {[
                    { key: 'nome', label: 'Seu nome *', placeholder: 'Como prefere ser chamado?' },
                    { key: 'telefone', label: 'WhatsApp *', placeholder: '(11) 99999-9999' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
                      <input value={(form as any)[f.key]} onChange={e => setForm(d => ({ ...d, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="w-full px-4 py-3 rounded-xl text-sm"
                        style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff' }} />
                    </div>
                  ))}

                  {form.tipo_entrega === 'entrega' && (
                    <>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Endereço *</label>
                        <input value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))}
                          placeholder="Rua, número, complemento"
                          className="w-full px-4 py-3 rounded-xl text-sm"
                          style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff' }} />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Bairro</label>
                        <input value={form.bairro} onChange={e => setForm(f => ({ ...f, bairro: e.target.value }))}
                          placeholder="Bairro"
                          className="w-full px-4 py-3 rounded-xl text-sm"
                          style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff' }} />
                      </div>
                    </>
                  )}

                  {/* Forma de pagamento */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-2">Forma de Pagamento</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'pix', label: 'PIX' },
                        { id: 'dinheiro', label: 'Dinheiro' },
                        { id: 'cartao', label: 'Cartão' },
                      ].map(f => (
                        <button key={f.id} onClick={() => setForm(d => ({ ...d, forma_pagamento: f.id }))}
                          className="py-2.5 rounded-xl text-xs font-medium transition-colors"
                          style={{
                            background: form.forma_pagamento === f.id ? '#F5A62320' : '#1a1a1a',
                            border: `1px solid ${form.forma_pagamento === f.id ? '#F5A623' : '#2a2a2a'}`,
                            color: form.forma_pagamento === f.id ? '#F5A623' : '#888',
                          }}>
                          {f.label}
                        </button>
                      ))}
                    </div>
                    {form.forma_pagamento === 'dinheiro' && (
                      <input type="number" value={form.troco_para}
                        onChange={e => setForm(f => ({ ...f, troco_para: e.target.value }))}
                        placeholder={`Troco para quanto? (Total: ${formatCurrency(total)})`}
                        className="w-full mt-2 px-4 py-3 rounded-xl text-sm"
                        style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff' }} />
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Observação (opcional)</label>
                    <textarea value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
                      placeholder="Ex: Sem gelo, portão azul..."
                      rows={2}
                      className="w-full px-4 py-3 rounded-xl text-sm resize-none"
                      style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff' }} />
                  </div>

                  {/* Resumo final */}
                  <div className="p-4 rounded-xl space-y-2" style={{ background: '#1a1a1a' }}>
                    <div className="flex justify-between text-sm"><span className="text-gray-400">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-400">Entrega</span><span>{taxaEntrega > 0 ? formatCurrency(taxaEntrega) : 'Grátis'}</span></div>
                    <div className="flex justify-between font-bold" style={{ borderTop: '1px solid #333', paddingTop: 8 }}>
                      <span>Total</span><span style={{ color: '#F5A623' }}>{formatCurrency(total)}</span>
                    </div>
                  </div>

                  <button onClick={finalizarPedido} disabled={enviando}
                    className="w-full py-4 rounded-xl font-bold text-sm disabled:opacity-50"
                    style={{ background: '#22C55E', color: '#fff' }}>
                    {enviando ? 'Enviando pedido...' : `✓ Confirmar Pedido • ${formatCurrency(total)}`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
