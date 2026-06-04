-- ============================================================
-- C-2: Bloquear SELECT em `licencas` para anon
-- Prioridade: CRÍTICO — executar ÚLTIMO
--
-- Pré-requisito OBRIGATÓRIO:
--   - SUPABASE_SERVICE_ROLE_KEY configurada em .env.electron
--   - App Electron reiniciado e testado com a chave configurada
--   - licenca:verificar funcionando corretamente com supabaseAdmin
--
-- Sem esses pré-requisitos, a ativação de licença vai parar de funcionar!
--
-- O que faz:
--   1. Remove a policy de SELECT temporária para anon
--   2. Sem nenhuma policy = licencas inacessível para anon
--   3. Apenas service_role (supabaseAdmin) pode ler licencas
-- ============================================================

-- Remove a policy temporária de SELECT criada em 001
DROP POLICY IF EXISTS "licencas_select_anon_temp" ON licencas;

-- Remover qualquer outra policy de SELECT que possa existir
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'licencas' AND schemaname = 'public' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON licencas', r.policyname);
  END LOOP;
END $$;

-- Verificar: anon não deve conseguir ler licencas
-- Testar com: GET https://vxrhlljvjqdbpfngpzro.supabase.co/rest/v1/licencas?select=*
-- (deve retornar [] ou erro 401)
-- SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'licencas';
