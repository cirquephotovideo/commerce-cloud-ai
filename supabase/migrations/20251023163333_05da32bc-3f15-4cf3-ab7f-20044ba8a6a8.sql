-- Créer la table pour stocker le référentiel d'attributs Odoo
CREATE TABLE IF NOT EXISTS public.product_attribute_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_name TEXT NOT NULL,
  attribute_value TEXT NOT NULL,
  category TEXT DEFAULT 'hottes',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour améliorer les performances de recherche
CREATE INDEX IF NOT EXISTS idx_attribute_name ON public.product_attribute_definitions(attribute_name);

-- Ajouter la colonne odoo_attributes à product_analyses si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'product_analyses' 
    AND column_name = 'odoo_attributes'
  ) THEN
    ALTER TABLE public.product_analyses ADD COLUMN odoo_attributes JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.product_attribute_definitions ENABLE ROW LEVEL SECURITY;

-- Super admins can manage attribute definitions
CREATE POLICY "Super admins can manage attribute definitions"
  ON public.product_attribute_definitions
  FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Users can read attribute definitions
CREATE POLICY "Users can read attribute definitions"
  ON public.product_attribute_definitions
  FOR SELECT
  USING (auth.uid() IS NOT NULL);