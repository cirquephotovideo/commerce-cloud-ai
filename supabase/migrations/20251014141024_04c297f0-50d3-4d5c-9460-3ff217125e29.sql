-- ============================================
-- SPRINT 1: Gestion Erreurs + Performance
-- ============================================

-- 1. Table pour logger les erreurs d'import détaillées
CREATE TABLE IF NOT EXISTS public.import_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.supplier_configurations(id) ON DELETE SET NULL,
  import_job_id UUID REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  error_type TEXT NOT NULL, -- 'connection', 'parsing', 'validation', 'database', 'timeout'
  error_message TEXT NOT NULL,
  error_details JSONB DEFAULT '{}',
  product_reference TEXT, -- SKU, EAN, ou autre identifiant du produit concerné
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  last_retry_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_method TEXT, -- 'auto_retry', 'manual_fix', 'ignored'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour import_errors
CREATE INDEX IF NOT EXISTS idx_import_errors_user_id ON public.import_errors(user_id);
CREATE INDEX IF NOT EXISTS idx_import_errors_supplier_id ON public.import_errors(supplier_id);
CREATE INDEX IF NOT EXISTS idx_import_errors_unresolved ON public.import_errors(user_id, created_at) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_import_errors_retry ON public.import_errors(retry_count, last_retry_at) WHERE resolved_at IS NULL AND retry_count < max_retries;

-- RLS pour import_errors
ALTER TABLE public.import_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own import errors"
  ON public.import_errors FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own import errors"
  ON public.import_errors FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own import errors"
  ON public.import_errors FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage import errors"
  ON public.import_errors FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Super admins can view all import errors"
  ON public.import_errors FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 2. Améliorer enrichment_queue avec timeout et retry
ALTER TABLE public.enrichment_queue 
  ADD COLUMN IF NOT EXISTS timeout_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS last_error TEXT;

-- Index pour détecter les enrichissements bloqués
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_stuck 
  ON public.enrichment_queue(status, started_at) 
  WHERE status = 'processing' AND started_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_enrichment_queue_timeout
  ON public.enrichment_queue(status, timeout_at)
  WHERE status = 'processing' AND timeout_at IS NOT NULL;

-- 3. Indexes de performance critiques
CREATE INDEX IF NOT EXISTS idx_supplier_products_enrichment_user 
  ON public.supplier_products(enrichment_status, user_id);

CREATE INDEX IF NOT EXISTS idx_supplier_products_user_created
  ON public.supplier_products(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_analyses_user_created
  ON public.product_analyses(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_analyses_ean_user
  ON public.product_analyses(ean, user_id) WHERE ean IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_export_history_user_platform_date
  ON public.export_history(user_id, platform_type, exported_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_inbox_user_status
  ON public.email_inbox(user_id, status, received_at DESC);

-- 4. Index pour améliorer les requêtes de monitoring
CREATE INDEX IF NOT EXISTS idx_import_jobs_user_status
  ON public.import_jobs(user_id, status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_enrichment_queue_user_status
  ON public.enrichment_queue(user_id, status, created_at DESC);

-- 5. Fonction pour auto-nettoyer les enrichissements timeout
CREATE OR REPLACE FUNCTION public.check_enrichment_timeouts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Marquer comme failed les enrichissements qui ont timeout (> 10 minutes)
  UPDATE public.enrichment_queue
  SET 
    status = 'failed',
    error_message = 'Timeout: enrichissement bloqué depuis plus de 10 minutes',
    completed_at = NOW(),
    updated_at = NOW()
  WHERE status = 'processing'
    AND started_at IS NOT NULL
    AND started_at < NOW() - INTERVAL '10 minutes';
    
  -- Logger dans les logs système si on a nettoyé des enrichissements
  IF FOUND THEN
    INSERT INTO public.system_health_logs (
      test_type,
      component_name,
      status,
      test_result
    ) VALUES (
      'enrichment_timeout_cleanup',
      'enrichment_queue',
      'warning',
      jsonb_build_object(
        'cleaned_count', (SELECT COUNT(*) FROM public.enrichment_queue WHERE status = 'failed' AND error_message LIKE 'Timeout%'),
        'timestamp', NOW()
      )
    );
  END IF;
END;
$$;

-- 6. Trigger pour auto-update updated_at sur import_errors
CREATE TRIGGER update_import_errors_updated_at
  BEFORE UPDATE ON public.import_errors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Fonction pour retry automatique des imports échoués
CREATE OR REPLACE FUNCTION public.get_retryable_import_errors()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  supplier_id UUID,
  import_job_id UUID,
  error_type TEXT,
  retry_count INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    user_id,
    supplier_id,
    import_job_id,
    error_type,
    retry_count
  FROM public.import_errors
  WHERE resolved_at IS NULL
    AND retry_count < max_retries
    AND (last_retry_at IS NULL OR last_retry_at < NOW() - INTERVAL '5 minutes')
  ORDER BY created_at ASC
  LIMIT 50;
$$;

COMMENT ON TABLE public.import_errors IS 'Logs détaillés des erreurs d''import avec système de retry automatique';
COMMENT ON FUNCTION public.check_enrichment_timeouts() IS 'Nettoie automatiquement les enrichissements bloqués depuis plus de 10 minutes';
COMMENT ON FUNCTION public.get_retryable_import_errors() IS 'Retourne les erreurs d''import éligibles pour un nouveau retry';