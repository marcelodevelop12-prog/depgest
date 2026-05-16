import { useEffect, useRef, useState, useCallback } from 'react'
import { Search, X, Plus, Minus, Trash2, User, ShoppingCart, CreditCard, Banknote, Smartphone, ChevronRight, Printer, MessageCircle, Percent, Tag } from 'lucide-react'
import { usePdvStore } from '../store/pdv'
import { formatCurrency, whatsappUrl, gerarLinkRastreio } from '../lib/utils'
import toast from 'react-hot-toast'
import QRCode from 'qrcode'

type FormaPagamento = 'dinheiro' | 'pix' | 'debito' | 'credito' | 'fiado' | 'misto'

export default function PDV() {
  const store = usePdvStore()
  const scanRef = useRef<HTMLInputElement>(null)
  const [produtos, setProdutos] = useState<any[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [categoriaAtiva, setCategoriaAtiva] = useState<number | null>(null)
  const [busca, setBusca] = useState('')
  const [clientes, setClientes] = useState<any[]>([])
  const [buscaCliente, setBuscaCliente] = useState('')
  const [showPagamento, setShowPagamento] = useState(false)
  const [showCliente, setShowCliente] = useState(false)
  const scanBuffer = useRef('')
  const scanTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    loadProdutos()
    loadCategorias()
    // Foco no scanner invisível sempre que a tela estiver ativa
    focusScanner()
    document.addEventListener('click', focusScanner)
    return () => document.removeEventListener('click', focusScanner)
  }, [])

  useEffect(() => {
    loadProdutos()
  }, [busca, categoriaAtiva])

  function focusScanner() {
    if (!showPagamento && !showCliente) {
      scanRef.current?.focus()
    }
  }

  async function loadProdutos() {
    if (!window.api) { setProdutos(mockProdutos); return }
    const result = await window.api.produtos.list({
      busca: busca || undefined,
      categoria_id: categoriaAtiva || undefined,
      ativo: true,
    })
    setProdutos(result)
  }

  async function loadCategorias() {
    if (!window.api) { setCategorias(mockCategorias); return }
    const result = await window.api.categorias.list()
    setCategorias(result)
  }

  // Scanner de código de barras USB — lê via input invisible
  function handleScanInput(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const ean = scanBuffer.current.trim()
      scanBuffer.current = ''
      if (ean) processEan(ean)
    } else if (e.key.length === 1) {
      scanBuffer.current += e.key
      clearTimeout(scanTimer.current)
      scanTimer.current = setTimeout(() => { scanBuffer.current = '' }, 100)
    }
  }

  async function processEan(ean: string) {
    const produto = produtos.find(p => p.ean === ean)
    if (produto) {
      await adicionarProduto(produto)
      toast.success(`${produto.nome} adicionado!`, { duration: 1500 })
    } else {
      toast.error(`EAN ${ean} não encontrado`, { duration: 2000 })
    }
  }

  async function adicionarProduto(produto: any) {
    if (!window.api) {
      const unidadePadrao = { id: produto.id * 100, tipo: 'unidade', quantidade_base: 1, preco_venda: produto.preco_venda || 0 }
      store.addItem({
        produto_id: produto.id,
        produto_unidade_id: unidadePadrao.id,
        nome: produto.nome,
        tipo: unidadePadrao.tipo,
        quantidade: 1,
        preco_unitario: unidadePadrao.preco_venda,
        desconto: 0,
      })
      return
    }

    const unidades = await window.api.produtos.listUnidades(produto.id)
    if (!unidades.length) { toast.error('Produto sem unidade de venda cadastrada'); return }

    if (unidades.length === 1) {
      const u = unidades[0]
      store.addItem({
        produto_id: produto.id,
        produto_unidade_id: u.id,
        nome: `${produto.nome}${u.tipo !== 'unidade' ? ` (${u.tipo})` : ''}`,
        tipo: u.tipo,
        quantidade: 1,
        preco_unitario: u.preco_venda,
        desconto: 0,
      })
    } else {
      // Mostra seletor de unidade
      setSelectingUnidade({ produto, unidades })
    }
  }

  const [selectingUnidade, setSelectingUnidade] = useState<{ produto: any; unidades: any[] } | null>(null)

  function selecionarUnidade(produto: any, unidade: any) {
    store.addItem({
      produto_id: produto.id,
      produto_unidade_id: unidade.id,
      nome: `${produto.nome} (${unidade.tipo})`,
      tipo: unidade.tipo,
      quantidade: 1,
      preco_unitario: unidade.preco_venda,
      desconto: 0,
    })
    setSelectingUnidade(null)
  }

  async function buscarClientes(q: string) {
    if (!q) { setClientes([]); return }
    if (!window.api) { setClientes(mockClientes.filter(c => c.nome.toLowerCase().includes(q.toLowerCase()))); return }
    const result = await window.api.clientes.list({ busca: q })
    setClientes(result.slice(0, 5))
  }

  const produtosFiltrados = produtos

  return (
    <div className="h-full flex overflow-hidden">
      {/* Scanner input invisível — sempre recebe o input do leitor USB */}
      <input
        ref={scanRef}
        className="sr-only"
        onKeyDown={handleScanInput}
        readOnly
        tabIndex={-1}
        aria-hidden
      />

      {/* Esquerda: produtos */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ borderRight: '1px solid var(--border)' }}>
        {/* Barra de busca */}
        <div className="flex-shrink-0 p-4 space-y-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <Search size={15} style={{ color: 'var(--text-secondary)' }} />
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar produto por nome..."
                className="flex-1 text-sm bg-transparent"
                style={{ color: 'var(--text-primary)' }}
                onFocus={() => {}} // não redirecionar scanner
              />
              {busca && <button onClick={() => setBusca('')}><X size={14} /></button>}
            </div>
            <div className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg scanner-active"
              style={{ color: 'var(--text-secondary)', background: 'var(--card)' }}>
              Scanner
            </div>
          </div>

          {/* Categorias */}
          <div className="flex gap-2 overflow-x-auto scroll-area-x pb-1">
            <button
              onClick={() => setCategoriaAtiva(null)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
              style={{
                background: categoriaAtiva === null ? '#F5A623' : 'var(--card)',
                color: categoriaAtiva === null ? '#000' : 'var(--text-secondary)',
                border: '1px solid var(--border)',
              }}>
              Todos
            </button>
            {categorias.map(c => (
              <button key={c.id}
                onClick={() => setCategoriaAtiva(categoriaAtiva === c.id ? null : c.id)}
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                style={{
                  background: categoriaAtiva === c.id ? '#F5A623' : 'var(--card)',
                  color: categoriaAtiva === c.id ? '#000' : 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                }}>
                {c.nome}
              </button>
            ))}
          </div>
        </div>

        {/* Grade de produtos */}
        <div className="flex-1 overflow-y-auto scroll-area p-4">
          {produtosFiltrados.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm" style={{ color: 'var(--text-secondary)' }}>
              {busca ? `Nenhum produto encontrado para "${busca}"` : 'Nenhum produto cadastrado'}
            </div>
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
              {produtosFiltrados.map(p => (
                <button
                  key={p.id}
                  onClick={() => adicionarProduto(p)}
                  className="text-left p-4 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99]"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  {p.foto_path && (
                    <div className="w-full h-24 rounded-lg mb-3 overflow-hidden">
                      <img src={`file://${p.foto_path}`} alt={p.nome}
                        className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="font-medium text-sm truncate">{p.nome}</div>
                  {p.marca && <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>{p.marca}</div>}
                  <div className="text-sm font-bold mt-2" style={{ color: '#F5A623' }}>
                    {p.preco_venda ? formatCurrency(p.preco_venda) : 'Ver unidades'}
                  </div>
                  <div className="text-xs mt-1" style={{ color: p.saldo_estoque <= 0 ? '#EF4444' : 'var(--text-secondary)' }}>
                    Estoque: {p.saldo_estoque ?? 0}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Direita: carrinho */}
      <div className="w-80 xl:w-96 flex-shrink-0 flex flex-col overflow-hidden">
        {/* Header carrinho */}
        <div className="flex-shrink-0 px-4 py-3 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <ShoppingCart size={16} style={{ color: '#F5A623' }} />
            <span className="font-semibold text-sm">Carrinho</span>
            {store.itens.length > 0 && (
              <span className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center"
                style={{ background: '#F5A623', color: '#000' }}>
                {store.itens.length}
              </span>
            )}
          </div>
          {store.itens.length > 0 && (
            <button onClick={store.limpar} className="text-xs px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors"
              style={{ color: '#EF4444' }}>
              Limpar
            </button>
          )}
        </div>

        {/* Cliente */}
        <div className="flex-shrink-0 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          {store.cliente ? (
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg" style={{ background: '#22C55E20' }}>
                <User size={14} style={{ color: '#22C55E' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{store.cliente.nome}</p>
                {store.cliente.saldo_fiado > 0 && (
                  <p className="text-xs" style={{ color: '#EF4444' }}>Fiado: {formatCurrency(store.cliente.saldo_fiado)}</p>
                )}
              </div>
              <button onClick={() => store.setCliente(null)}>
                <X size={14} style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCliente(true)}
              className="w-full flex items-center gap-2 text-sm py-2 px-3 rounded-xl transition-colors hover:bg-white/5"
              style={{ color: 'var(--text-secondary)', border: '1px dashed var(--border)' }}>
              <User size={14} />
              Vincular cliente (opcional)
            </button>
          )}
        </div>

        {/* Itens */}
        <div className="flex-1 overflow-y-auto scroll-area px-4 py-2">
          {store.itens.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-sm" style={{ color: 'var(--text-secondary)' }}>
              <ShoppingCart size={40} className="mb-3 opacity-20" />
              <p>Carrinho vazio</p>
              <p className="text-xs mt-1">Clique num produto ou escaneie o código</p>
            </div>
          ) : (
            <div className="space-y-2">
              {store.itens.map(item => (
                <div key={item.id} className="p-3 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.nome}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {formatCurrency(item.preco_unitario)} / un
                      </p>
                    </div>
                    <button onClick={() => store.removeItem(item.id)}>
                      <Trash2 size={14} style={{ color: '#EF4444' }} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => store.updateQuantidade(item.id, item.quantidade - 1)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
                        style={{ border: '1px solid var(--border)' }}>
                        <Minus size={12} />
                      </button>
                      <span className="text-sm font-mono w-8 text-center">{item.quantidade}</span>
                      <button
                        onClick={() => store.updateQuantidade(item.id, item.quantidade + 1)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
                        style={{ border: '1px solid var(--border)' }}>
                        <Plus size={12} />
                      </button>
                    </div>
                    <span className="text-sm font-bold">{formatCurrency(item.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totais e finalizar */}
        <div className="flex-shrink-0 p-4 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
          {/* Desconto global */}
          <div className="flex items-center gap-2">
            <Tag size={14} style={{ color: 'var(--text-secondary)' }} />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Desconto global</span>
            <div className="flex-1 flex items-center gap-1 ml-auto">
              <input
                type="number"
                value={store.desconto_global || ''}
                onChange={e => store.setDescontoGlobal(Number(e.target.value))}
                placeholder="0"
                min={0} max={100}
                className="w-14 text-right text-sm px-2 py-1 rounded-lg"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
              <Percent size={12} style={{ color: 'var(--text-secondary)' }} />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
              <span>{formatCurrency(store.subtotal())}</span>
            </div>
            {store.desconto_global > 0 && (
              <div className="flex justify-between text-sm">
                <span style={{ color: '#EF4444' }}>Desconto ({store.desconto_global}%)</span>
                <span style={{ color: '#EF4444' }}>-{formatCurrency(store.subtotal() - store.total())}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-1" style={{ borderTop: '1px solid var(--border)' }}>
              <span>Total</span>
              <span style={{ color: '#F5A623' }}>{formatCurrency(store.total())}</span>
            </div>
          </div>

          <button
            onClick={() => store.itens.length > 0 && setShowPagamento(true)}
            disabled={store.itens.length === 0}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: '#F5A623', color: '#000' }}>
            <CreditCard size={16} />
            Finalizar Venda
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Modal: seleção de unidade */}
      {selectingUnidade && (
        <Modal title={`Selecionar unidade — ${selectingUnidade.produto.nome}`} onClose={() => setSelectingUnidade(null)}>
          <div className="space-y-2">
            {selectingUnidade.unidades.map(u => (
              <button key={u.id}
                onClick={() => selecionarUnidade(selectingUnidade.produto, u)}
                className="w-full flex items-center justify-between p-4 rounded-xl transition-colors hover:bg-white/5"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <div>
                  <div className="font-medium text-sm capitalize">{u.tipo}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {u.quantidade_base > 1 ? `${u.quantidade_base} unidades` : 'Unidade simples'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold" style={{ color: '#F5A623' }}>{formatCurrency(u.preco_venda)}</div>
                </div>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Modal: vincular cliente */}
      {showCliente && (
        <Modal title="Vincular Cliente" onClose={() => { setShowCliente(false); setBuscaCliente(''); setClientes([]) }}>
          <input
            autoFocus
            value={buscaCliente}
            onChange={e => { setBuscaCliente(e.target.value); buscarClientes(e.target.value) }}
            placeholder="Buscar por nome, telefone ou CPF..."
            className="w-full px-4 py-3 rounded-xl text-sm"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
          <div className="mt-3 space-y-2">
            {clientes.map(c => (
              <button key={c.id}
                onClick={() => { store.setCliente(c); setShowCliente(false); setBuscaCliente(''); setClientes([]) }}
                className="w-full flex items-center gap-3 p-3 rounded-xl transition-colors hover:bg-white/5"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
                  style={{ background: '#F5A62320', color: '#F5A623' }}>
                  {c.nome[0]}
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium">{c.nome}</div>
                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {c.telefone} {c.saldo_fiado > 0 ? `• Fiado: ${formatCurrency(c.saldo_fiado)}` : ''}
                  </div>
                </div>
              </button>
            ))}
            {buscaCliente && clientes.length === 0 && (
              <p className="text-sm text-center py-4" style={{ color: 'var(--text-secondary)' }}>Nenhum cliente encontrado</p>
            )}
          </div>
        </Modal>
      )}

      {/* Modal: pagamento */}
      {showPagamento && (
        <PagamentoModal
          total={store.total()}
          cliente={store.cliente}
          itens={store.itens}
          descontoGlobal={store.desconto_global}
          observacao={store.observacao}
          onSetObservacao={store.setObservacao}
          onClose={() => setShowPagamento(false)}
          onSuccess={(resultado: any) => {
            setShowPagamento(false)
            store.limpar()
            toast.success(`Venda #${resultado.numero} finalizada!`)
          }}
        />
      )}
    </div>
  )
}

// Modal de Pagamento
function PagamentoModal({ total, cliente, itens, descontoGlobal, observacao, onSetObservacao, onClose, onSuccess }: any) {
  const [forma, setForma] = useState<FormaPagamento>('dinheiro')
  const [forma2, setForma2] = useState<FormaPagamento | ''>('')
  const [valorPago, setValorPago] = useState('')
  const [valor2, setValor2] = useState('')
  const [loading, setLoading] = useState(false)
  const [qrCode, setQrCode] = useState('')

  useEffect(() => {
    if (forma === 'pix') gerarQR()
  }, [forma])

  async function gerarQR() {
    try {
      const config = window.api ? await window.api.config.get() : {}
      const chavePix = config.loja_chave_pix || '00000000000'
      const qr = await QRCode.toDataURL(chavePix, { width: 200, margin: 2 })
      setQrCode(qr)
    } catch {}
  }

  const troco = forma === 'dinheiro' && valorPago
    ? Math.max(0, parseFloat(valorPago) - total) : 0

  async function finalizar() {
    if (forma === 'fiado' && !cliente) {
      toast.error('Selecione um cliente para venda fiado')
      return
    }

    setLoading(true)
    try {
      const pedidoData = {
        cliente_id: cliente?.id || null,
        cliente_nome: cliente?.nome || null,
        cliente_telefone: cliente?.telefone || null,
        origem: 'balcao',
        forma_pagamento: forma,
        forma_pagamento2: forma2 || null,
        valor_pago: parseFloat(valorPago) || total,
        valor_pago2: parseFloat(valor2) || null,
        subtotal: total / (1 - descontoGlobal / 100),
        desconto: descontoGlobal,
        taxa_entrega: 0,
        total,
        troco,
        observacao: observacao || null,
        itens: itens.map((i: any) => ({
          produto_id: i.produto_id,
          produto_unidade_id: i.produto_unidade_id,
          nome: i.nome,
          tipo: i.tipo,
          quantidade: i.quantidade,
          preco_unitario: i.preco_unitario,
          desconto: i.desconto,
          total: i.total,
        })),
      }

      if (!window.api) {
        toast.success('Venda simulada (modo dev)')
        onSuccess({ numero: '000001', token: 'TOKEN123' })
        return
      }

      const resultado = await window.api.pedidos.create(pedidoData)
      onSuccess(resultado)
    } catch (err) {
      toast.error('Erro ao finalizar venda')
    } finally {
      setLoading(false)
    }
  }

  const FORMAS = [
    { id: 'dinheiro', icon: Banknote, label: 'Dinheiro' },
    { id: 'pix', icon: Smartphone, label: 'PIX' },
    { id: 'debito', icon: CreditCard, label: 'Débito' },
    { id: 'credito', icon: CreditCard, label: 'Crédito' },
    { id: 'fiado', icon: User, label: 'Fiado' },
    { id: 'misto', icon: CreditCard, label: 'Misto' },
  ] as const

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-lg rounded-2xl p-6 animate-in" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold">Pagamento</h2>
            <p className="text-2xl font-bold mt-1" style={{ color: '#F5A623' }}>{formatCurrency(total)}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        {/* Formas de pagamento */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {FORMAS.map(f => {
            const Icon = f.icon
            const active = forma === f.id
            return (
              <button key={f.id} onClick={() => setForma(f.id as FormaPagamento)}
                className="flex flex-col items-center gap-1 p-3 rounded-xl text-xs font-medium transition-colors"
                style={{
                  background: active ? '#F5A62320' : 'var(--bg)',
                  border: `1px solid ${active ? '#F5A623' : 'var(--border)'}`,
                  color: active ? '#F5A623' : 'var(--text-secondary)',
                }}>
                <Icon size={18} />
                {f.label}
              </button>
            )
          })}
        </div>

        {/* Conteúdo por forma */}
        {forma === 'dinheiro' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>VALOR RECEBIDO</label>
              <input
                autoFocus
                type="number"
                value={valorPago}
                onChange={e => setValorPago(e.target.value)}
                placeholder={formatCurrency(total)}
                className="w-full px-4 py-3 rounded-xl text-lg font-bold text-right"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[total, Math.ceil(total / 10) * 10, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100].map(v => (
                <button key={v} onClick={() => setValorPago(String(v.toFixed(2)))}
                  className="py-2 rounded-xl text-xs font-medium transition-colors hover:bg-white/10"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                  {formatCurrency(v)}
                </button>
              ))}
            </div>
            {troco > 0 && (
              <div className="p-3 rounded-xl text-center font-bold" style={{ background: '#22C55E20', color: '#22C55E' }}>
                Troco: {formatCurrency(troco)}
              </div>
            )}
          </div>
        )}

        {forma === 'pix' && (
          <div className="text-center space-y-3">
            {qrCode && <img src={qrCode} alt="QR PIX" className="mx-auto w-36 h-36 rounded-xl" />}
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Aguardando pagamento via PIX</p>
            <p className="text-lg font-bold" style={{ color: '#F5A623' }}>{formatCurrency(total)}</p>
          </div>
        )}

        {forma === 'fiado' && (
          <div className="p-3 rounded-xl text-sm" style={{ background: '#F5A62310', border: '1px solid #F5A62330' }}>
            {cliente ? (
              <p>Lançar R$ {total.toFixed(2)} no fiado de <strong>{cliente.nome}</strong></p>
            ) : (
              <p style={{ color: '#F5A623' }}>⚠️ Selecione um cliente para venda fiado</p>
            )}
          </div>
        )}

        {/* Observação */}
        <input
          value={observacao}
          onChange={e => onSetObservacao(e.target.value)}
          placeholder="Observação (opcional)..."
          className="w-full mt-3 px-3 py-2 rounded-xl text-sm"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />

        <button
          onClick={finalizar}
          disabled={loading}
          className="w-full mt-4 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: '#22C55E', color: '#fff' }}>
          {loading ? 'Processando...' : '✓ Confirmar Venda'}
        </button>
      </div>
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-md rounded-2xl p-6 animate-in" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// Mock data para modo dev
const mockProdutos = [
  { id: 1, nome: 'Brahma 600ml', marca: 'Ambev', ean: '7891149100102', categoria_nome: 'Cervejas', saldo_estoque: 48, preco_venda: 7.5 },
  { id: 2, nome: 'Skol Lata 350ml', marca: 'Ambev', ean: '7891149101109', categoria_nome: 'Cervejas', saldo_estoque: 120, preco_venda: 4.0 },
  { id: 3, nome: 'Heineken Long Neck', marca: 'Heineken', ean: '8711000015902', categoria_nome: 'Cervejas', saldo_estoque: 24, preco_venda: 9.9 },
  { id: 4, nome: 'Coca-Cola 2L', marca: 'Coca-Cola', ean: '7894900011517', categoria_nome: 'Refrigerantes', saldo_estoque: 36, preco_venda: 9.5 },
  { id: 5, nome: 'Água Crystal 500ml', marca: 'Crystal', ean: '7896011100017', categoria_nome: 'Águas', saldo_estoque: 200, preco_venda: 2.5 },
  { id: 6, nome: 'Whisky Jack Daniels', marca: 'Jack Daniels', ean: '0082184090450', categoria_nome: 'Destilados', saldo_estoque: 8, preco_venda: 119.9 },
]
const mockCategorias = [
  { id: 1, nome: 'Cervejas' }, { id: 2, nome: 'Refrigerantes' },
  { id: 3, nome: 'Águas' }, { id: 4, nome: 'Destilados' },
]
const mockClientes = [
  { id: 1, nome: 'João Silva', telefone: '(11) 99999-0001', saldo_fiado: 45 },
  { id: 2, nome: 'Maria Santos', telefone: '(11) 99999-0002', saldo_fiado: 0 },
]
