import { useEffect, useState, useRef } from 'react'
import { Globe, Power, RefreshCw, ExternalLink, Package, Clock, DollarSign, Truck, ShoppingBag, AlertCircle, Camera, Check, Pencil, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency } from '../lib/utils'

export default function Cardapio() {
  const [ativo, setAtivo] = useState(false)
  const [codigoLoja, setCodigoLoja] = useState('')
  const [produtos, setProdutos] = useState<any[]>([])
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set())
  const [syncing, setSyncing] = useState(false)
  const [config, setConfig] = useState({
    taxa_entrega: '0', pedido_minimo: '0', raio_entrega_km: '5',
    horario_abertura: '08:00', horario_fechamento: '22:00',
  })
  const [lojaExtra, setLojaExtra] = useState({
    logo_url: '', tempo_entrega: '', tempo_retirada: '',
    formas_pagamento: [] as string[],
  })
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [pedidosOnline, setPedidosOnline] = useState<any[]>([])
  const [aba, setAba] = useState<'config' | 'produtos' | 'pedidos'>('config')

  // Modal de edição por produto
  const [editProduto, setEditProduto] = useState<any>(null)
  const [editDescricao, setEditDescricao] = useState('')
  const [editFotoPath, setEditFotoPath] = useState('')
  const [editFotoPreview, setEditFotoPreview] = useState('')
  const [savingProduto, setSavingProduto] = useState(false)
  const produtoFotoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadConfig()
    loadProdutos()
    loadPedidosOnline()

    // Listener de pedido online novo (notificação realtime do main process)
    if (window.api) {
      window.api.cardapio.onPedidoNovo(() => {
        loadPedidosOnline()
        toast('Novo pedido online recebido!', { icon: '🛒' })
      })
    }
  }, [])

  async function loadConfig() {
    if (!window.api) {
      setCodigoLoja('depjoao')
      setAtivo(false)
      return
    }
    const cfg = await window.api.config.get()
    setCodigoLoja(cfg.loja_codigo || '')
    setAtivo(cfg.loja_cardapio_ativo === 'true')
    setConfig({
      taxa_entrega: cfg.loja_taxa_entrega || '0',
      pedido_minimo: cfg.loja_pedido_minimo || '0',
      raio_entrega_km: cfg.loja_raio_entrega_km || '5',
      horario_abertura: '08:00',
      horario_fechamento: '22:00',
    })
    let formasParsed: string[] = []
    try { formasParsed = JSON.parse(cfg.loja_formas_pagamento || '[]') } catch { formasParsed = [] }
    setLojaExtra({
      logo_url: cfg.loja_logo_url || '',
      tempo_entrega: cfg.loja_tempo_entrega || '',
      tempo_retirada: cfg.loja_tempo_retirada || '',
      formas_pagamento: formasParsed,
    })
  }

  async function loadProdutos() {
    if (!window.api) { setProdutos(mockProdutos); return }
    const result = await window.api.produtos.list({ ativo: true })
    setProdutos(result)
  }

  async function loadPedidosOnline() {
    if (!window.api) { setPedidosOnline([]); return }
    const result = await window.api.pedidos.getOnline()
    setPedidosOnline(result || [])
  }

  async function toggleAtivo() {
    const novoStatus = !ativo
    setAtivo(novoStatus)
    if (window.api) {
      await window.api.config.save({ loja_cardapio_ativo: String(novoStatus) })
      await window.api.config.saveLoja({ cardapio_ativo: novoStatus })
    }
    toast.success(novoStatus ? 'Cardápio online ativado!' : 'Cardápio online desativado')
  }

  async function salvarConfig() {
    if (!window.api) { toast.success('Configuração salva (mock)'); return }
    const formasJson = JSON.stringify(lojaExtra.formas_pagamento)
    await window.api.config.save({
      loja_taxa_entrega: config.taxa_entrega,
      loja_pedido_minimo: config.pedido_minimo,
      loja_raio_entrega_km: config.raio_entrega_km,
      loja_tempo_entrega: lojaExtra.tempo_entrega,
      loja_tempo_retirada: lojaExtra.tempo_retirada,
      loja_formas_pagamento: formasJson,
      loja_logo_url: lojaExtra.logo_url,
    })
    await window.api.config.saveLoja({
      taxa_entrega: parseFloat(config.taxa_entrega),
      pedido_minimo: parseFloat(config.pedido_minimo),
      raio_entrega_km: parseFloat(config.raio_entrega_km),
      tempo_entrega: lojaExtra.tempo_entrega,
      tempo_retirada: lojaExtra.tempo_retirada,
      formas_pagamento: formasJson,
      logo_url: lojaExtra.logo_url,
    })
    toast.success('Configurações salvas!')
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !window.api) return
    setUploadingLogo(true)
    try {
      const url = await window.api.config.uploadLogo((file as any).path)
      setLojaExtra(d => ({ ...d, logo_url: url }))
      toast.success('Logo enviado!')
    } catch { toast.error('Erro ao enviar logo') }
    finally { setUploadingLogo(false) }
  }

  function toggleFormaPagamento(forma: string) {
    setLojaExtra(d => ({
      ...d,
      formas_pagamento: d.formas_pagamento.includes(forma)
        ? d.formas_pagamento.filter(f => f !== forma)
        : [...d.formas_pagamento, forma],
    }))
  }

  async function sincronizar() {
    if (selecionados.size === 0) return
    setSyncing(true)
    try {
      if (window.api) {
        const result = await window.api.cardapio.updateProdutos(Array.from(selecionados))
        if (!result?.ok) throw new Error(result?.erro || 'Falha na sincronização')
      }
      toast.success(`${selecionados.size} produto(s) sincronizados com categorias e preços!`)
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao sincronizar')
    } finally {
      setSyncing(false)
    }
  }

  async function aceitarPedido(pedidoOnlineId: string) {
    if (!window.api) { toast.success('Pedido aceito (mock)'); return }
    const result = await window.api.pedidos.aceitarOnline(pedidoOnlineId)
    if (result.ok) {
      toast.success(`Pedido #${result.numero} criado!`)
      loadPedidosOnline()
    } else {
      toast.error(result.erro || 'Erro ao aceitar pedido')
    }
  }

  function pathToImgSrc(p: string): string {
    // Usa protocolo customizado registrado no main process — sem bloqueio de CSP
    return 'local-image://' + p.replace(/\\/g, '/')
  }

  function abrirEditProduto(e: React.MouseEvent, produto: any) {
    e.stopPropagation()
    setEditProduto(produto)
    setEditDescricao(produto.descricao || '')
    setEditFotoPath('')
    setEditFotoPreview(produto.foto_path ? pathToImgSrc(produto.foto_path) : '')
  }

  function handleProdutoFotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setEditFotoPath((file as any).path || '')
    const reader = new FileReader()
    reader.onload = ev => setEditFotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function salvarProdutoCardapio() {
    if (!editProduto) return
    setSavingProduto(true)
    try {
      // Atualiza descrição localmente
      if (window.api) {
        const r = await window.api.produtos.update(editProduto.id, { ...editProduto, descricao: editDescricao }) as any
        if (r && r.ok === false) throw new Error(r.error || 'Erro ao salvar descrição')
      }

      // Faz upload da foto se o usuário selecionou uma nova
      if (editFotoPath && window.api) {
        const r = await window.api.cardapio.uploadFoto(String(editProduto.id), editFotoPath)
        if (!r?.ok) throw new Error(r?.erro || 'Erro ao enviar foto')
        toast.success('Foto enviada para o cardápio online!')
      }

      toast.success('Produto atualizado!')
      setEditProduto(null)
      loadProdutos()
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar')
    } finally {
      setSavingProduto(false)
    }
  }

  const urlCardapio = `https://vercel-app-lime-alpha.vercel.app/loja/${codigoLoja}`

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Globe size={20} style={{ color: '#F5A623' }} />
              Cardápio Online
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Receba pedidos pela internet
            </p>
          </div>

          <div className="flex items-center gap-3">
            {pedidosOnline.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
                style={{ background: '#F5A62320', color: '#F5A623', border: '1px solid #F5A62340' }}>
                <ShoppingBag size={12} />
                {pedidosOnline.length} pedido(s) aguardando
              </div>
            )}
            <button onClick={toggleAtivo}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
              style={{
                background: ativo ? '#22C55E20' : 'var(--card)',
                color: ativo ? '#22C55E' : 'var(--text-secondary)',
                border: `1px solid ${ativo ? '#22C55E40' : 'var(--border)'}`,
              }}>
              <Power size={15} />
              {ativo ? 'Online' : 'Offline'}
            </button>
          </div>
        </div>

        {/* URL do cardápio */}
        {codigoLoja && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <Globe size={12} style={{ color: 'var(--text-secondary)' }} />
            <span className="flex-1 truncate font-mono" style={{ color: 'var(--text-secondary)' }}>{urlCardapio}</span>
            <button onClick={() => { navigator.clipboard.writeText(urlCardapio); toast.success('Link copiado!') }}
              className="text-xs px-2 py-0.5 rounded-md hover:bg-white/10 transition-colors"
              style={{ color: '#F5A623' }}>
              Copiar
            </button>
            <button onClick={() => window.api?.system.openExternal(urlCardapio)}
              className="hover:text-white transition-colors" style={{ color: 'var(--text-secondary)' }}>
              <ExternalLink size={12} />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {[
            { id: 'config', label: 'Configurações' },
            { id: 'produtos', label: `Produtos (${selecionados.size} selecionados)` },
            { id: 'pedidos', label: `Pedidos Online${pedidosOnline.length > 0 ? ` (${pedidosOnline.length})` : ''}` },
          ].map(t => (
            <button key={t.id} onClick={() => setAba(t.id as any)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: aba === t.id ? '#F5A62320' : 'transparent',
                color: aba === t.id ? '#F5A623' : 'var(--text-secondary)',
                border: `1px solid ${aba === t.id ? '#F5A62340' : 'transparent'}`,
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-area p-6">
        {/* Configurações */}
        {aba === 'config' && (
          <div className="max-w-lg space-y-5">
            {!ativo && (
              <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: '#F5A62310', border: '1px solid #F5A62330' }}>
                <AlertCircle size={16} style={{ color: '#F5A623', marginTop: 2 }} />
                <div className="text-sm">
                  <p className="font-medium" style={{ color: '#F5A623' }}>Cardápio desativado</p>
                  <p style={{ color: 'var(--text-secondary)' }}>Clientes não poderão fazer pedidos enquanto o cardápio estiver offline.</p>
                </div>
              </div>
            )}

            <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <h3 className="font-semibold flex items-center gap-2"><Truck size={16} style={{ color: '#F5A623' }} /> Entrega</h3>
              {[
                { key: 'taxa_entrega', label: 'Taxa de entrega (R$)', placeholder: '0,00', prefix: 'R$' },
                { key: 'pedido_minimo', label: 'Pedido mínimo (R$)', placeholder: '0,00', prefix: 'R$' },
                { key: 'raio_entrega_km', label: 'Raio de entrega (km)', placeholder: '5', prefix: 'km' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>{f.label}</label>
                  <div className="flex items-center gap-2">
                    <input type="number" value={(config as any)[f.key]}
                      onChange={e => setConfig(c => ({ ...c, [f.key]: e.target.value }))}
                      className="flex-1 px-3 py-2.5 rounded-xl text-sm"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{f.prefix}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <h3 className="font-semibold flex items-center gap-2"><Clock size={16} style={{ color: '#F5A623' }} /> Horário de Funcionamento</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Abertura</label>
                  <input type="time" value={config.horario_abertura}
                    onChange={e => setConfig(c => ({ ...c, horario_abertura: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl text-sm"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Fechamento</label>
                  <input type="time" value={config.horario_fechamento}
                    onChange={e => setConfig(c => ({ ...c, horario_fechamento: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl text-sm"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                </div>
              </div>
            </div>

            {/* Logo da loja */}
            <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <h3 className="font-semibold flex items-center gap-2"><Camera size={16} style={{ color: '#F5A623' }} /> Logo da Loja</h3>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
                  style={{ border: '2px solid #F5A623', background: 'var(--bg)' }}>
                  {lojaExtra.logo_url
                    ? <img src={lojaExtra.logo_url} className="w-full h-full object-cover" />
                    : <Camera size={20} style={{ color: 'var(--text-secondary)' }} />
                  }
                </div>
                <div className="flex-1 space-y-2">
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  <button onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-colors"
                    style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', background: 'var(--bg)' }}>
                    <Camera size={13} />
                    {uploadingLogo ? 'Enviando...' : 'Escolher imagem'}
                  </button>
                  {lojaExtra.logo_url && (
                    <p className="text-xs truncate font-mono" style={{ color: 'var(--text-secondary)' }}>{lojaExtra.logo_url}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Tempos de entrega / retirada */}
            <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <h3 className="font-semibold flex items-center gap-2"><Clock size={16} style={{ color: '#F5A623' }} /> Tempos</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Tempo de entrega</label>
                  <input value={lojaExtra.tempo_entrega}
                    onChange={e => setLojaExtra(d => ({ ...d, tempo_entrega: e.target.value }))}
                    placeholder="ex: 60-90 min"
                    className="w-full px-3 py-2.5 rounded-xl text-sm"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Tempo de retirada</label>
                  <input value={lojaExtra.tempo_retirada}
                    onChange={e => setLojaExtra(d => ({ ...d, tempo_retirada: e.target.value }))}
                    placeholder="ex: 30-40 min"
                    className="w-full px-3 py-2.5 rounded-xl text-sm"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                </div>
              </div>
            </div>

            {/* Formas de pagamento */}
            <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <h3 className="font-semibold flex items-center gap-2"><DollarSign size={16} style={{ color: '#F5A623' }} /> Formas de Pagamento Aceitas</h3>
              <div className="flex gap-3">
                {['PIX', 'Cartão', 'Dinheiro'].map(forma => {
                  const ativa = lojaExtra.formas_pagamento.includes(forma)
                  return (
                    <button key={forma} onClick={() => toggleFormaPagamento(forma)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                      style={{
                        background: ativa ? '#F5A62318' : 'var(--bg)',
                        border: `1px solid ${ativa ? '#F5A623' : 'var(--border)'}`,
                        color: ativa ? '#F5A623' : 'var(--text-secondary)',
                      }}>
                      {ativa && <Check size={13} />}
                      {forma}
                    </button>
                  )
                })}
              </div>
            </div>

            <button onClick={salvarConfig}
              className="w-full py-3 rounded-xl font-semibold text-sm"
              style={{ background: '#F5A623', color: '#000' }}>
              Salvar Configurações
            </button>
          </div>
        )}

        {/* Produtos */}
        {aba === 'produtos' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Selecione quais produtos aparecem no cardápio online
                </p>
                <button
                  onClick={() => {
                    if (selecionados.size === produtos.length) {
                      setSelecionados(new Set())
                    } else {
                      setSelecionados(new Set(produtos.map(p => p.id)))
                    }
                  }}
                  className="px-3 py-1 rounded-lg text-xs font-medium"
                  style={{ background: '#F5A62322', border: '1px solid #F5A62366', color: '#F5A623' }}
                >
                  {selecionados.size === produtos.length ? 'Desmarcar tudo' : 'Selecionar tudo'}
                </button>
              </div>
              <button onClick={sincronizar} disabled={syncing || selecionados.size === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
                style={{ background: '#3B82F6', color: '#fff' }}>
                <RefreshCw size={14} className={syncing ? 'spinner' : ''} />
                Sincronizar ({selecionados.size})
              </button>
            </div>

            <div className="space-y-2">
              {produtos.map(p => (
                <div key={p.id}
                  onClick={() => setSelecionados(prev => {
                    const next = new Set(prev)
                    if (next.has(p.id)) next.delete(p.id)
                    else next.add(p.id)
                    return next
                  })}
                  className="flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-colors hover:bg-white/5"
                  style={{
                    background: selecionados.has(p.id) ? '#F5A62310' : 'var(--card)',
                    border: `1px solid ${selecionados.has(p.id) ? '#F5A62340' : 'var(--border)'}`,
                  }}>
                  <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                    style={{
                      background: selecionados.has(p.id) ? '#F5A623' : 'var(--bg)',
                      border: `1px solid ${selecionados.has(p.id) ? '#F5A623' : 'var(--border)'}`,
                    }}>
                    {selecionados.has(p.id) && <span className="text-xs font-bold text-black">✓</span>}
                  </div>
                  {p.foto_path && (
                    <img src={pathToImgSrc(p.foto_path)} className="w-12 h-12 rounded-lg object-cover" />
                  )}
                  {!p.foto_path && (
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg)' }}>
                      <Package size={20} style={{ color: 'var(--text-secondary)' }} />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{p.nome}</p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{p.categoria_nome} {p.marca ? `• ${p.marca}` : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold" style={{ color: '#F5A623' }}>
                      {p.preco_venda ? formatCurrency(p.preco_venda) : '—'}
                    </p>
                    {p.descricao && (
                      <p className="text-xs mt-0.5 max-w-[160px] truncate" style={{ color: 'var(--text-secondary)' }}>{p.descricao}</p>
                    )}
                  </div>
                  <button
                    onClick={e => abrirEditProduto(e, p)}
                    title="Editar foto e descrição do cardápio"
                    className="flex-shrink-0 p-2 rounded-lg transition-colors hover:bg-white/10"
                    style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                    <Pencil size={14} />
                  </button>
                </div>
              ))}

              {produtos.length === 0 && (
                <div className="py-12 text-center" style={{ color: 'var(--text-secondary)' }}>
                  <Package size={40} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Nenhum produto cadastrado</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pedidos Online */}
        {aba === 'pedidos' && (
          <div className="space-y-3">
            {pedidosOnline.length === 0 ? (
              <div className="py-16 text-center" style={{ color: 'var(--text-secondary)' }}>
                <ShoppingBag size={48} className="mx-auto mb-4 opacity-20" />
                <p className="text-sm font-medium">Nenhum pedido aguardando</p>
                <p className="text-xs mt-1">Pedidos online aparecerão aqui em tempo real</p>
              </div>
            ) : (
              pedidosOnline.map((p: any) => (
                <div key={p.id} className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid #F5A62340' }}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold">{p.cliente_nome}</p>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{p.cliente_telefone}</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full status-novo">Novo Online</span>
                  </div>
                  <div className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
                    <p>{p.tipo_entrega === 'entrega' ? `📍 ${p.cliente_endereco}` : '🏪 Retirada no local'}</p>
                    <p className="mt-1">💳 {p.forma_pagamento}</p>
                    {p.observacao && <p className="mt-1">📝 {p.observacao}</p>}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-lg" style={{ color: '#F5A623' }}>
                      {formatCurrency(p.total)}
                    </span>
                    <button onClick={() => aceitarPedido(p.id)}
                      className="px-4 py-2 rounded-xl text-sm font-semibold"
                      style={{ background: '#22C55E', color: '#fff' }}>
                      ✓ Aceitar Pedido
                    </button>
                  </div>
                </div>
              ))
            )}

            <button onClick={loadPedidosOnline}
              className="w-full py-2 rounded-xl text-sm transition-colors hover:bg-white/5"
              style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              <RefreshCw size={14} className="inline mr-2" />
              Atualizar
            </button>
          </div>
        )}
      </div>

      {/* Modal: editar foto e descrição do produto no cardápio */}
      {editProduto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setEditProduto(null)}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-5"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}>

            {/* Cabeçalho */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-base">Editar no Cardápio</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{editProduto.nome}</p>
              </div>
              <button onClick={() => setEditProduto(null)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                style={{ color: 'var(--text-secondary)' }}>
                <X size={16} />
              </button>
            </div>

            {/* Foto */}
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Foto do produto
                <span className="ml-1 font-normal">(aparece no cardápio online)</span>
              </label>
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                  style={{ border: '2px dashed var(--border)', background: 'var(--bg)' }}>
                  {editFotoPreview
                    ? <img src={editFotoPreview} className="w-full h-full object-cover" />
                    : <Camera size={28} style={{ color: 'var(--text-secondary)' }} />
                  }
                </div>
                <div className="flex-1 space-y-2">
                  <input
                    ref={produtoFotoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleProdutoFotoSelect}
                  />
                  <button
                    onClick={() => produtoFotoInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium w-full justify-center transition-colors hover:bg-white/5"
                    style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', background: 'var(--bg)' }}>
                    <Camera size={13} />
                    {editFotoPreview ? 'Trocar foto' : 'Escolher foto'}
                  </button>
                  {editFotoPath && (
                    <p className="text-xs text-center" style={{ color: '#22C55E' }}>✓ Nova foto selecionada</p>
                  )}
                  {!editFotoPath && !editFotoPreview && (
                    <p className="text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
                      Sem foto — aparecerá sem imagem no cardápio
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Descrição
                <span className="ml-1 font-normal">(aparece abaixo do nome no cardápio)</span>
              </label>
              <textarea
                value={editDescricao}
                onChange={e => setEditDescricao(e.target.value)}
                rows={3}
                placeholder="Ex: Gelada, 600ml, long neck..."
                className="w-full px-3 py-2.5 rounded-xl text-sm resize-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
            </div>

            {/* Ações */}
            <div className="flex gap-3 pt-1">
              <button onClick={() => setEditProduto(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-white/5"
                style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                Cancelar
              </button>
              <button onClick={salvarProdutoCardapio} disabled={savingProduto}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{ background: '#F5A623', color: '#000' }}>
                {savingProduto ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const mockProdutos = [
  { id: 1, nome: 'Brahma 600ml', marca: 'Ambev', categoria_nome: 'Cervejas', preco_venda: 7.5 },
  { id: 2, nome: 'Skol Lata 350ml', marca: 'Ambev', categoria_nome: 'Cervejas', preco_venda: 4.0 },
  { id: 3, nome: 'Heineken Long Neck', marca: 'Heineken', categoria_nome: 'Cervejas', preco_venda: 9.9 },
]
