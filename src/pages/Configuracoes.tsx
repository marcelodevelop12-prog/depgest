import { useEffect, useState, useRef } from 'react'
import { Store, Printer, Palette, Shield, Download, Upload, Key, Info, Check, Save, Camera } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAppStore } from '../store/app'

type Aba = 'loja' | 'impressora' | 'tema' | 'licenca' | 'backup'

export default function Configuracoes() {
  const [aba, setAba] = useState<Aba>('loja')
  const { tema, setTema } = useAppStore()
  const [loja, setLoja] = useState({
    loja_nome: '', loja_cnpj: '', loja_telefone: '',
    loja_endereco: '', loja_chave_pix: '', loja_codigo: '',
    loja_logo_url: '', loja_tempo_entrega: '', loja_tempo_retirada: '',
    loja_formas_pagamento: [] as string[],
  })
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [impressora, setImpressora] = useState({
    impressora: '', largura_impressora: '80', rodape_cupom: 'Obrigado pela preferência!',
  })
  const [licenca, setLicenca] = useState<any>(null)
  const [version, setVersion] = useState('1.0.0')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    if (!window.api) {
      setLoja({ loja_nome: 'Depósito Demo', loja_cnpj: '', loja_telefone: '', loja_endereco: '', loja_chave_pix: '', loja_codigo: 'demo' })
      return
    }
    const [cfg, lic, ver] = await Promise.all([
      window.api.config.get(),
      window.api.licenca.get(),
      window.api.system.getVersion(),
    ])

    let formasParsed: string[] = []
    try { formasParsed = JSON.parse(cfg.loja_formas_pagamento || '[]') } catch { formasParsed = [] }

    setLoja({
      loja_nome: cfg.loja_nome || '',
      loja_cnpj: cfg.loja_cnpj || '',
      loja_telefone: cfg.loja_telefone || '',
      loja_endereco: cfg.loja_endereco || '',
      loja_chave_pix: cfg.loja_chave_pix || '',
      loja_codigo: cfg.loja_codigo || '',
      loja_logo_url: cfg.loja_logo_url || '',
      loja_tempo_entrega: cfg.loja_tempo_entrega || '',
      loja_tempo_retirada: cfg.loja_tempo_retirada || '',
      loja_formas_pagamento: formasParsed,
    })
    setImpressora({
      impressora: cfg.impressora || '',
      largura_impressora: cfg.largura_impressora || '80',
      rodape_cupom: cfg.rodape_cupom || 'Obrigado pela preferência!',
    })
    setLicenca(lic)
    setVersion(ver)
  }

  async function salvarLoja() {
    setSaving(true)
    try {
      if (window.api) {
        const payload = {
          ...loja,
          loja_formas_pagamento: JSON.stringify(loja.loja_formas_pagamento),
        }
        await window.api.config.saveLoja({
          nome: loja.loja_nome,
          cnpj: loja.loja_cnpj,
          telefone: loja.loja_telefone,
          endereco: loja.loja_endereco,
          chave_pix: loja.loja_chave_pix,
          codigo: loja.loja_codigo,
          logo_url: loja.loja_logo_url,
          tempo_entrega: loja.loja_tempo_entrega,
          tempo_retirada: loja.loja_tempo_retirada,
          formas_pagamento: JSON.stringify(loja.loja_formas_pagamento),
        })
        await window.api.config.save(payload)
      }
      toast.success('Dados da loja salvos!')
    } catch { toast.error('Erro ao salvar') }
    finally { setSaving(false) }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !window.api) return
    setUploadingLogo(true)
    try {
      const url = await window.api.config.uploadLogo(file.path)
      setLoja(d => ({ ...d, loja_logo_url: url }))
      toast.success('Logo enviado!')
    } catch { toast.error('Erro ao enviar logo') }
    finally { setUploadingLogo(false) }
  }

  function toggleFormaPagamento(forma: string) {
    setLoja(d => ({
      ...d,
      loja_formas_pagamento: d.loja_formas_pagamento.includes(forma)
        ? d.loja_formas_pagamento.filter(f => f !== forma)
        : [...d.loja_formas_pagamento, forma],
    }))
  }

  async function salvarImpressora() {
    setSaving(true)
    try {
      if (window.api) await window.api.config.save(impressora)
      toast.success('Configuração de impressora salva!')
    } catch { toast.error('Erro ao salvar') }
    finally { setSaving(false) }
  }

  async function testarImpressora() {
    toast.success('Teste de impressão enviado!')
  }

  async function fazerBackup() {
    if (!window.api) { toast.success('Backup simulado (mock)'); return }
    const result = await window.api.system.saveDialog({
      title: 'Salvar backup',
      defaultPath: `depgest-backup-${new Date().toISOString().split('T')[0]}.zip`,
      filters: [{ name: 'Backup DepGest', extensions: ['zip'] }],
    })
    if (!result.canceled && result.filePath) {
      const ok = await window.api.config.backup(result.filePath)
      if (ok) toast.success('Backup criado com sucesso!')
    }
  }

  async function restaurarBackup() {
    if (!window.api) { toast.success('Restaurar (mock)'); return }
    const result = await window.api.system.openDialog({
      title: 'Selecionar backup',
      filters: [{ name: 'Backup DepGest', extensions: ['zip'] }],
      properties: ['openFile'],
    })
    if (!result.canceled && result.filePaths[0]) {
      const ok = await window.api.config.restore(result.filePaths[0])
      if (ok) toast.success('Backup restaurado! Reinicie o sistema.')
    }
  }

  async function alterarTema(novoTema: 'dark' | 'light') {
    setTema(novoTema)
    if (window.api) await window.api.config.save({ tema: novoTema })
    toast.success(`Tema ${novoTema === 'dark' ? 'escuro' : 'claro'} ativado!`)
  }

  const abas = [
    { id: 'loja', icon: Store, label: 'Dados da Loja' },
    { id: 'impressora', icon: Printer, label: 'Impressora' },
    { id: 'tema', icon: Palette, label: 'Tema' },
    { id: 'licenca', icon: Shield, label: 'Licença' },
    { id: 'backup', icon: Download, label: 'Backup' },
  ] as { id: Aba; icon: any; label: string }[]

  return (
    <div className="h-full flex overflow-hidden">
      {/* Sidebar de abas */}
      <div className="w-52 flex-shrink-0 py-4 px-3" style={{ borderRight: '1px solid var(--border)' }}>
        <p className="text-xs font-medium px-2 mb-3" style={{ color: 'var(--text-secondary)' }}>CONFIGURAÇÕES</p>
        {abas.map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setAba(t.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors mb-1"
              style={{
                background: aba === t.id ? '#F5A62318' : 'transparent',
                color: aba === t.id ? '#F5A623' : 'var(--text-secondary)',
                borderRight: aba === t.id ? '2px solid #F5A623' : '2px solid transparent',
              }}>
              <Icon size={16} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto scroll-area p-8">
        {/* Dados da Loja */}
        {aba === 'loja' && (
          <div className="max-w-lg space-y-5">
            <div>
              <h2 className="text-lg font-bold">Dados da Loja</h2>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Informações públicas do seu depósito</p>
            </div>

            {([
              { key: 'loja_nome', label: 'Nome da Loja' },
              { key: 'loja_cnpj', label: 'CNPJ' },
              { key: 'loja_telefone', label: 'Telefone / WhatsApp' },
              { key: 'loja_endereco', label: 'Endereço completo' },
              { key: 'loja_chave_pix', label: 'Chave PIX' },
              { key: 'loja_codigo', label: 'Código do cardápio online', hint: 'Usado na URL: /loja/SEU-CODIGO' },
            ] as { key: string; label: string; hint?: string }[]).map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{f.label}</label>
                <input value={(loja as any)[f.key]} onChange={e => setLoja(d => ({ ...d, [f.key]: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl text-sm"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                {f.hint && <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{f.hint}</p>}
              </div>
            ))}

            {/* Logo da loja */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>LOGO DA LOJA</label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
                  style={{ border: '2px solid #F5A623', background: 'var(--card)' }}>
                  {loja.loja_logo_url
                    ? <img src={loja.loja_logo_url} className="w-full h-full object-cover" />
                    : <Camera size={20} style={{ color: 'var(--text-secondary)' }} />
                  }
                </div>
                <div className="flex-1 space-y-2">
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  <button onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-colors"
                    style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', background: 'var(--card)' }}>
                    <Camera size={13} />
                    {uploadingLogo ? 'Enviando...' : 'Escolher imagem'}
                  </button>
                  {loja.loja_logo_url && (
                    <input value={loja.loja_logo_url} readOnly
                      className="w-full px-3 py-1.5 rounded-lg text-xs font-mono truncate"
                      style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }} />
                  )}
                </div>
              </div>
            </div>

            {/* Tempos de entrega / retirada */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>TEMPO DE ENTREGA</label>
                <input value={loja.loja_tempo_entrega}
                  onChange={e => setLoja(d => ({ ...d, loja_tempo_entrega: e.target.value }))}
                  placeholder="ex: 60-90 min"
                  className="w-full px-4 py-3 rounded-xl text-sm"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>TEMPO DE RETIRADA</label>
                <input value={loja.loja_tempo_retirada}
                  onChange={e => setLoja(d => ({ ...d, loja_tempo_retirada: e.target.value }))}
                  placeholder="ex: 30-40 min"
                  className="w-full px-4 py-3 rounded-xl text-sm"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
              </div>
            </div>

            {/* Formas de pagamento */}
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>FORMAS DE PAGAMENTO ACEITAS</label>
              <div className="flex gap-3">
                {['PIX', 'Cartão', 'Dinheiro'].map(forma => {
                  const ativa = loja.loja_formas_pagamento.includes(forma)
                  return (
                    <button key={forma} onClick={() => toggleFormaPagamento(forma)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                      style={{
                        background: ativa ? '#F5A62318' : 'var(--card)',
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

            <button onClick={salvarLoja} disabled={saving}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold"
              style={{ background: '#F5A623', color: '#000' }}>
              <Save size={15} />
              {saving ? 'Salvando...' : 'Salvar Dados da Loja'}
            </button>
          </div>
        )}

        {/* Impressora */}
        {aba === 'impressora' && (
          <div className="max-w-lg space-y-5">
            <div>
              <h2 className="text-lg font-bold">Impressora Térmica</h2>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Configuração para cupons fiscais e pedidos</p>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>LARGURA DO PAPEL</label>
              <div className="flex gap-3">
                {['58', '80'].map(w => (
                  <button key={w} onClick={() => setImpressora(d => ({ ...d, largura_impressora: w }))}
                    className="flex-1 py-3 rounded-xl text-sm font-medium transition-colors"
                    style={{
                      background: impressora.largura_impressora === w ? '#F5A62320' : 'var(--card)',
                      border: `1px solid ${impressora.largura_impressora === w ? '#F5A623' : 'var(--border)'}`,
                      color: impressora.largura_impressora === w ? '#F5A623' : 'var(--text-secondary)',
                    }}>
                    {w}mm
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>NOME DA IMPRESSORA</label>
              <input value={impressora.impressora} onChange={e => setImpressora(d => ({ ...d, impressora: e.target.value }))}
                placeholder="Deixe em branco para impressora padrão"
                className="w-full px-4 py-3 rounded-xl text-sm"
                style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>RODAPÉ DO CUPOM</label>
              <input value={impressora.rodape_cupom} onChange={e => setImpressora(d => ({ ...d, rodape_cupom: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl text-sm"
                style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>

            <div className="flex gap-3">
              <button onClick={testarImpressora}
                className="px-4 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-white/10"
                style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                <Printer size={14} className="inline mr-2" />Teste
              </button>
              <button onClick={salvarImpressora} disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: '#F5A623', color: '#000' }}>
                <Save size={14} />{saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        )}

        {/* Tema */}
        {aba === 'tema' && (
          <div className="max-w-lg space-y-5">
            <div>
              <h2 className="text-lg font-bold">Tema do Sistema</h2>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Aparência da interface</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => alterarTema('dark')}
                className="p-5 rounded-2xl text-left transition-all hover:scale-[1.02]"
                style={{ background: '#0D0D0D', border: `2px solid ${tema === 'dark' ? '#F5A623' : '#2A2A2A'}` }}>
                <div className="h-20 rounded-xl mb-4 p-3 flex flex-col gap-2" style={{ background: '#141414' }}>
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                  </div>
                  <div className="flex gap-2">
                    <div className="w-8 h-12 rounded-lg" style={{ background: '#1A1A1A' }} />
                    <div className="flex-1 space-y-1">
                      <div className="h-2 w-16 rounded-full" style={{ background: '#F5A623' }} />
                      <div className="h-2 w-12 rounded-full" style={{ background: '#333' }} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Escuro</p>
                    <p className="text-xs" style={{ color: '#888' }}>Recomendado para depósitos</p>
                  </div>
                  {tema === 'dark' && <Check size={16} style={{ color: '#F5A623' }} />}
                </div>
              </button>

              <button onClick={() => alterarTema('light')}
                className="p-5 rounded-2xl text-left transition-all hover:scale-[1.02]"
                style={{ background: '#F5F5F5', border: `2px solid ${tema === 'light' ? '#F5A623' : '#D5D5D5'}` }}>
                <div className="h-20 rounded-xl mb-4 p-3 flex flex-col gap-2" style={{ background: '#FFFFFF', border: '1px solid #E5E5E5' }}>
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <div className="w-2 h-2 rounded-full bg-yellow-400" />
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                  </div>
                  <div className="flex gap-2">
                    <div className="w-8 h-12 rounded-lg" style={{ background: '#EBEBEB' }} />
                    <div className="flex-1 space-y-1">
                      <div className="h-2 w-16 rounded-full" style={{ background: '#F5A623' }} />
                      <div className="h-2 w-12 rounded-full" style={{ background: '#DDD' }} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Claro</p>
                    <p className="text-xs text-gray-500">Para ambientes iluminados</p>
                  </div>
                  {tema === 'light' && <Check size={16} style={{ color: '#F5A623' }} />}
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Licença */}
        {aba === 'licenca' && (
          <div className="max-w-lg space-y-5">
            <div>
              <h2 className="text-lg font-bold">Informações da Licença</h2>
            </div>

            <div className="rounded-2xl p-6 space-y-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl" style={{ background: '#22C55E20' }}>
                  <Shield size={20} style={{ color: '#22C55E' }} />
                </div>
                <div>
                  <p className="font-semibold">Licença Ativa</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {licenca?.data_expiracao ? `Válida até ${licenca.data_expiracao}` : 'Licença Vitalícia'}
                  </p>
                </div>
              </div>

              {[
                { label: 'Chave', value: licenca?.chave || 'DEP-XXXX-XXXX-XXXX' },
                { label: 'Titular', value: licenca?.nome_titular || '—' },
                { label: 'CNPJ', value: licenca?.cnpj || '—' },
                { label: 'Ativação', value: licenca?.data_ativacao ? new Date(licenca.data_ativacao).toLocaleDateString('pt-BR') : '—' },
                { label: 'Machine ID', value: licenca?.machine_id?.slice(0, 24) + '...' || '—' },
              ].map(f => (
                <div key={f.label} className="flex items-center gap-4 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span className="text-xs w-24 flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>{f.label}</span>
                  <span className="text-sm font-mono">{f.value}</span>
                </div>
              ))}
            </div>

            <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <Info size={16} style={{ color: 'var(--text-secondary)', marginTop: 2 }} />
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                <p className="font-medium mb-1">Versão do Sistema</p>
                <p>DepGest v{version}</p>
              </div>
            </div>
          </div>
        )}

        {/* Backup */}
        {aba === 'backup' && (
          <div className="max-w-lg space-y-5">
            <div>
              <h2 className="text-lg font-bold">Backup e Restauração</h2>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Proteja os dados do seu depósito</p>
            </div>

            <div className="rounded-2xl p-6 space-y-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <div className="text-sm space-y-2" style={{ color: 'var(--text-secondary)' }}>
                <p>O backup inclui:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Banco de dados completo (todos os pedidos, clientes, produtos)</li>
                  <li>Fotos dos produtos</li>
                  <li>Configurações do sistema</li>
                </ul>
              </div>

              <button onClick={fazerBackup}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm"
                style={{ background: '#F5A623', color: '#000' }}>
                <Download size={16} />
                Fazer Backup Agora
              </button>
            </div>

            <div className="rounded-2xl p-6 space-y-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <div className="text-sm space-y-2" style={{ color: 'var(--text-secondary)' }}>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Restaurar Backup</p>
                <p>Selecione um arquivo .zip de backup criado anteriormente pelo DepGest.</p>
                <p className="text-xs" style={{ color: '#EF4444' }}>⚠️ A restauração substitui todos os dados atuais!</p>
              </div>

              <button onClick={restaurarBackup}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-colors hover:bg-white/10"
                style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                <Upload size={16} />
                Restaurar do Backup
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
