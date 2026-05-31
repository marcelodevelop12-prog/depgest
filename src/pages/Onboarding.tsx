import { useState } from 'react'
import { Store, Phone, MapPin, QrCode, Printer, Palette, Check, ChevronRight, ChevronLeft, Upload } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  onComplete: () => void
}

const STEPS = [
  { icon: Store, title: 'Dados da Loja', desc: 'Nome, CNPJ e informações básicas' },
  { icon: Phone, title: 'Contato', desc: 'Telefone e endereço' },
  { icon: QrCode, title: 'Pagamentos', desc: 'Chave PIX e formas de pagamento' },
  { icon: Printer, title: 'Impressora', desc: 'Configuração da impressora térmica' },
  { icon: Palette, title: 'Tema', desc: 'Aparência do sistema' },
]

export default function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState({
    loja_nome: '', loja_cnpj: '', loja_telefone: '',
    loja_endereco: '', loja_bairro: '', loja_cidade: '',
    loja_chave_pix: '', loja_logo_url: '',
    impressora: '', largura_impressora: '80', rodape_cupom: 'Obrigado pela preferência!',
    tema: 'dark',
  })

  function update(key: string, value: string) {
    setData(d => ({ ...d, [key]: value }))
  }

  function canAdvance(): boolean {
    if (step === 0) return !!data.loja_nome
    return true
  }

  async function finish() {
    if (!data.loja_nome) { toast.error('Informe o nome da loja'); return }

    setLoading(true)
    try {
      if (window.api) {
        await window.api.config.save({
          tema: data.tema,
          impressora: data.impressora,
          largura_impressora: data.largura_impressora,
          rodape_cupom: data.rodape_cupom,
        })
        await window.api.config.saveLoja({
          nome: data.loja_nome,
          cnpj: data.loja_cnpj,
          telefone: data.loja_telefone,
          endereco: [data.loja_endereco, data.loja_bairro, data.loja_cidade].map(s => (s || '').trim()).filter(Boolean).join(', '),
          chave_pix: data.loja_chave_pix,
        })
      }

      // Aplica tema
      if (data.tema === 'light') {
        document.documentElement.classList.add('light')
      }

      toast.success('Configuração concluída!')
      onComplete()
    } catch {
      toast.error('Erro ao salvar configurações')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {window.api && (
        <div className="titlebar-drag h-8 flex items-center px-4" style={{ background: 'var(--sidebar)' }}>
          <span className="text-xs font-semibold" style={{ color: '#F5A623' }}>DepGest — Configuração Inicial</span>
          <div className="ml-auto titlebar-nodrag flex gap-2">
            <button onClick={() => window.api.window.minimize()} className="w-3 h-3 rounded-full bg-yellow-500" />
            <button onClick={() => window.api.window.close()} className="w-3 h-3 rounded-full bg-red-500" />
          </div>
        </div>
      )}

      <div className="flex-1 flex">
        {/* Sidebar com steps */}
        <div className="w-64 flex-shrink-0 p-6 flex flex-col" style={{ background: 'var(--sidebar)', borderRight: '1px solid var(--border)' }}>
          <div className="text-center mb-8">
            <div className="text-2xl font-bold" style={{ color: '#F5A623' }}>DepGest</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Configuração inicial</div>
          </div>

          <div className="space-y-2">
            {STEPS.map((s, i) => {
              const Icon = s.icon
              const done = i < step
              const active = i === step
              return (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${active ? 'bg-[#F5A62320]' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold
                    ${done ? 'bg-green-500' : active ? 'bg-[#F5A623]' : ''}`}
                    style={!done && !active ? { background: 'var(--border)', color: 'var(--text-secondary)' } : { color: '#000' }}>
                    {done ? <Check size={14} /> : active ? <Icon size={14} /> : i + 1}
                  </div>
                  <div>
                    <div className={`text-sm font-medium ${active ? 'text-white' : ''}`}
                      style={!active ? { color: 'var(--text-secondary)' } : {}}>
                      {s.title}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{s.desc}</div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-auto text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
            Estas configurações podem ser<br />alteradas depois em Configurações
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 flex flex-col p-8 overflow-y-auto">
          <div className="flex-1 max-w-lg">
            {step === 0 && (
              <div className="animate-in space-y-5">
                <h2 className="text-2xl font-bold">Dados da Loja</h2>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Como seu depósito será identificado no sistema</p>

                <Field label="Nome da Loja *" placeholder="Ex: Depósito do João" value={data.loja_nome} onChange={v => update('loja_nome', v)} />
                <Field label="CNPJ" placeholder="00.000.000/0000-00" value={data.loja_cnpj} onChange={v => update('loja_cnpj', v)} />
              </div>
            )}

            {step === 1 && (
              <div className="animate-in space-y-5">
                <h2 className="text-2xl font-bold">Contato e Endereço</h2>
                <Field label="Telefone / WhatsApp" placeholder="(11) 99999-9999" value={data.loja_telefone} onChange={v => update('loja_telefone', v)} />
                <Field label="Endereço" placeholder="Rua, número" value={data.loja_endereco} onChange={v => update('loja_endereco', v)} />
                <Field label="Bairro" placeholder="Bairro" value={data.loja_bairro} onChange={v => update('loja_bairro', v)} />
                <Field label="Cidade" placeholder="Cidade" value={data.loja_cidade} onChange={v => update('loja_cidade', v)} />
              </div>
            )}

            {step === 2 && (
              <div className="animate-in space-y-5">
                <h2 className="text-2xl font-bold">Pagamentos</h2>
                <Field label="Chave PIX" placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" value={data.loja_chave_pix} onChange={v => update('loja_chave_pix', v)} />
                <div className="p-4 rounded-xl text-sm" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <p className="font-medium mb-2">Formas de pagamento aceitas:</p>
                  <div className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <p>✓ Dinheiro (com cálculo de troco)</p>
                    <p>✓ PIX (exibe QR Code gerado)</p>
                    <p>✓ Cartão de Débito</p>
                    <p>✓ Cartão de Crédito</p>
                    <p>✓ Fiado (vinculado ao cliente)</p>
                    <p>✓ Pagamento Misto (duas formas)</p>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="animate-in space-y-5">
                <h2 className="text-2xl font-bold">Impressora Térmica</h2>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Opcional — pode configurar depois</p>

                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>LARGURA DO PAPEL</label>
                  <div className="flex gap-3">
                    {['58', '80'].map(w => (
                      <button key={w}
                        onClick={() => update('largura_impressora', w)}
                        className="flex-1 py-3 rounded-xl text-sm font-medium transition-colors"
                        style={{
                          background: data.largura_impressora === w ? '#F5A62320' : 'var(--card)',
                          border: `1px solid ${data.largura_impressora === w ? '#F5A623' : 'var(--border)'}`,
                          color: data.largura_impressora === w ? '#F5A623' : 'var(--text-secondary)',
                        }}>
                        {w}mm
                      </button>
                    ))}
                  </div>
                </div>

                <Field label="Nome da Impressora (opcional)" placeholder="Deixe em branco para impressora padrão" value={data.impressora} onChange={v => update('impressora', v)} />
                <Field label="Rodapé do Cupom" placeholder="Mensagem de agradecimento" value={data.rodape_cupom} onChange={v => update('rodape_cupom', v)} />
              </div>
            )}

            {step === 4 && (
              <div className="animate-in space-y-5">
                <h2 className="text-2xl font-bold">Tema do Sistema</h2>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>O tema escuro é recomendado para depósitos</p>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => update('tema', 'dark')}
                    className="p-4 rounded-xl transition-all"
                    style={{
                      background: '#0D0D0D',
                      border: `2px solid ${data.tema === 'dark' ? '#F5A623' : '#2A2A2A'}`,
                    }}>
                    <div className="h-16 rounded-lg mb-3 flex items-end p-2" style={{ background: '#141414' }}>
                      <div className="w-12 h-2 rounded-full" style={{ background: '#F5A623' }} />
                    </div>
                    <div className="text-sm font-medium text-white text-left">Escuro</div>
                    <div className="text-xs text-gray-500 text-left">Recomendado para depósitos</div>
                  </button>

                  <button
                    onClick={() => update('tema', 'light')}
                    className="p-4 rounded-xl transition-all"
                    style={{
                      background: '#F5F5F5',
                      border: `2px solid ${data.tema === 'light' ? '#F5A623' : '#D5D5D5'}`,
                    }}>
                    <div className="h-16 rounded-lg mb-3 flex items-end p-2" style={{ background: '#FFFFFF', border: '1px solid #E5E5E5' }}>
                      <div className="w-12 h-2 rounded-full" style={{ background: '#F5A623' }} />
                    </div>
                    <div className="text-sm font-medium text-gray-900 text-left">Claro</div>
                    <div className="text-xs text-gray-500 text-left">Para ambientes bem iluminados</div>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Navegação */}
          <div className="flex items-center justify-between mt-8 pt-6" style={{ borderTop: '1px solid var(--border)' }}>
            <button
              onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={step === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-colors disabled:opacity-30"
              style={{ color: 'var(--text-secondary)' }}>
              <ChevronLeft size={16} /> Voltar
            </button>

            <div className="flex gap-2">
              {STEPS.map((_, i) => (
                <div key={i} className="w-2 h-2 rounded-full transition-colors"
                  style={{ background: i === step ? '#F5A623' : i < step ? '#22C55E' : 'var(--border)' }} />
              ))}
            </div>

            {step < STEPS.length - 1 ? (
              <button
                onClick={() => canAdvance() && setStep(s => s + 1)}
                disabled={!canAdvance()}
                className="flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                style={{ background: '#F5A623', color: '#000' }}>
                Próximo <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={finish}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ background: '#22C55E', color: '#fff' }}>
                {loading ? 'Salvando...' : <><Check size={16} /> Concluir</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, placeholder, value, onChange, type = 'text' }: {
  label: string; placeholder: string; value: string
  onChange: (v: string) => void; type?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl text-sm transition-colors"
        style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          color: 'var(--text-primary)',
        }}
      />
    </div>
  )
}
