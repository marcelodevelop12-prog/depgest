import { useState } from 'react'
import { Loader2, Key, Wifi, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  onSuccess: () => void
}

export default function Ativacao({ onSuccess }: Props) {
  const [chave, setChave] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

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
          {/* Logo */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6"
              style={{ background: '#F5A62320', border: '2px solid #F5A62340' }}>
              <span className="text-4xl">🍺</span>
            </div>
            <h1 className="text-4xl font-bold mb-2" style={{ color: '#F5A623' }}>DepGest</h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Sistema de Gestão para Depósito de Bebidas
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

              <button
                onClick={ativar}
                disabled={loading || chave.length < 17}
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
    </div>
  )
}
