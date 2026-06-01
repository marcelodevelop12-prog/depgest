import { useState } from 'react'
import { Loader2, Key, Wifi, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  onSuccess: () => void
  mensagemBloqueio?: string
}

export default function Ativacao({ onSuccess, mensagemBloqueio }: Props) {
  const [chave, setChave] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [aceito, setAceito] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)

  function formatarChave(value: string) {
    const limpo = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    const partes = []
    if (limpo.length > 0) partes.push(limpo.slice(0, 3))
    if (limpo.length > 3) partes.push(limpo.slice(3, 7))
    if (limpo.length > 7) partes.push(limpo.slice(7, 11))
    if (limpo.length > 11) partes.push(limpo.slice(11, 15))
    return partes.join('-')
  }

  async function ativar() {
    if (!chave || chave.length < 17) {
      setErro('Digite a chave completa no formato DEP-XXXX-XXXX-XXXX')
      return
    }

    setLoading(true)
    setErro('')

    try {
      if (!window.api) {
        // Modo desenvolvimento sem Electron
        toast.success('Modo dev: licença simulada')
        onSuccess()
        return
      }

      const result = await window.api.licenca.verificar(chave)
      if (result.ok) {
        toast.success('Licença ativada com sucesso!')
        onSuccess()
      } else {
        setErro(result.erro || 'Erro ao validar licença')
      }
    } catch {
      setErro('Erro de conexão. Verifique sua internet.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Titlebar */}
      {window.api && (
        <div className="titlebar-drag h-8 flex items-center px-4 select-none" style={{ background: 'var(--sidebar)' }}>
          <span className="text-xs font-semibold" style={{ color: '#F5A623' }}>DepGest</span>
          <div className="ml-auto titlebar-nodrag flex gap-2">
            <button onClick={() => window.api.window.minimize()} className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-400 transition-colors" />
            <button onClick={() => window.api.window.close()} className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors" />
          </div>
        </div>
      )}

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md animate-in">
          {/* Wordmark */}
          <div className="text-center mb-14">
            <h1 className="font-bold leading-none" style={{ fontSize: 48 }}>
              <span style={{ color: '#FFFFFF' }}>Dep</span><span style={{ color: '#F5A623' }}>Gest</span>
            </h1>
            <p className="mt-2 font-medium tracking-widest uppercase"
              style={{ fontSize: 12, letterSpacing: 3, color: '#888888' }}>
              Sistema de Gestão
            </p>
          </div>

          {/* Card ativação */}
          <div className="rounded-2xl p-8" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg" style={{ background: '#F5A62320' }}>
                <Key size={20} style={{ color: '#F5A623' }} />
              </div>
              <div>
                <h2 className="font-semibold">Ativação de Licença</h2>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Digite sua chave para ativar o sistema
                </p>
              </div>
            </div>

            {mensagemBloqueio && (
              <div className="flex items-start gap-2 p-3 rounded-lg text-sm mb-4"
                style={{ background: '#EF444420', border: '1px solid #EF444430', color: '#EF4444' }}>
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                {mensagemBloqueio}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  CHAVE DE LICENÇA
                </label>
                <input
                  type="text"
                  value={chave}
                  onChange={e => {
                    setErro('')
                    setChave(formatarChave(e.target.value))
                  }}
                  onKeyDown={e => e.key === 'Enter' && ativar()}
                  placeholder="DEP-XXXX-XXXX-XXXX"
                  maxLength={18}
                  className="w-full px-4 py-3 rounded-xl text-center text-lg font-mono tracking-widest transition-colors"
                  style={{
                    background: 'var(--bg)',
                    border: `1px solid ${erro ? '#EF4444' : 'var(--border)'}`,
                    color: 'var(--text-primary)',
                  }}
                  autoFocus
                />
              </div>

              {erro && (
                <div className="flex items-start gap-2 p-3 rounded-lg text-sm"
                  style={{ background: '#EF444420', border: '1px solid #EF444430', color: '#EF4444' }}>
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  {erro}
                </div>
              )}

              {/* Aceite dos termos */}
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={aceito}
                  onChange={e => setAceito(e.target.checked)}
                  className="mt-0.5 flex-shrink-0 accent-amber-400"
                  style={{ width: 16, height: 16 }}
                />
                <span className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Li e aceito os{' '}
                  <button
                    type="button"
                    onClick={() => setModalAberto(true)}
                    className="underline underline-offset-2 hover:opacity-80 transition-opacity"
                    style={{ color: '#F5A623' }}
                  >
                    Termos de Uso e a Política de Privacidade
                  </button>
                </span>
              </label>

              <button
                onClick={ativar}
                disabled={loading || chave.length < 17 || !aceito}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: '#F5A623', color: '#000' }}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="spinner" />
                    Validando com servidor...
                  </>
                ) : (
                  <>
                    <Key size={16} />
                    Ativar Licença
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="mt-4 flex items-center gap-2 text-xs justify-center" style={{ color: 'var(--text-secondary)' }}>
            <Wifi size={12} />
            Requer conexão com internet apenas na ativação
          </div>

          <p className="text-center text-xs mt-4" style={{ color: 'var(--text-secondary)' }}>
            Não tem uma licença? Contate o suporte DepGest
          </p>
        </div>
      </div>

      {/* Modal Termos de Uso e Política de Privacidade */}
      {modalAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={e => { if (e.target === e.currentTarget) setModalAberto(false) }}
        >
          <div
            className="w-full max-w-lg rounded-2xl flex flex-col"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', maxHeight: '80vh' }}
          >
            {/* Cabeçalho */}
            <div className="px-6 pt-6 pb-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="font-bold text-base">Termos de Uso e Política de Privacidade</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>DepGest — Agência Converte Bot</p>
            </div>

            {/* Conteúdo com scroll */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.65 }}>
              <section>
                <h3 className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>TERMOS DE USO — DepGest</h3>
                <p>Ao ativar esta licença, você concorda com os termos abaixo.</p>
              </section>

              <section>
                <h4 className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>1. LICENÇA DE USO</h4>
                <p>Licença pessoal, intransferível e vitalícia para uso em um único dispositivo vinculado ao hardware ativado. É proibido transferir, revender, sublicenciar ou compartilhar a chave com terceiros.</p>
              </section>

              <section>
                <h4 className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>2. PAGAMENTO E REEMBOLSO</h4>
                <p>Pagamento único, sem mensalidade. Reembolso disponível em até 7 dias corridos após a ativação, conforme o Código de Defesa do Consumidor.</p>
              </section>

              <section>
                <h4 className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>3. RESPONSABILIDADE</h4>
                <p>O Usuário é responsável pelo backup dos dados. A Agência Converte Bot não se responsabiliza por perda de dados por falha de hardware, vírus ou ausência de backup.</p>
              </section>

              <section>
                <h4 className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>4. CANCELAMENTO</h4>
                <p>A licença pode ser cancelada por violação dos termos, sem direito a reembolso.</p>
              </section>

              <section>
                <h4 className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>5. PROPRIEDADE INTELECTUAL</h4>
                <p>O software é propriedade exclusiva da Agência Converte Bot, protegido pela Lei nº 9.609/1998.</p>
              </section>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
                <h3 className="font-bold mb-2" style={{ color: 'var(--text-primary)' }}>POLÍTICA DE PRIVACIDADE</h3>
                <p>Coletamos nome, CNPJ e identificador de hardware para ativação da licença. Dados dos seus clientes ficam armazenados localmente no seu dispositivo e não são acessados pela Agência Converte Bot. Dados de pedidos online são armazenados em nuvem apenas para funcionamento do cardápio e rastreio. Não vendemos dados.</p>
                <p className="mt-2">Contato: <span style={{ color: '#F5A623' }}>convertebot@gmail.com</span></p>
                <p className="mt-2">Foro: Nova Iguaçu/RJ. Lei brasileira aplicável.</p>
              </div>
            </div>

            {/* Rodapé */}
            <div className="px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
              <button
                onClick={() => setModalAberto(false)}
                className="w-full py-2.5 rounded-xl font-semibold text-sm transition-opacity hover:opacity-80"
                style={{ background: 'var(--border)', color: 'var(--text-primary)' }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
