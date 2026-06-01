-- ============================================================
-- Protetor anti-cancelamento/chargeback
-- Adiciona campos de bloqueio manual na tabela `licencas`.
--
-- Campos novos (todos com DEFAULT/NULL — NÃO quebram o fluxo do n8n
-- nem as Edge Functions existentes `gerar-licenca` / `buscar-licenca`):
--   - bloqueada        : interruptor manual. true = app trava.
--   - motivo_bloqueio  : texto livre (ex.: "chargeback ML order 123").
--   - ultima_validacao : atualizado pela Edge Function `validar-licenca`.
--
-- Como bloquear um cliente:
--   UPDATE licencas SET bloqueada = true, motivo_bloqueio = 'chargeback ML'
--   WHERE chave = 'DEP-XXXX-XXXX-XXXX';
-- Para desbloquear:
--   UPDATE licencas SET bloqueada = false, motivo_bloqueio = NULL
--   WHERE chave = 'DEP-XXXX-XXXX-XXXX';
-- ============================================================

ALTER TABLE licencas ADD COLUMN IF NOT EXISTS bloqueada BOOLEAN DEFAULT false;
ALTER TABLE licencas ADD COLUMN IF NOT EXISTS motivo_bloqueio TEXT;
ALTER TABLE licencas ADD COLUMN IF NOT EXISTS ultima_validacao TIMESTAMP;
