-- =====================================================
-- Phase 4.3: RATE LIMITING
-- =====================================================

CREATE TABLE public.mcp_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id TEXT NOT NULL,
  call_count INTEGER DEFAULT 0,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, package_id)
);

CREATE INDEX idx_rate_limits_user_package ON mcp_rate_limits(user_id, package_id);
CREATE INDEX idx_rate_limits_window ON mcp_rate_limits(window_start);

ALTER TABLE mcp_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rate limits"
ON mcp_rate_limits FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can manage rate limits"
ON mcp_rate_limits FOR ALL
USING (true)
WITH CHECK (true);

-- Fonction de vérification et mise à jour du rate limit
CREATE OR REPLACE FUNCTION check_and_update_rate_limit(
  p_user_id UUID,
  p_package_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_limit INTEGER;
  v_current_count INTEGER;
  v_window_start TIMESTAMP WITH TIME ZONE;
  v_window_duration INTERVAL := '1 hour';
BEGIN
  -- Définir les limites par package
  v_limit := CASE 
    WHEN p_package_id ILIKE '%odoo%' THEN 100
    WHEN p_package_id ILIKE '%prestashop%' THEN 50
    WHEN p_package_id ILIKE '%amazon%' THEN 20
    ELSE 50
  END;

  -- Récupérer l'entrée de rate limit existante
  SELECT call_count, window_start INTO v_current_count, v_window_start
  FROM mcp_rate_limits
  WHERE user_id = p_user_id AND package_id = p_package_id;

  -- Si pas d'entrée ou fenêtre expirée, réinitialiser
  IF v_window_start IS NULL OR (NOW() - v_window_start) > v_window_duration THEN
    INSERT INTO mcp_rate_limits (user_id, package_id, call_count, window_start)
    VALUES (p_user_id, p_package_id, 1, NOW())
    ON CONFLICT (user_id, package_id) 
    DO UPDATE SET 
      call_count = 1,
      window_start = NOW();
    
    RETURN jsonb_build_object(
      'allowed', true,
      'current_count', 1,
      'limit', v_limit,
      'reset_at', NOW() + v_window_duration
    );
  END IF;

  -- Vérifier si limite atteinte
  IF v_current_count >= v_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'current_count', v_current_count,
      'limit', v_limit,
      'reset_at', v_window_start + v_window_duration,
      'retry_after_seconds', EXTRACT(EPOCH FROM (v_window_start + v_window_duration - NOW()))::INTEGER
    );
  END IF;

  -- Incrémenter le compteur
  UPDATE mcp_rate_limits
  SET call_count = call_count + 1
  WHERE user_id = p_user_id AND package_id = p_package_id;

  RETURN jsonb_build_object(
    'allowed', true,
    'current_count', v_current_count + 1,
    'limit', v_limit,
    'reset_at', v_window_start + v_window_duration
  );
END;
$$;

-- =====================================================
-- Phase 3: MONITORING & HEALTH CHECKS
-- =====================================================

CREATE TABLE public.mcp_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id TEXT NOT NULL,
  is_healthy BOOLEAN DEFAULT true,
  last_check_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  consecutive_failures INTEGER DEFAULT 0,
  last_error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_health_checks_package ON mcp_health_checks(package_id);
CREATE INDEX idx_health_checks_health ON mcp_health_checks(is_healthy);

ALTER TABLE mcp_health_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view all health checks"
ON mcp_health_checks FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "System can manage health checks"
ON mcp_health_checks FOR ALL
USING (true)
WITH CHECK (true);

-- =====================================================
-- Phase 4: OPTIMIZATIONS - CACHE
-- =====================================================

CREATE TABLE public.mcp_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL UNIQUE,
  cache_value JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_mcp_cache_key ON mcp_cache(cache_key);
CREATE INDEX idx_mcp_cache_expires ON mcp_cache(expires_at);

ALTER TABLE mcp_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can manage cache"
ON mcp_cache FOR ALL
USING (true)
WITH CHECK (true);

-- Fonction de nettoyage automatique du cache expiré
CREATE OR REPLACE FUNCTION cleanup_expired_mcp_cache()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM mcp_cache WHERE expires_at < NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_cleanup_mcp_cache
AFTER INSERT ON mcp_cache
EXECUTE FUNCTION cleanup_expired_mcp_cache();

-- =====================================================
-- Phase 4: OPTIMIZATIONS - WEBHOOKS
-- =====================================================

CREATE TABLE public.mcp_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  webhook_url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT ARRAY['platform_down', 'rate_limit_exceeded', 'error_threshold'],
  is_active BOOLEAN DEFAULT true,
  secret_token TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_triggered_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_webhooks_user ON mcp_webhooks(user_id);

ALTER TABLE mcp_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own webhooks"
ON mcp_webhooks FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);