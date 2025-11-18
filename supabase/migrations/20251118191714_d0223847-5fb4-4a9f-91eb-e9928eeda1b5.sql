-- ============================================================================
-- CRITICAL SECURITY MIGRATION: Move sensitive credentials to Supabase Vault
-- ============================================================================
-- This migration addresses weak pgcrypto encryption by migrating to Vault
-- Affected tables: odoo_configurations, platform_configurations, 
--                  amazon_credentials, supplier_configurations

-- Step 1: Add vault_id columns to track Vault references
ALTER TABLE odoo_configurations 
ADD COLUMN IF NOT EXISTS password_vault_id UUID REFERENCES vault.secrets(id);

ALTER TABLE platform_configurations 
ADD COLUMN IF NOT EXISTS api_key_vault_id UUID REFERENCES vault.secrets(id);

ALTER TABLE amazon_credentials 
ADD COLUMN IF NOT EXISTS client_secret_vault_id UUID REFERENCES vault.secrets(id),
ADD COLUMN IF NOT EXISTS refresh_token_vault_id UUID REFERENCES vault.secrets(id);

ALTER TABLE supplier_configurations 
ADD COLUMN IF NOT EXISTS imap_password_vault_id UUID;

-- Step 2: Create helper function to migrate credentials to Vault
CREATE OR REPLACE FUNCTION migrate_credential_to_vault(
  p_table_name TEXT,
  p_id UUID,
  p_secret_name TEXT,
  p_encrypted_value TEXT,
  p_description TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vault_id UUID;
  v_decrypted_value TEXT;
BEGIN
  -- Decrypt using pgcrypto
  BEGIN
    v_decrypted_value := pgp_sym_decrypt(
      decode(p_encrypted_value, 'base64'),
      current_setting('app.jwt_secret', true)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to decrypt credential for % %: %', p_table_name, p_id, SQLERRM;
    RETURN NULL;
  END;
  
  -- Store in Vault with proper error handling
  BEGIN
    INSERT INTO vault.secrets (name, secret, description)
    VALUES (p_secret_name, v_decrypted_value, p_description)
    RETURNING id INTO v_vault_id;
    
    RETURN v_vault_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to insert into Vault for % %: %', p_table_name, p_id, SQLERRM;
    RETURN NULL;
  END;
END;
$$;

-- Step 3: Add indexes for vault_id lookups
CREATE INDEX IF NOT EXISTS idx_odoo_password_vault 
ON odoo_configurations(password_vault_id) WHERE password_vault_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_platform_api_key_vault 
ON platform_configurations(api_key_vault_id) WHERE api_key_vault_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_amazon_secrets_vault 
ON amazon_credentials(client_secret_vault_id, refresh_token_vault_id) 
WHERE client_secret_vault_id IS NOT NULL OR refresh_token_vault_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_password_vault 
ON supplier_configurations(imap_password_vault_id) WHERE imap_password_vault_id IS NOT NULL;

-- Step 4: Create secure getter functions for edge functions
CREATE OR REPLACE FUNCTION get_odoo_password(p_config_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vault_id UUID;
  v_user_id UUID;
  v_password TEXT;
BEGIN
  -- Verify ownership
  SELECT user_id, password_vault_id INTO v_user_id, v_vault_id
  FROM odoo_configurations
  WHERE id = p_config_id;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Configuration not found';
  END IF;
  
  IF v_user_id != auth.uid() AND NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized access';
  END IF;
  
  IF v_vault_id IS NULL THEN
    RAISE EXCEPTION 'Credential not migrated to Vault';
  END IF;
  
  SELECT decrypted_secret INTO v_password
  FROM vault.decrypted_secrets
  WHERE id = v_vault_id;
  
  RETURN v_password;
END;
$$;

CREATE OR REPLACE FUNCTION get_platform_api_key(p_config_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vault_id UUID;
  v_user_id UUID;
  v_api_key TEXT;
BEGIN
  SELECT user_id, api_key_vault_id INTO v_user_id, v_vault_id
  FROM platform_configurations
  WHERE id = p_config_id;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Configuration not found';
  END IF;
  
  IF v_user_id != auth.uid() AND NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized access';
  END IF;
  
  IF v_vault_id IS NULL THEN
    RAISE EXCEPTION 'Credential not migrated to Vault';
  END IF;
  
  SELECT decrypted_secret INTO v_api_key
  FROM vault.decrypted_secrets
  WHERE id = v_vault_id;
  
  RETURN v_api_key;
END;
$$;

CREATE OR REPLACE FUNCTION get_amazon_credentials(p_credential_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret_vault_id UUID;
  v_token_vault_id UUID;
  v_client_secret TEXT;
  v_refresh_token TEXT;
BEGIN
  SELECT client_secret_vault_id, refresh_token_vault_id
  INTO v_secret_vault_id, v_token_vault_id
  FROM amazon_credentials
  WHERE id = p_credential_id;
  
  IF v_secret_vault_id IS NULL OR v_token_vault_id IS NULL THEN
    RAISE EXCEPTION 'Credentials not migrated to Vault';
  END IF;
  
  SELECT decrypted_secret INTO v_client_secret
  FROM vault.decrypted_secrets
  WHERE id = v_secret_vault_id;
  
  SELECT decrypted_secret INTO v_refresh_token
  FROM vault.decrypted_secrets
  WHERE id = v_token_vault_id;
  
  RETURN json_build_object(
    'client_secret', v_client_secret,
    'refresh_token', v_refresh_token
  );
END;
$$;

-- Step 5: Add comments for documentation
COMMENT ON FUNCTION migrate_credential_to_vault IS 
'Securely migrates encrypted credentials from pgcrypto to Supabase Vault. Use once per credential.';

COMMENT ON FUNCTION get_odoo_password IS 
'Securely retrieves Odoo password from Vault with user verification. Use in edge functions.';

COMMENT ON FUNCTION get_platform_api_key IS 
'Securely retrieves platform API key from Vault with user verification. Use in edge functions.';

COMMENT ON FUNCTION get_amazon_credentials IS 
'Securely retrieves Amazon credentials from Vault. Returns JSON with client_secret and refresh_token.';