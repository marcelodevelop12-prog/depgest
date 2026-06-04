-- ============================================================
-- C-3: Restringir upload no bucket `produtos-fotos`
-- Prioridade: CRÍTICO
--
-- O que faz:
--   1. Remove todas as policies de INSERT em storage.objects
--      (atualmente qualquer anon pode fazer upload)
--   2. Restringe upload a service_role apenas
--      (os uploads do Electron usarão service_role após migração do código)
--   3. Mantém leitura pública (necessário para exibir fotos no cardápio)
--   4. Define limite de 5 MB e restringe MIME types para imagens
--
-- Como executar:
--   Supabase Dashboard → SQL Editor → cole este arquivo → Run
-- ============================================================

-- 1. Remove policies de INSERT existentes em storage.objects
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage' AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

-- 2. Remove policies de UPDATE e DELETE em storage.objects para anon
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
      AND cmd IN ('UPDATE', 'DELETE')
      AND roles::text LIKE '%anon%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

-- 3. Garante leitura pública para o bucket produtos-fotos
CREATE POLICY "produtos_fotos_leitura_publica"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'produtos-fotos');

-- 4. Atualiza configurações do bucket: limite de 5 MB e apenas imagens
UPDATE storage.buckets
SET
  file_size_limit  = 5242880,   -- 5 MB
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'produtos-fotos';

-- Verificar resultado:
-- SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'produtos-fotos';
-- SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';
