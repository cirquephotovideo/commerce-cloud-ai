-- Ensure RLS is enabled and policy exists for code2asin_enrichments
ALTER TABLE public.code2asin_enrichments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'code2asin_enrichments' 
      AND policyname = 'Users can view their code2asin enrichments'
  ) THEN
    CREATE POLICY "Users can view their code2asin enrichments"
    ON public.code2asin_enrichments
    FOR SELECT
    USING (user_id = auth.uid());
  END IF;
END $$;