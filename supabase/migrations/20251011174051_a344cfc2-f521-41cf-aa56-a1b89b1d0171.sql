-- Ajouter la colonne dedicated_email pour les emails dédiés par fournisseur
ALTER TABLE supplier_configurations 
ADD COLUMN dedicated_email TEXT UNIQUE;

-- Créer un index pour des lookups rapides
CREATE INDEX idx_supplier_dedicated_email 
ON supplier_configurations(dedicated_email);

-- Commenter la colonne pour documentation
COMMENT ON COLUMN supplier_configurations.dedicated_email IS 
'Adresse email unique par fournisseur au format: {supplier_id_court}-{user_id_court}@inbox.tarifique.com. Permet une identification instantanée à 100% sans IA.';