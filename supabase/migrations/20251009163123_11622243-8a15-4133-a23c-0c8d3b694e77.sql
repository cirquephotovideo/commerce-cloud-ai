-- Ajouter les colonnes FCC ID et données FCC à la table rsgp_compliance
ALTER TABLE public.rsgp_compliance 
ADD COLUMN IF NOT EXISTS fcc_id TEXT,
ADD COLUMN IF NOT EXISTS fcc_data JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.rsgp_compliance.fcc_id IS 'FCC ID du produit pour les appareils sans fil (ex: BCG-A1303A)';
COMMENT ON COLUMN public.rsgp_compliance.fcc_data IS 'Données complètes récupérées depuis fccid.io incluant grantee, equipment type, documents, images, etc.';