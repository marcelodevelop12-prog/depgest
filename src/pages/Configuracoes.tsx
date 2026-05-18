import { useEffect, useState } from 'react'
import { Store, Printer, Palette, Shield, Download, Upload, Key, Info, Check, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAppStore } from '../store/app'

type Aba = 'loja' | 'impressora' | 'tema' | 'licenca' | 'backup'

export default function Configuracoes() {
  const [aba, setAba] = useState<Aba>('loja')
  const { tema, setTema } = useAppStore()
  const [loja, setLoja] = useState({
    loja_nome: '', loja_cnpj: '', loja_telefone: '',
    loja_endereco: '', loja_chave_pix: '', loja_codigo: '',
  })
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

    setLoja({
      loja_nome: cfg.loja_nome || '',
      loja_cnpj: cfg.loja_cnpj || '',
      loja_telefone: cfg.loja_telefone || '',
      loja_endereco: cfg.loja_endereco || '',
      loja_chave_pix: cfg.loja_chave_pix || '',
      loja_codigo: cfg.loja_codigo || '',
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
        await window.api.config.saveLoja({
          nome: loja.loja_nome,
          cnpj: loja.loja_cnpj,
          telefone: loja.loja_telefone,
          endereco: loja.loja_endereco,
          chave_pix: loja.loja_chave_pix,
          codigo: loja.loja_codigo,
        })
        await window.api.config.save(loja)
      }
      toast.success('Dados da loja salvos!')
    } catch { toast.error('Erro ao salvar') }
    finally { setSaving(false) }
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
              {/* Wordmark */}
              <div className="text-center pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
                <p className="font-bold leading-none" style={{ fontSize: 28 }}>
                  <span style={{ color: '#FFFFFF' }}>Dep</span><span style={{ color: '#F5A623' }}>Gest</span>
                </p>
                <p className="mt-1 font-medium uppercase tracking-widest"
                  style={{ fontSize: 10, letterSpacing: 3, color: '#888888' }}>
                  Sistema de Gestão
                </p>
              </div>

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

              <p className="text-center pt-2" style={{ fontSize: 11, color: '#555555' }}>
                Desenvolvido por Agência Converte Bot
              </p>
            </div>

            <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <Info size={16} style={{ color: 'var(--text-secondary)', marginTop: 2 }} />
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                <p className="font-medium mb-1">Versão do Sistema</p>
                <p>DepGest v{version}</p>
              </div>
            </div>

            <button
              onClick={() => {
                const msg = encodeURIComponent('Olá! Tenho o DepGest e quero adquirir mais licenças com desconto.')
                const url = `https://wa.me/5521992791713?text=${msg}`
                if (window.api) window.api.system.openExternal(url)
                else window.open(url, '_blank')
              }}
              className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl font-semibold text-sm text-white transition-opacity hover:opacity-90"
              style={{ background: '#25D366' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Precisa de mais licenças? 30% de desconto
            </button>
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
