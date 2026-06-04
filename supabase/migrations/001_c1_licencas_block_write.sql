-- ============================================================
-- C-1: Bloquear UPDATE / DELETE / INSERT em `licencas` para anon
-- Prioridade: CRÍTICO — executar PRIMEIRO
--
-- O que faz:
--   1. Garante RLS ativo na tabela
--   2. Remove TODAS as policies existentes (para não deixar resquícios)
--   3. Recria SOMENTE a policy de SELECT para anon
--      (necessária enquanto licenca:verificar usa anon key — removida em 005)
--   4. Sem policy de INSERT/UPDATE/DELETE = bloqueado para anon/authenticated
--      (service_role bypassa RLS automaticamente)
--
-- Como executar:
--   Supabase Dashboard → SQL Editor → cole este arquivo → Run
-- ============================================================

ALTER TABLE licencas ENABLE ROW LEVEL SECURITY;

-- Remove todas as policies atuais
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'licencas' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON licencas', r.policyname);
  END LOOP;
END $$;

-- SELECT: temporariamente aberto para anon (será bloqueado após migração de código)
-- Ver: supabase/migrations/005_c2_licencas_block_select.sql
CREATE POLICY "licencas_select_anon_temp"
  ON licencas
  FOR SELECT
  TO anon
  USING (true);

-- Verificar resultado:
-- SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'licencas';
