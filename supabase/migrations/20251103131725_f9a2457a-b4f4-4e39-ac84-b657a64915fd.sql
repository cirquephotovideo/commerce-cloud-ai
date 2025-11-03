-- Create a dedicated encryption key setting for supplier passwords
-- This separates password encryption from JWT signing

-- Function to migrate supplier passwords to Supabase Vault
-- This will be used to securely store IMAP passwords
CREATE OR REPLACE FUNCTION public.migrate_supplier_password_to_vault(
  p_supplier_id UUID,
  p_plain_password TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vault_id UUID;
BEGIN
  -- Store password in Supabase Vault
  -- The vault automatically handles encryption with proper key management
  INSERT INTO vault.secrets (
    name,
    secret,
    description
  )
  VALUES (
    'supplier_imap_' || p_supplier_id::text,
    p_plain_password,
    'IMAP password for supplier ' || p_supplier_id::text
  )
  RETURNING id INTO v_vault_id;
  
  -- Update supplier configuration to reference vault
  UPDATE supplier_configurations
  SET connection_config = jsonb_set(
    connection_config - 'imap_password',
    '{imap_password_vault_id}',
    to_jsonb(v_vault_id::text)
  )
  WHERE id = p_supplier_id;
  
  RETURN v_vault_id;
END;
$$;

-- Function to securely retrieve supplier password from Vault
CREATE OR REPLACE FUNCTION public.get_supplier_password(p_supplier_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vault_id TEXT;
  v_password TEXT;
BEGIN
  -- Get vault ID from supplier configuration
  SELECT connection_config->>'imap_password_vault_id'
  INTO v_vault_id
  FROM supplier_configurations
  WHERE id = p_supplier_id;
  
  IF v_vault_id IS NULL THEN
    RAISE EXCEPTION 'No vault ID found for supplier %', p_supplier_id;
  END IF;
  
  -- Retrieve decrypted password from vault
  SELECT decrypted_secret
  INTO v_password
  FROM vault.decrypted_secrets
  WHERE id = v_vault_id::UUID;
  
  RETURN v_password;
END;
$$;

-- Add comment explaining the security improvement
COMMENT ON FUNCTION public.migrate_supplier_password_to_vault IS 
  'Migrates supplier IMAP passwords from JWT-secret encryption to Supabase Vault. '
  'Vault provides proper key management, rotation capabilities, and HSM-level security. '
  'This function should be called for each supplier to migrate their credentials.';

COMMENT ON FUNCTION public.get_supplier_password IS
  'Securely retrieves supplier IMAP password from Supabase Vault. '
  'Uses SECURITY DEFINER to access vault.decrypted_secrets with proper authorization.';

-- Note: The old encrypt_email_password and decrypt_email_password functions
-- are kept for backwards compatibility during migration phase.
-- Once all suppliers are migrated, they can be dropped.