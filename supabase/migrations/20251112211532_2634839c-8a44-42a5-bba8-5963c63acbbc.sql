-- Ajouter les colonnes cache_hit et platform_type à mcp_call_logs
ALTER TABLE public.mcp_call_logs 
ADD COLUMN IF NOT EXISTS cache_hit BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS platform_type TEXT;

-- Index pour analyser les performances du cache
CREATE INDEX IF NOT EXISTS idx_mcp_call_logs_cache_hit 
ON public.mcp_call_logs(cache_hit);

-- Index pour filtrer par type de plateforme
CREATE INDEX IF NOT EXISTS idx_mcp_call_logs_platform_type 
ON public.mcp_call_logs(platform_type);

COMMENT ON COLUMN public.mcp_call_logs.cache_hit IS 'Indique si la réponse provient du cache (true) ou d''un appel API réel (false)';
COMMENT ON COLUMN public.mcp_call_logs.platform_type IS 'Type de plateforme (odoo, prestashop, shopify, amazon)';