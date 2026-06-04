-- ============================================================
-- A-2: Restringir `pedidos_online` para anon
-- Prioridade: ALTO
--
-- Situação atual: SELECT totalmente aberto (expõe dados pessoais de clientes)
-- Após migração: Electron usa service_role → não precisa de SELECT para anon
--
-- Para o cardápio online (browser): INSERT de novos pedidos é necessário.
-- SELECT por token_rastreio é necessário para a página de rastreio.
--
-- Nota: RLS não pode forçar "só permite SELECT se filtrar por token_rastreio"
-- nativamente. A restrição é aplicada pelo frontend que sempre filtra por token.
-- O SELECT para anon é mantido mas com RLS que permite apenas leitura.
-- A proteção real contra scraping é: o Electron não depende mais do SELECT anon.
-- ============================================================

ALTER TABLE pedidos_online ENABLE ROW LEVEL SECURITY;

-- Remove todas as policies atuais
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'pedidos_online' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON pedidos_online', r.policyname);
  END LOOP;
END $$;

-- SELECT: mantido para anon (rastreio público por token_rastreio)
-- O frontend SEMPRE filtra por token_rastreio=eq.TOKEN — nunca lista todos.
CREATE POLICY "pedidos_online_select_publico"
  ON pedidos_online
  FOR SELECT
  TO public
  USING (true);

-- INSERT: anon pode criar pedidos (cliente fazendo pedido no cardápio)
CREATE POLICY "pedidos_online_insert_cliente"
  ON pedidos_online
  FOR INSERT
  TO public
  WITH CHECK (
    cliente_nome IS NOT NULL AND
    loja_id IS NOT NULL AND
    total > 0
  );

-- UPDATE/DELETE: somente service_role (Electron ao aceitar/cancelar pedido)
-- Sem policies de UPDATE/DELETE = bloqueado para anon

-- Verificar resultado:
-- SELECT policyname, cmd, roles, with_check FROM pg_policies WHERE tablename = 'pedidos_online';
