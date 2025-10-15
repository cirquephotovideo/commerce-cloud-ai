-- Étape 1: Vérifier et chiffrer automatiquement les mots de passe en clair
UPDATE supplier_configurations
SET connection_config = jsonb_set(
  connection_config,
  '{imap_password}',
  to_jsonb(encrypt_email_password(connection_config->>'imap_password'))
)
WHERE connection_config->>'imap_password' IS NOT NULL
  AND length(connection_config->>'imap_password') < 50
  AND connection_config->>'imap_password' !~ '^[A-Za-z0-9+/=]+$';

-- Étape 2: Créer une fonction RPC pour chiffrer manuellement un mot de passe
CREATE OR REPLACE FUNCTION encrypt_supplier_password(p_supplier_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE supplier_configurations
  SET connection_config = jsonb_set(
    connection_config,
    '{imap_password}',
    to_jsonb(encrypt_email_password(connection_config->>'imap_password'))
  )
  WHERE id = p_supplier_id
  AND connection_config->>'imap_password' IS NOT NULL
  AND length(connection_config->>'imap_password') < 50;
END;
$$;