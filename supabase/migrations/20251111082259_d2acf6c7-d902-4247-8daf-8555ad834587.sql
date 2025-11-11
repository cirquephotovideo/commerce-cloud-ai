-- Étape 1 : Ajouter la colonne user_id à product_links
ALTER TABLE product_links 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Créer un index pour les performances
CREATE INDEX IF NOT EXISTS idx_product_links_user_id 
ON product_links(user_id);

-- Ajouter une contrainte pour éviter les doublons
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_links_unique 
ON product_links(analysis_id, supplier_product_id);

-- Étape 2 : Peupler les liens existants avec le user_id depuis product_analyses
UPDATE product_links pl
SET user_id = pa.user_id
FROM product_analyses pa
WHERE pl.analysis_id = pa.id
  AND pl.user_id IS NULL;

-- Rendre user_id obligatoire maintenant que les données existantes sont peuplées
ALTER TABLE product_links 
ALTER COLUMN user_id SET NOT NULL;

-- Étape 3 : Activer RLS sur product_links
ALTER TABLE product_links ENABLE ROW LEVEL SECURITY;

-- Politique de lecture : voir ses propres liens
DROP POLICY IF EXISTS "Users can view their own product links" ON product_links;
CREATE POLICY "Users can view their own product links"
ON product_links FOR SELECT
USING (user_id = auth.uid());

-- Politique de création : créer ses propres liens
DROP POLICY IF EXISTS "Users can create their own product links" ON product_links;
CREATE POLICY "Users can create their own product links"
ON product_links FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Politique de suppression : supprimer ses propres liens
DROP POLICY IF EXISTS "Users can delete their own product links" ON product_links;
CREATE POLICY "Users can delete their own product links"
ON product_links FOR DELETE
USING (user_id = auth.uid());

-- Politique de mise à jour : mettre à jour ses propres liens
DROP POLICY IF EXISTS "Users can update their own product links" ON product_links;
CREATE POLICY "Users can update their own product links"
ON product_links FOR UPDATE
USING (user_id = auth.uid());