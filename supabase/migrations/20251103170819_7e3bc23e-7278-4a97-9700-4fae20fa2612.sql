-- =====================================================
-- SECURITY FIX: MCP System Tables & SECURITY DEFINER Functions
-- =====================================================

-- Fix 1: MCP Rate Limits - User-scoped policies
DROP POLICY IF EXISTS "System can manage rate limits" ON mcp_rate_limits;
DROP POLICY IF EXISTS "Users can view their own rate limits" ON mcp_rate_limits;

CREATE POLICY "Users can view their own rate limits"
  ON mcp_rate_limits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert rate limits"
  ON mcp_rate_limits FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update rate limits"
  ON mcp_rate_limits FOR UPDATE
  USING (true);

-- Fix 2: MCP Health Checks - Admin-only read access
DROP POLICY IF EXISTS "System can manage health checks" ON mcp_health_checks;
DROP POLICY IF EXISTS "Super admins can view all health checks" ON mcp_health_checks;

CREATE POLICY "Super admins can view health checks"
  ON mcp_health_checks FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "System can insert health checks"
  ON mcp_health_checks FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update health checks"
  ON mcp_health_checks FOR UPDATE
  USING (true);

CREATE POLICY "System can delete health checks"
  ON mcp_health_checks FOR DELETE
  USING (true);

-- Fix 3: MCP Cache - Service role only
DROP POLICY IF EXISTS "System can manage cache" ON mcp_cache;

CREATE POLICY "Service role only can manage cache"
  ON mcp_cache FOR ALL
  USING (auth.role() = 'service_role');

-- Fix 4: Email Inbox - Restrict to service role
DROP POLICY IF EXISTS "System can insert emails" ON email_inbox;

CREATE POLICY "Service role can insert emails"
  ON email_inbox FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR auth.uid() = user_id);

-- Fix 5: Supplier Price Variants - User-scoped
DROP POLICY IF EXISTS "System can manage variants" ON supplier_price_variants;

CREATE POLICY "Users manage own supplier variants"
  ON supplier_price_variants FOR ALL
  USING (EXISTS (
    SELECT 1 FROM supplier_products sp
    WHERE sp.id = supplier_price_variants.supplier_product_id
    AND sp.user_id = auth.uid()
  ));

-- Fix 6: Import Errors - User-scoped
DROP POLICY IF EXISTS "System can manage errors" ON import_errors;

CREATE POLICY "Users view own import errors"
  ON import_errors FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert import errors"
  ON import_errors FOR INSERT
  WITH CHECK (true);

-- Fix 7: Update check_and_update_rate_limit with user validation
CREATE OR REPLACE FUNCTION public.check_and_update_rate_limit(
  p_user_id uuid,
  p_package_id text
)
RETURNS jsonb
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
  -- CRITICAL: Verify caller owns this user_id
  IF p_user_id != auth.uid() AND NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized: Cannot check rate limit for other users';
  END IF;
  
  v_limit := CASE 
    WHEN p_package_id ILIKE '%odoo%' THEN 100
    WHEN p_package_id ILIKE '%prestashop%' THEN 50
    WHEN p_package_id ILIKE '%amazon%' THEN 20
    ELSE 50
  END;

  SELECT call_count, window_start INTO v_current_count, v_window_start
  FROM mcp_rate_limits
  WHERE user_id = p_user_id AND package_id = p_package_id;

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

  IF v_current_count >= v_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'current_count', v_current_count,
      'limit', v_limit,
      'reset_at', v_window_start + v_window_duration,
      'retry_after_seconds', EXTRACT(EPOCH FROM (v_window_start + v_window_duration - NOW()))::INTEGER
    );
  END IF;

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

-- Fix 8: Update get_supplier_password with user validation
CREATE OR REPLACE FUNCTION public.get_supplier_password(p_supplier_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_vault_id TEXT;
  v_password TEXT;
BEGIN
  -- CRITICAL: Verify supplier belongs to caller
  SELECT user_id INTO v_user_id
  FROM supplier_configurations
  WHERE id = p_supplier_id;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Supplier not found';
  END IF;
  
  IF v_user_id != auth.uid() AND NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized: Cannot access other users suppliers';
  END IF;
  
  SELECT connection_config->>'imap_password_vault_id'
  INTO v_vault_id
  FROM supplier_configurations
  WHERE id = p_supplier_id;
  
  IF v_vault_id IS NULL THEN
    RAISE EXCEPTION 'No vault ID found for supplier %', p_supplier_id;
  END IF;
  
  SELECT decrypted_secret
  INTO v_password
  FROM vault.decrypted_secrets
  WHERE id = v_vault_id::UUID;
  
  RETURN v_password;
END;
$$;

-- Fix 9: Restrict encrypt_email_password to service role
CREATE OR REPLACE FUNCTION public.encrypt_email_password(plain_password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Function restricted to service role';
  END IF;
  
  RETURN encode(
    pgp_sym_encrypt(
      plain_password,
      current_setting('app.jwt_secret', true)
    ),
    'base64'
  );
END;
$$;