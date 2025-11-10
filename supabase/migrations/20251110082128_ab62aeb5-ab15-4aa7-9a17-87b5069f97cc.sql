-- Add RDT delegation field to amazon_credentials
ALTER TABLE public.amazon_credentials 
ADD COLUMN IF NOT EXISTS rdt_delegation BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.amazon_credentials.rdt_delegation IS 
'Indique si l''application délègue l''accès aux PII (Personally Identifiable Information) à d''autres développeurs via le Restricted Data Token';