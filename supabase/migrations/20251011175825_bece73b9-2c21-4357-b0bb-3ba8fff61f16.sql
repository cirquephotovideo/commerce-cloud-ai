-- Ajouter la colonne email_mode à supplier_configurations
ALTER TABLE supplier_configurations 
ADD COLUMN IF NOT EXISTS email_mode TEXT DEFAULT 'dedicated' 
CHECK (email_mode IN ('dedicated', 'imap', 'pop3', 'webhook'));

COMMENT ON COLUMN supplier_configurations.email_mode IS 
'Mode de réception email: dedicated (Resend webhook), imap, pop3, ou webhook personnalisé';