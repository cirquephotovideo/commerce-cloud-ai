-- Add rotation tracking fields to amazon_credentials
ALTER TABLE amazon_credentials
ADD COLUMN IF NOT EXISTS secret_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_rotation_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rotation_warning_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS days_before_expiry_warning INTEGER DEFAULT 30;

-- Add comment
COMMENT ON COLUMN amazon_credentials.secret_expires_at IS 'Date d''expiration du Client Secret (rotation requise tous les 180 jours)';
COMMENT ON COLUMN amazon_credentials.last_rotation_at IS 'Date de la dernière rotation du Client Secret';
COMMENT ON COLUMN amazon_credentials.rotation_warning_sent IS 'Indique si un avertissement a été envoyé avant expiration';
COMMENT ON COLUMN amazon_credentials.days_before_expiry_warning IS 'Nombre de jours avant expiration pour envoyer un avertissement';