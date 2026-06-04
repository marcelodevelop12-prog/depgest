-- ============================================================
-- A-1 + M-2: Bloquear INSERT / UPDATE / DELETE em `lojas` para anon
-- Prioridade: ALTO — executar APÓS migrar código para service_role
--
-- Pré-requisito: electron/lib/supabase.ts com supabaseAdmin configurado
-- e SUPABASE_SERVICE_ROLE_KEY definida em .env.electron.
-- Sem isso, o handler config:save-loja vai parar de funcionar.
--
-- O que faz:
--   1. Garante RLS ativo
--   2. Remove todas as policies existentes
--   3. Recria SOMENTE SELECT público (necessário para cardápio online)
--   4. Sem policies de escrita = bloqueado para anon
--      (Electron usa service_role que bypassa RLS)
-- ============================================================

ALTER TABLE lojas ENABLE ROW LEVEL SECURITY;

-- Remove todas as policies atuais
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'lojas' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON lojas', r.policyname);
  END LOOP;
END $$;

-- SELECT público: necessário para o cardápio online (vercel-app) ler dados da loja
CREATE POLICY "lojas_select_publico"
  ON lojas
  FOR SELECT
  TO public
  USING (true);

-- Verificar resultado:
-- SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'lojas';
