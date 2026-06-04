import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ShoppingCart, Plus, Minus, X, Truck, ChevronRight, Package, Beer, Clock } from 'lucide-react'
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

    const SUPA_URL = import.meta.env.VITE_SUPABASE_URL as string
    const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

    // Verifica se as credenciais têm caracteres problemáticos
    const badUrl = [...SUPA_URL].some(c => c.charCodeAt(0) > 255)
    const badKey = [...SUPA_KEY].some(c => c.charCodeAt(0) > 255)
    console.log('[Loja] env URL ok:', !badUrl, '| KEY ok:', !badKey)

    // Usa fetch direto ao PostgREST para evitar o bug de header do cliente Supabase
    let lojaData: any = null
    try {
      const res = await fetch(
        `${SUPA_URL}/rest/v1/lojas?codigo=eq.${encodeURIComponent(codigo!)}&select=*`,
        {
          headers: {
            'apikey': SUPA_KEY,
            'Authorization': `Bearer ${SUPA_KEY}`,
            'Accept': 'application/json',
          },
        }
      )
      const rows = await res.json()
      console.log('[Loja] fetch direto rows:', rows)
      lojaData = Array.isArray(rows) && rows.length > 0 ? rows[0] : null
    } catch (e: any) {
      console.error('[Loja] fetch direto erro:', e?.message)
    }

    const loja = lojaData ? Object.fromEntries(
      Object.entries(lojaData).map(([k, v]) => [k, typeof v === 'string' ? v.normalize('NFC') : v])
    ) : null

    console.log('[Loja] cardapio_ativo:', loja?.cardapio_ativo)

    if (!loja) {
      setLoading(false)
      return
    }

    // Normaliza formas_pagamento: pode vir como string JSON ou array
    if (loja.formas_pagamento && typeof loja.formas_pagamento === 'string') {
      try { loja.formas_pagamento = JSON.parse(loja.formas_pagamento) } catch { /* mantém string */ }
    }

    setLoja(loja)

    const fetchJson = async (path: string) => {
      const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
        headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}`, 'Accept': 'application/json' },
      })
      return r.json()
    }

    const cats = await fetchJson(
      `cardapio_categorias?loja_id=eq.${loja.id}&ativa=eq.true&order=ordem`
    ).catch(() => [])

    const prods = await fetchJson(
      `cardapio_produtos?loja_id=eq.${loja.id}&ativo=eq.true&order=ordem&select=*,cardapio_unidades(*)`
    ).catch(() => [])

    const catsArr = cats || []
    setCategorias(catsArr)
    // categoriaAtiva fica null = "Todos" por padrão
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

      // Popula pedidos_rastreio imediatamente para o cliente ver o status sem esperar o lojista aceitar
      const itensResumo = carrinho.map(i => ({ nome: i.nome, quantidade: i.quantidade, total: i.total }))
      await supabase.from('pedidos_rastreio').insert({
        token,
        loja_id: loja.id,
        cliente_nome: form.nome,
        cliente_telefone: form.telefone,
        itens_resumo: itensResumo,
        total,
        status: 'novo',
        origem: 'online',
        observacao: form.observacao || null,
      })
      setTokenRastreio(token)
      setEtapa('confirmado')
    } catch (err) {
      alert('Erro ao enviar pedido. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  const grupos = useMemo(() => {
    const visiveis = categoriaAtiva ? categorias.filter(c => c.id === categoriaAtiva) : categorias
    return visiveis.map(c => ({
      categoria: c,
      produtos: produtos.filter(p => p.categoria_id === c.id),
    })).filter(g => g.produtos.length > 0)
  }, [categorias, produtos, categoriaAtiva])

  const totalItens = carrinho.reduce((s, i) => s + i.quantidade, 0)

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

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0a' }}>
      {/* Header sticky */}
      <div className="sticky top-0 z-30" style={{ background: '#111' }}>

        {/* Linha 1: logo grande + nome/endereço + badge + carrinho */}
        <div style={{ borderBottom: '1px solid #1e1e1e' }}>
          <div className="max-w-6xl mx-auto px-5 py-4 flex items-center gap-4">

            {/* Logo circular maior com borda âmbar */}
            <div className="flex-shrink-0 rounded-full" style={{ padding: 3, border: '3px solid #F5A623' }}>
              {loja.logo_url
                ? <img src={loja.logo_url} className="w-16 h-16 rounded-full object-cover block" />
                : <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
                    style={{ background: '#1a1a1a' }}>🍔</div>
              }
            </div>

            {/* Nome + endereço/cidade */}
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-xl leading-tight truncate text-white">{loja.nome}</h1>
              {(loja.cidade || loja.estado || loja.endereco) && (
                <p className="text-xs mt-1 uppercase tracking-widest truncate" style={{ color: '#666' }}>
                  {loja.cidade && loja.estado
                    ? `${loja.cidade} · ${loja.estado}`
                    : loja.cidade || loja.estado || loja.endereco}
                </p>
              )}
            </div>

            {/* Badge Aberto / Fechado — fundo sólido */}
            <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
              style={{
                background: loja.cardapio_ativo ? '#16a34a' : '#dc2626',
                color: '#fff',
              }}>
              <span className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.7)' }} />
              {loja.cardapio_ativo ? 'Aberto' : 'Fechado no momento'}
            </div>

            {/* Botão carrinho (quando há itens) */}
            {carrinho.length > 0 && (
              <button onClick={() => setShowCarrinho(true)}
                className="relative flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm flex-shrink-0 transition-transform hover:scale-105"
                style={{ background: '#F5A623', color: '#000' }}>
                <ShoppingCart size={15} />
                <span className="hidden sm:inline">{formatCurrency(subtotal)}</span>
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center"
                  style={{ background: '#EF4444', color: '#fff' }}>
                  {carrinho.reduce((s, i) => s + i.quantidade, 0)}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Linha 2: barra de informações centralizada */}
        <div className="overflow-x-auto scrollbar-none" style={{ borderBottom: '1px solid #1e1e1e', background: '#0e0e0e' }}>
          <div className="flex items-center justify-center gap-0 py-3 text-xs whitespace-nowrap px-4"
            style={{ minWidth: 'max-content', margin: '0 auto' }}>

            <span className="flex items-center gap-1.5" style={{ color: '#aaa' }}>
              <Truck size={13} style={{ color: '#F5A623' }} />
              Entrega a partir de&nbsp;
              <strong style={{ color: '#F5A623', fontWeight: 700 }}>
                {loja.taxa_entrega > 0 ? formatCurrency(loja.taxa_entrega) : 'R$ 0,00'}
              </strong>
            </span>

            <span className="mx-4" style={{ color: '#444' }}>·</span>

            <span className="flex items-center gap-1.5" style={{ color: '#aaa' }}>
              📋 Pedido mínimo&nbsp;
              <strong style={{ color: '#F5A623', fontWeight: 700 }}>
                {formatCurrency(loja.pedido_minimo || 0)}
              </strong>
            </span>

            {(loja.tempo_entrega || loja.tempo_retirada) && (
              <>
                <span className="mx-4" style={{ color: '#444' }}>·</span>
                <span className="flex items-center gap-1.5" style={{ color: '#aaa' }}>
                  ⏱&nbsp;
                  {loja.tempo_entrega && (
                    <>Entrega&nbsp;<strong style={{ color: '#F5A623', fontWeight: 700 }}>{loja.tempo_entrega}</strong></>
                  )}
                  {loja.tempo_entrega && loja.tempo_retirada && (
                    <span style={{ color: '#444' }}>&nbsp;·&nbsp;</span>
                  )}
                  {loja.tempo_retirada && (
                    <>Retirada&nbsp;<strong style={{ color: '#F5A623', fontWeight: 700 }}>{loja.tempo_retirada}</strong></>
                  )}
                </span>
              </>
            )}

            <span className="mx-4" style={{ color: '#444' }}>·</span>
            <span className="flex items-center gap-1.5" style={{ color: '#aaa' }}>
              💳&nbsp;
              {loja.formas_pagamento
                ? (Array.isArray(loja.formas_pagamento)
                    ? loja.formas_pagamento.join(' · ')
                    : loja.formas_pagamento)
                : 'PIX · Cartão · Dinheiro'}
            </span>
          </div>
        </div>

        {/* Linha 3: nav de categorias */}
        {categorias.length > 0 && (
          <div className="overflow-x-auto scrollbar-none" style={{ background: '#111', borderBottom: '2px solid #1e1e1e' }}>
            <div className="flex items-stretch px-2" style={{ minWidth: 'max-content' }}>
              {/* Botão Todos */}
              <button onClick={() => setCategoriaAtiva(null)}
                className="relative flex-shrink-0 flex items-center gap-1.5 px-5 py-3.5 text-sm whitespace-nowrap transition-all"
                style={{
                  fontWeight: categoriaAtiva === null ? 700 : 400,
                  color: categoriaAtiva === null ? '#fff' : '#555',
                  background: 'none',
                  borderBottom: `2px solid ${categoriaAtiva === null ? '#F5A623' : 'transparent'}`,
                  marginBottom: -2,
                }}>
                Todos
                {categoriaAtiva === null && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full"
                    style={{ background: 'linear-gradient(90deg,#F5A623,#FFD166)' }} />
                )}
              </button>
              {categorias.map(c => {
                const ativa = categoriaAtiva === c.id
                return (
                  <button key={c.id} onClick={() => setCategoriaAtiva(c.id)}
                    className="relative flex-shrink-0 flex items-center gap-1.5 px-5 py-3.5 text-sm whitespace-nowrap transition-all"
                    style={{
                      fontWeight: ativa ? 700 : 400,
                      color: ativa ? '#fff' : '#555',
                      background: 'none',
                      borderBottom: `2px solid ${ativa ? '#F5A623' : 'transparent'}`,
                      marginBottom: -2,
                    }}>
                    {c.emoji && <span className="text-base leading-none">{c.emoji}</span>}
                    <span>{c.nome}</span>
                    {ativa && (
                      <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full"
                        style={{ background: 'linear-gradient(90deg,#F5A623,#FFD166)' }} />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Banner loja fechada */}
      {!loja.cardapio_ativo && (
        <div className="flex items-center gap-3 px-5 py-4 mx-4 mt-4 rounded-2xl"
          style={{ background: '#dc26261a', border: '1px solid #dc262640' }}>
          <span className="text-2xl">🔒</span>
          <div>
            <p className="font-bold text-sm" style={{ color: '#f87171' }}>Loja fechada no momento</p>
            <p className="text-xs mt-0.5" style={{ color: '#aaa' }}>
              Você pode conferir o cardápio mas não é possível fazer pedidos agora.
            </p>
          </div>
        </div>
      )}

      {/* ── CATÁLOGO ───────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-32 space-y-10">
        {grupos.length === 0 && (
          <div className="py-24 text-center text-gray-600">
            <Package size={56} className="mx-auto mb-4 opacity-30" />
            <p className="text-sm">Nenhum produto disponível no momento</p>
          </div>
        )}

        {grupos.map(({ categoria, produtos: prods }) => (
          <section key={categoria.id}>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-bold">{categoria.nome}</h2>
              <span className="text-xs text-gray-500">{prods.length} {prods.length === 1 ? 'item' : 'itens'}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {prods.map(p => {
                const unidades = (p.cardapio_unidades || []).filter((u: any) => u.ativo)
                const precoMin = unidades.length > 0 ? Math.min(...unidades.map((u: any) => u.preco)) : 0

                return (
                  <article key={p.id} className="rounded-2xl overflow-hidden flex flex-col transition-all hover:scale-[1.01]"
                    style={{ background: '#121212', border: '1px solid #1f1f1f' }}>
                    {/* Foto */}
                    <div className="aspect-[4/3] relative overflow-hidden" style={{ background: '#0e0e0e' }}>
                      {p.foto_url ? (
                        <img src={p.foto_url} alt={p.nome} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Beer size={56} className="opacity-20" style={{ color: '#F5A623' }} />
                        </div>
                      )}
                    </div>

                    {/* Conteúdo */}
                    <div className="p-4 flex-1 flex flex-col">
                      <h3 className="font-semibold text-sm sm:text-base leading-tight">{p.nome}</h3>
                      {p.descricao && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.descricao}</p>
                      )}

                      <div className="mt-3 flex items-baseline gap-1">
                        {unidades.length > 1 && <span className="text-[10px] text-gray-500">a partir de</span>}
                        <span className="font-bold text-base" style={{ color: '#F5A623' }}>
                          {formatCurrency(precoMin)}
                        </span>
                      </div>

                      {/* Unidades: chips */}
                      <div className="mt-3 space-y-2 flex-1">
                        {unidades.map((u: any) => {
                          const noCarrinho = carrinho.find(i => i.id === `${p.id}-${u.id}`)
                          return (
                            <div key={u.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg"
                              style={{ background: '#191919', border: '1px solid #252525' }}>
                              <div className="min-w-0">
                                <div className="text-xs font-medium capitalize truncate">
                                  {u.tipo}
                                  {u.quantidade_base > 1 && <span className="text-gray-500 ml-1">({u.quantidade_base})</span>}
                                </div>
                                <div className="text-xs font-bold" style={{ color: '#F5A623' }}>
                                  {formatCurrency(u.preco)}
                                </div>
                              </div>
                              {noCarrinho ? (
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <button onClick={() => updateQtd(noCarrinho.id, -1)}
                                    className="w-7 h-7 rounded-full flex items-center justify-center"
                                    style={{ background: '#0a0a0a', border: '1px solid #2a2a2a' }}>
                                    <Minus size={12} />
                                  </button>
                                  <span className="w-5 text-center text-xs font-bold">{noCarrinho.quantidade}</span>
                                  <button onClick={() => updateQtd(noCarrinho.id, 1)}
                                    className="w-7 h-7 rounded-full flex items-center justify-center"
                                    style={{ background: '#F5A623', color: '#000' }}>
                                    <Plus size={12} />
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => addAoCarrinho(p, u)}
                                  className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-transform hover:scale-105"
                                  style={{ background: '#F5A623', color: '#000' }}>
                                  <Plus size={12} /> Adicionar
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ))}
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

                  {!loja.cardapio_ativo && (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
                      style={{ background: '#dc26261a', border: '1px solid #dc262640', color: '#f87171' }}>
                      🔒 Loja fechada — pedidos desabilitados no momento
                    </div>
                  )}
                  <button onClick={finalizarPedido} disabled={enviando || !loja.cardapio_ativo}
                    className="w-full py-4 rounded-xl font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: loja.cardapio_ativo ? '#22C55E' : '#444', color: '#fff' }}>
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
